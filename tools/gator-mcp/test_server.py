"""Tests for the Gator MCP server.

Run directly (`python3 test_server.py`) or through `npm test`, which shells out
to it. No network: the API call is stubbed, because what needs proving is the
protocol handling and the safety gates, not that urllib works.
"""

import io
import json
import os
import unittest
from unittest import mock

import server


SCHEMA = {
    "paths": {
        "/dashboard_config": {
            "get": {
                "summary": "A guild's saved configuration.",
                "parameters": [
                    {"name": "auth", "in": "query", "required": True, "schema": {"type": "string"}},
                    {"name": "server", "in": "query", "required": True, "schema": {"type": "integer"}},
                    {"name": "user", "in": "query", "required": True, "schema": {"type": "integer"}},
                ],
            },
            "post": {"summary": "Change it.", "parameters": [
                {"name": "auth", "in": "query", "required": True, "schema": {"type": "string"}},
                {"name": "server", "in": "query", "required": True, "schema": {"type": "integer"}},
            ]},
        },
        "/status": {"get": {"summary": "Liveness.", "parameters": []}},
    }
}


class Base(unittest.TestCase):
    def setUp(self):
        server._schema_cache = SCHEMA
        self.env = mock.patch.dict(
            os.environ,
            {
                "GATOR_API_AUTH": "s3cret-token",
                "GATOR_ACTING_USER": "1370798053899894926",
                "GATOR_API_URL": "https://api.example",
            },
            clear=False,
        )
        self.env.start()
        os.environ.pop("GATOR_ALLOW_WRITES", None)
        os.environ.pop("GATOR_GUILDS", None)

    def tearDown(self):
        self.env.stop()
        server._schema_cache = None

    def call(self, name, arguments=None):
        return server.handle(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments or {}},
            }
        )


# ── Protocol ─────────────────────────────────────────────────────────────────

class Protocol(Base):
    def test_initialize_declares_tools(self):
        response = server.handle({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        self.assertEqual(response["result"]["protocolVersion"], server.PROTOCOL_VERSION)
        self.assertIn("tools", response["result"]["capabilities"])
        self.assertEqual(response["result"]["serverInfo"]["name"], "gator")

    def test_a_notification_gets_no_reply(self):
        # Replying to one is a protocol violation; some clients disconnect.
        self.assertIsNone(server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"}))

    def test_every_tool_is_listed_with_a_schema(self):
        response = server.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        tools = response["result"]["tools"]
        self.assertEqual(len(tools), len(server.TOOLS))
        for tool in tools:
            self.assertTrue(tool["name"] and tool["description"])
            self.assertEqual(tool["inputSchema"]["type"], "object")
            self.assertNotIn("handler", tool)

    def test_an_unknown_method_is_an_error_not_a_crash(self):
        response = server.handle({"jsonrpc": "2.0", "id": 3, "method": "nope"})
        self.assertEqual(response["error"]["code"], -32601)

    def test_an_unknown_tool_is_reported(self):
        response = self.call("gator_not_a_tool")
        self.assertEqual(response["error"]["code"], -32602)

    def test_a_failing_tool_returns_a_result_not_an_exception(self):
        # The model has to see the failure to correct it.
        response = self.call("gator_get_config", {})
        self.assertTrue(response["result"]["isError"])
        self.assertIn("guild", response["result"]["content"][0]["text"])

    def test_malformed_input_does_not_stop_the_loop(self):
        out = io.StringIO()
        server.serve(io.StringIO('not json\n{"jsonrpc":"2.0","id":9,"method":"ping"}\n'), out)
        lines = [json.loads(line) for line in out.getvalue().strip().split("\n")]
        self.assertEqual(lines[0]["error"]["code"], -32700)
        self.assertEqual(lines[1]["id"], 9)


# ── The catalogue comes from the API ─────────────────────────────────────────

class Catalogue(Base):
    def test_endpoints_are_read_from_the_schema(self):
        names = {(e["endpoint"], e["method"]) for e in server.endpoint_catalogue()}
        self.assertIn(("dashboard_config", "GET"), names)
        self.assertIn(("dashboard_config", "POST"), names)
        self.assertIn(("status", "GET"), names)

    def test_auth_is_never_offered_as_a_parameter(self):
        # It is this server's to supply. Exposing it invites the model to pass
        # one, and a wrong one turns every call into a 401.
        for entry in server.endpoint_catalogue():
            self.assertNotIn("auth", [p["name"] for p in entry["parameters"]])

    def test_an_ambiguous_name_asks_which_method(self):
        with self.assertRaises(server.ToolError) as caught:
            server.find_endpoint("dashboard_config")
        self.assertIn("GET, POST", str(caught.exception))

    def test_an_unknown_name_suggests_near_matches(self):
        with self.assertRaises(server.ToolError) as caught:
            server.find_endpoint("dashboard_conf")
        self.assertIn("dashboard_config", str(caught.exception))

    def test_a_dropped_underscore_still_gets_a_suggestion(self):
        # These names run words together, so a guess missing one separator is
        # not a substring of anything and used to get no help at all.
        server._schema_cache = {
            "paths": {"/dashboard_application_responses": {"get": {"parameters": []}}}
        }
        with self.assertRaises(server.ToolError) as caught:
            server.find_endpoint("dashboard_applicationresponses")
        self.assertIn("dashboard_application_responses", str(caught.exception))

    def test_a_typo_gets_a_suggestion(self):
        with self.assertRaises(server.ToolError) as caught:
            server.find_endpoint("dashbord_config")
        self.assertIn("dashboard_config", str(caught.exception))

    def test_the_root_endpoint_is_reachable_by_name(self):
        # The catalogue stores it as "/", and stripping the slash off a lone
        # slash leaves nothing to match.
        server._schema_cache = {"paths": {"/": {"get": {"parameters": []}}}}
        self.assertEqual(server.find_endpoint("/")["endpoint"], "/")

    def test_listing_can_hide_writes(self):
        result = server.tool_list_endpoints({"include_writes": False})
        self.assertTrue(all(not e["write"] for e in result["endpoints"]))


# ── Safety ───────────────────────────────────────────────────────────────────

class Safety(Base):
    def test_writes_are_refused_by_default(self):
        with self.assertRaises(server.ToolError) as caught:
            server.request_api("POST", "dashboard_config", {"server": "1"}, {})
        self.assertIn("GATOR_ALLOW_WRITES", str(caught.exception))

    def test_writes_are_allowed_when_asked_for(self):
        os.environ["GATOR_ALLOW_WRITES"] = "1"
        with mock.patch.object(server.urllib.request, "urlopen") as opened:
            opened.return_value.__enter__.return_value.read.return_value = b'{"status":"success"}'
            opened.return_value.__enter__.return_value.status = 200
            status, body = server.request_api("POST", "dashboard_config", {"server": "1"}, {})
        self.assertEqual((status, body), (200, {"status": "success"}))

    def test_a_guild_outside_the_allowlist_is_refused(self):
        os.environ["GATOR_GUILDS"] = "111,222"
        with self.assertRaises(server.ToolError) as caught:
            server.check_guild("333")
        self.assertIn("outside GATOR_GUILDS", str(caught.exception))
        server.check_guild("222")  # allowed, must not raise

    def test_the_allowlist_is_enforced_on_generic_calls_too(self):
        os.environ["GATOR_GUILDS"] = "111"
        response = self.call(
            "gator_call_endpoint",
            {"endpoint": "dashboard_config", "method": "GET", "params": {"server": "999"}},
        )
        self.assertTrue(response["result"]["isError"])
        self.assertIn("outside GATOR_GUILDS", response["result"]["content"][0]["text"])

    def test_the_secret_never_reaches_a_tool_result(self):
        self.assertNotIn("s3cret-token", server.redact("failed on ?auth=s3cret-token&server=1"))
        self.assertIn("«redacted»", server.redact("?auth=s3cret-token"))

    def test_the_secret_is_redacted_even_when_percent_encoded(self):
        os.environ["GATOR_API_AUTH"] = "a b/c"
        self.assertNotIn("a%20b%2Fc", server.redact("url?auth=a%20b%2Fc"))

    def test_a_missing_secret_is_a_clear_message_not_a_traceback(self):
        os.environ["GATOR_API_AUTH"] = ""
        response = self.call("gator_health")
        self.assertTrue(response["result"]["isError"])
        self.assertIn("GATOR_API_AUTH", response["result"]["content"][0]["text"])

    def test_a_missing_acting_user_explains_why_there_is_no_default(self):
        os.environ["GATOR_ACTING_USER"] = ""
        response = self.call("gator_get_config", {"guild": "1"})
        self.assertTrue(response["result"]["isError"])
        self.assertIn("GATOR_ACTING_USER", response["result"]["content"][0]["text"])


# ── Calling ──────────────────────────────────────────────────────────────────

class Calling(Base):
    def _stub(self, payload, status=200):
        patcher = mock.patch.object(server, "request_api", return_value=(status, payload))
        self.addCleanup(patcher.stop)
        return patcher.start()

    def test_the_acting_user_is_filled_in(self):
        stub = self._stub({"status": "success"})
        self.call("gator_call_endpoint", {
            "endpoint": "dashboard_config", "method": "GET", "params": {"server": "1"}
        })
        self.assertEqual(stub.call_args[0][2]["user"], "1370798053899894926")

    def test_a_missing_required_parameter_says_which(self):
        response = self.call("gator_call_endpoint", {"endpoint": "dashboard_config", "method": "GET"})
        self.assertTrue(response["result"]["isError"])
        self.assertIn("server", response["result"]["content"][0]["text"])

    def test_a_config_section_can_be_read_without_the_whole_document(self):
        self._stub({"config": {"Welcome": {"channel_id": "42", "message": {"content": "hi"}}}})
        response = self.call("gator_get_config", {"guild": "1", "section": "Welcome.channel_id"})
        payload = json.loads(response["result"]["content"][0]["text"])
        self.assertEqual(payload["value"], "42")

    def test_a_missing_section_reads_as_null_rather_than_failing(self):
        self._stub({"config": {}})
        response = self.call("gator_get_config", {"guild": "1", "section": "Nope.here"})
        self.assertIsNone(json.loads(response["result"]["content"][0]["text"])["value"])

    def test_applications_come_back_with_the_link_members_are_given(self):
        self._stub({
            "config": {"Applications": {"applications": [
                {"id": "staff", "name": "Staff", "public_id": "1381234567890123456", "questions": [1, 2]},
                {"id": "old", "name": "Unminted", "public_id": None},
            ]}}
        })
        response = self.call("gator_applications", {"guild": "1"})
        payload = json.loads(response["result"]["content"][0]["text"])
        self.assertEqual(payload["count"], 2)
        self.assertEqual(
            payload["applications"][0]["link"],
            "https://www.gatorsys.xyz/form/1381234567890123456",
        )
        # No minted id means no short link, rather than a URL that 404s.
        self.assertIsNone(payload["applications"][1]["link"])

    def test_setting_nothing_is_refused(self):
        os.environ["GATOR_ALLOW_WRITES"] = "1"
        response = self.call("gator_set_config", {"guild": "1"})
        self.assertTrue(response["result"]["isError"])
        self.assertIn("Nothing to change", response["result"]["content"][0]["text"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
