#!/usr/bin/env python3
"""An MCP server for the Gator dashboard.

The website is a proxy. Every server list, every configuration read, every
application and ticket and department the dashboard shows comes from the bot's
API, which the site calls with a shared secret and relays. So the way to
interact with "the website" from the outside is to speak to that API, and this
exposes it as MCP tools.

The tool surface is not written out by hand. FastAPI publishes an OpenAPI
document describing all ninety-nine operations, so this reads it at startup and
builds `list_endpoints` / `describe_endpoint` / `call_endpoint` from the live
schema. An endpoint added to the bot tomorrow is callable here with no change,
and one that is renamed cannot silently keep a stale entry alive. A handful of
curated tools sit on top for the things worth having a shortcut to.

Standard library only, deliberately: this runs as a subprocess of an MCP client
and adding a dependency to install it — into a repository whose runtime
dependencies are the website's — is a poor trade for a JSON-RPC loop and an
HTTP call.

CONFIGURATION
-------------
    GATOR_API_URL     Base URL of the bot API. Defaults to the same value the
                      website falls back to.
    GATOR_API_AUTH    The shared secret. Required. This is the website's
                      `API_AUTH`; it is admin-equivalent over every guild the
                      bot is in, so treat it accordingly.
    GATOR_ACTING_USER Discord user id used for endpoints that take a `user`,
                      which the bot permission-checks against the target guild.
    GATOR_ALLOW_WRITES  Unset or "0" (the default) refuses every POST, PATCH
                      and DELETE. Set to "1" to allow them.
    GATOR_GUILDS      Optional comma-separated allowlist of guild ids. When
                      set, a call naming any other guild is refused.

SAFETY
------
The secret is injected here and never accepted from the model, never returned
in a tool result, and redacted from error text — a URL echoed back in an
exception would otherwise carry it. Writes are off unless asked for, and the
guild allowlist exists so this can be pointed at one server rather than all of
them.
"""

from __future__ import annotations

import difflib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "gator"
SERVER_VERSION = "1.0.0"

DEFAULT_API_URL = "https://fdny-systems-production.up.railway.app"
REQUEST_TIMEOUT_SECONDS = 30

WRITE_METHODS = {"POST", "PATCH", "DELETE", "PUT"}


class ToolError(Exception):
    """A failure to report to the model rather than crash the server on."""


# ── Configuration ────────────────────────────────────────────────────────────

def api_url() -> str:
    return (os.getenv("GATOR_API_URL") or DEFAULT_API_URL).rstrip("/")


def api_auth() -> str:
    secret = (os.getenv("GATOR_API_AUTH") or "").strip()
    if not secret or secret.startswith("#"):
        raise ToolError(
            "GATOR_API_AUTH is not set. It is the same value as the website's "
            "API_AUTH environment variable."
        )
    return secret


def acting_user() -> str:
    user = (os.getenv("GATOR_ACTING_USER") or "").strip()
    if not user:
        raise ToolError(
            "GATOR_ACTING_USER is not set. Most dashboard endpoints take a "
            "`user` — the Discord id whose permissions the bot checks against "
            "the target guild — so there is no sensible default."
        )
    return user


def writes_allowed() -> bool:
    return (os.getenv("GATOR_ALLOW_WRITES") or "0").strip().lower() in {"1", "true", "yes"}


def guild_allowlist() -> set[str] | None:
    raw = (os.getenv("GATOR_GUILDS") or "").strip()
    if not raw:
        return None
    return {part.strip() for part in raw.split(",") if part.strip()}


def redact(text: str) -> str:
    """Keep the secret out of anything the model can see.

    Error text routinely contains the URL that failed, and the URL carries
    `auth` in its query string.
    """
    try:
        secret = (os.getenv("GATOR_API_AUTH") or "").strip()
    except Exception:
        secret = ""
    if not secret:
        return text
    return text.replace(secret, "«redacted»").replace(
        urllib.parse.quote(secret, safe=""), "«redacted»"
    )


def check_guild(guild_id: str | int | None) -> None:
    allowed = guild_allowlist()
    if allowed is None or guild_id is None:
        return
    if str(guild_id) not in allowed:
        raise ToolError(
            f"Guild {guild_id} is outside GATOR_GUILDS. This server is scoped to "
            f"{', '.join(sorted(allowed))}."
        )


# ── HTTP ─────────────────────────────────────────────────────────────────────

def request_api(
    method: str,
    path: str,
    params: dict | None = None,
    body: dict | None = None,
) -> tuple[int, object]:
    """Call the bot API. Returns (status, parsed-or-raw-body)."""
    method = method.upper()
    if method in WRITE_METHODS and not writes_allowed():
        raise ToolError(
            f"{method} {path} is a write, and writes are off. Set "
            "GATOR_ALLOW_WRITES=1 to enable them — this key is admin-equivalent "
            "over every guild the bot is in."
        )

    query = {"auth": api_auth()}
    for key, value in (params or {}).items():
        if value is None:
            continue
        query[key] = str(value)

    url = f"{api_url()}/{path.lstrip('/')}?{urllib.parse.urlencode(query)}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8", "replace")
            status = response.status
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", "replace")
        status = error.code
    except urllib.error.URLError as error:
        raise ToolError(redact(f"Could not reach the bot API: {error.reason}")) from None
    except Exception as error:  # timeouts, TLS, DNS
        raise ToolError(redact(f"Request to the bot API failed: {error}")) from None

    try:
        return status, json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return status, raw


# ── The endpoint catalogue, read from the API itself ─────────────────────────

_schema_cache: dict | None = None


def openapi_schema() -> dict:
    global _schema_cache
    if _schema_cache is not None:
        return _schema_cache
    url = f"{api_url()}/openapi.json"
    try:
        with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            _schema_cache = json.loads(response.read().decode("utf-8", "replace"))
    except Exception as error:
        raise ToolError(
            redact(
                f"Could not read the API's OpenAPI document at {url}: {error}. "
                "The endpoint catalogue is built from it, so the bot has to be "
                "reachable before endpoints can be listed or called by name."
            )
        ) from None
    return _schema_cache


def endpoint_catalogue() -> list[dict]:
    """Flatten the schema into one entry per operation."""
    catalogue: list[dict] = []
    for path, operations in (openapi_schema().get("paths") or {}).items():
        for method, operation in operations.items():
            if method.upper() not in {"GET", "POST", "PATCH", "DELETE", "PUT"}:
                continue
            parameters = [
                {
                    "name": parameter.get("name"),
                    "in": parameter.get("in"),
                    "required": bool(parameter.get("required")),
                    "type": (parameter.get("schema") or {}).get("type", "string"),
                }
                for parameter in operation.get("parameters") or []
                # `auth` is supplied by this server, not by the caller.
                if parameter.get("name") != "auth"
            ]
            catalogue.append(
                {
                    "endpoint": path.lstrip("/") or "/",
                    "method": method.upper(),
                    "write": method.upper() in WRITE_METHODS,
                    "summary": (operation.get("summary") or "").strip(),
                    "parameters": parameters,
                }
            )
    catalogue.sort(key=lambda entry: (entry["endpoint"], entry["method"]))
    return catalogue


def find_endpoint(name: str, method: str | None = None) -> dict:
    # `or "/"` keeps the root endpoint reachable: the catalogue stores it as
    # "/", and stripping the slash off a lone slash leaves nothing to match.
    wanted = name.strip().lstrip("/") or "/"
    matches = [entry for entry in endpoint_catalogue() if entry["endpoint"] == wanted]
    if method:
        matches = [entry for entry in matches if entry["method"] == method.upper()]
    if not matches:
        # Substring first, then fuzzy. Substring alone missed the common case:
        # these names run words together (`dashboard_application_responses`),
        # so a guess that drops one underscore is not a substring of anything
        # and got no suggestion at all.
        names = sorted({entry["endpoint"] for entry in endpoint_catalogue()})
        near = [candidate for candidate in names if wanted and wanted in candidate]
        if not near:
            near = difflib.get_close_matches(wanted, names, n=5, cutoff=0.6)
        if not near:
            # A last pass ignoring separators, which is how most of these
            # guesses go wrong.
            flattened = wanted.replace("_", "")
            near = [c for c in names if flattened in c.replace("_", "")][:5]
        hint = f" Did you mean: {', '.join(near[:8])}?" if near else ""
        raise ToolError(f"No endpoint named {name!r}.{hint}")
    if len(matches) > 1:
        methods = ", ".join(sorted(entry["method"] for entry in matches))
        raise ToolError(f"{name} accepts {methods} — pass `method` to choose.")
    return matches[0]


# ── Tools ────────────────────────────────────────────────────────────────────

def tool_list_endpoints(arguments: dict) -> object:
    search = (arguments.get("search") or "").strip().lower()
    include_writes = bool(arguments.get("include_writes", True))
    entries = [
        entry
        for entry in endpoint_catalogue()
        if (not search or search in entry["endpoint"].lower() or search in entry["summary"].lower())
        and (include_writes or not entry["write"])
    ]
    return {
        "count": len(entries),
        "writes_enabled": writes_allowed(),
        "endpoints": [
            {
                "endpoint": entry["endpoint"],
                "method": entry["method"],
                "write": entry["write"],
                "summary": entry["summary"][:160],
            }
            for entry in entries
        ],
    }


def tool_describe_endpoint(arguments: dict) -> object:
    name = arguments.get("endpoint")
    if not name:
        raise ToolError("`endpoint` is required.")
    return find_endpoint(name, arguments.get("method"))


def tool_call_endpoint(arguments: dict) -> object:
    name = arguments.get("endpoint")
    if not name:
        raise ToolError("`endpoint` is required.")
    entry = find_endpoint(name, arguments.get("method"))
    params = dict(arguments.get("params") or {})
    body = arguments.get("body")

    # Filled in rather than demanded: `user` is this server's identity and
    # `server` is usually the one thing the caller does mean to choose.
    if any(parameter["name"] == "user" for parameter in entry["parameters"]):
        params.setdefault("user", acting_user())
    check_guild(params.get("server") or params.get("guild"))

    missing = [
        parameter["name"]
        for parameter in entry["parameters"]
        if parameter["required"] and parameter["name"] not in params
    ]
    if missing:
        raise ToolError(
            f"{entry['method']} {entry['endpoint']} needs: {', '.join(missing)}. "
            f"Call describe_endpoint for the full parameter list."
        )

    status, payload = request_api(entry["method"], entry["endpoint"], params, body)
    return {"status": status, "ok": 200 <= status < 300, "body": payload}


def tool_health(arguments: dict) -> object:
    status, payload = request_api("GET", "status")
    return {"status": status, "reachable": 200 <= status < 300, "body": payload}


def tool_guilds(arguments: dict) -> object:
    """Servers the acting user can manage, which is what /servers shows."""
    status, payload = request_api(
        "POST", "mutual_servers", body={"user": acting_user(), "guilds": []}
    )
    return {"status": status, "body": payload}


def tool_get_config(arguments: dict) -> object:
    guild = arguments.get("guild")
    if not guild:
        raise ToolError("`guild` is required.")
    check_guild(guild)
    status, payload = request_api(
        "GET", "dashboard_config", {"server": guild, "user": acting_user()}
    )
    section = (arguments.get("section") or "").strip()
    if section and isinstance(payload, dict):
        node = payload.get("config") or {}
        for key in section.split("."):
            if not isinstance(node, dict):
                node = None
                break
            node = node.get(key)
        return {"status": status, "section": section, "value": node}
    return {"status": status, "body": payload}


def tool_set_config(arguments: dict) -> object:
    guild = arguments.get("guild")
    if not guild:
        raise ToolError("`guild` is required.")
    check_guild(guild)
    set_ops = arguments.get("set") or {}
    unset_ops = arguments.get("unset") or []
    if not set_ops and not unset_ops:
        raise ToolError("Nothing to change: pass `set` and/or `unset`.")
    status, payload = request_api(
        "POST",
        "dashboard_config",
        {"server": guild},
        {
            "user": acting_user(),
            "set": set_ops,
            "unset": unset_ops,
            "module": arguments.get("module"),
            "summary": arguments.get("summary"),
        },
    )
    return {"status": status, "ok": 200 <= status < 300, "body": payload}


def tool_applications(arguments: dict) -> object:
    """Applications and the short links members are given for them."""
    guild = arguments.get("guild")
    if not guild:
        raise ToolError("`guild` is required.")
    check_guild(guild)
    status, payload = request_api(
        "GET", "dashboard_config", {"server": guild, "user": acting_user()}
    )
    if not isinstance(payload, dict):
        return {"status": status, "body": payload}
    applications = ((payload.get("config") or {}).get("Applications") or {}).get(
        "applications"
    ) or []
    site = (os.getenv("GATOR_SITE_URL") or "https://www.gatorsys.xyz").rstrip("/")
    return {
        "status": status,
        "count": len(applications),
        "applications": [
            {
                "id": application.get("id"),
                "name": application.get("name"),
                "public_id": application.get("public_id"),
                "link": (
                    f"{site}/form/{application['public_id']}"
                    if str(application.get("public_id") or "").isdigit()
                    else None
                ),
                "questions": len(application.get("questions") or []),
            }
            for application in applications
            if isinstance(application, dict)
        ],
    }


TOOLS: list[dict] = [
    {
        "name": "gator_health",
        "description": (
            "Whether the bot API behind the website is reachable, and what it "
            "reports about itself. Start here when the dashboard looks broken."
        ),
        "inputSchema": {"type": "object", "properties": {}},
        "handler": tool_health,
    },
    {
        "name": "gator_list_endpoints",
        "description": (
            "Every dashboard API operation, read from the running API's own "
            "OpenAPI document rather than a list maintained here. Use this to "
            "find what exists before calling it."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Substring filter over the endpoint name and summary.",
                },
                "include_writes": {
                    "type": "boolean",
                    "description": "Include POST/PATCH/DELETE operations. Default true.",
                },
            },
        },
        "handler": tool_list_endpoints,
    },
    {
        "name": "gator_describe_endpoint",
        "description": "The parameters one endpoint takes, and whether it writes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "endpoint": {"type": "string", "description": "e.g. dashboard_config"},
                "method": {"type": "string", "description": "GET/POST — only when ambiguous."},
            },
            "required": ["endpoint"],
        },
        "handler": tool_describe_endpoint,
    },
    {
        "name": "gator_call_endpoint",
        "description": (
            "Call any dashboard API endpoint. `auth` is supplied by this server "
            "and must not be passed; `user` defaults to the configured acting "
            "user. Writes are refused unless GATOR_ALLOW_WRITES=1."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "endpoint": {"type": "string"},
                "method": {"type": "string"},
                "params": {"type": "object", "description": "Query parameters."},
                "body": {"type": "object", "description": "JSON body, for writes."},
            },
            "required": ["endpoint"],
        },
        "handler": tool_call_endpoint,
    },
    {
        "name": "gator_guilds",
        "description": "Servers the acting user can manage — what /servers lists.",
        "inputSchema": {"type": "object", "properties": {}},
        "handler": tool_guilds,
    },
    {
        "name": "gator_get_config",
        "description": (
            "A guild's saved configuration. Pass `section` as a dot-path "
            "(e.g. 'Welcome.message') to read one part instead of the whole "
            "document, which is large."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "guild": {"type": "string", "description": "Guild id."},
                "section": {"type": "string", "description": "Dot-path, e.g. Tickets.panels."},
            },
            "required": ["guild"],
        },
        "handler": tool_get_config,
    },
    {
        "name": "gator_set_config",
        "description": (
            "Change a guild's configuration by dot-path, the same way the "
            "dashboard's save does. A write: needs GATOR_ALLOW_WRITES=1."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "guild": {"type": "string"},
                "set": {"type": "object", "description": "{'Welcome.channel_id': '123'}"},
                "unset": {"type": "array", "items": {"type": "string"}},
                "module": {"type": "string"},
                "summary": {"type": "string", "description": "Audit line for the change."},
            },
            "required": ["guild"],
        },
        "handler": tool_set_config,
    },
    {
        "name": "gator_applications",
        "description": (
            "A guild's applications with the short link each one is shared by — "
            "the /form/<id> URL members are actually given."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"guild": {"type": "string"}},
            "required": ["guild"],
        },
        "handler": tool_applications,
    },
]

TOOLS_BY_NAME = {tool["name"]: tool for tool in TOOLS}


# ── JSON-RPC over stdio ──────────────────────────────────────────────────────

def handle(message: dict) -> dict | None:
    """Answer one request. Returns None for a notification."""
    method = message.get("method")
    request_id = message.get("id")
    is_notification = request_id is None

    if method == "initialize":
        result = {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        }
    elif method in {"notifications/initialized", "initialized"}:
        return None
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {
            "tools": [
                {
                    "name": tool["name"],
                    "description": tool["description"],
                    "inputSchema": tool["inputSchema"],
                }
                for tool in TOOLS
            ]
        }
    elif method == "tools/call":
        params = message.get("params") or {}
        name = params.get("name")
        tool = TOOLS_BY_NAME.get(name)
        if tool is None:
            return error_response(request_id, -32602, f"No tool named {name!r}")
        try:
            payload = tool["handler"](params.get("arguments") or {})
            text = json.dumps(payload, indent=2, default=str)
            result = {"content": [{"type": "text", "text": redact(text)}]}
        except ToolError as error:
            # Reported as a failed tool result rather than a protocol error:
            # the model should see it and adjust, not have the call vanish.
            result = {
                "content": [{"type": "text", "text": redact(str(error))}],
                "isError": True,
            }
        except Exception as error:  # never take the server down for one call
            result = {
                "content": [{"type": "text", "text": redact(f"{type(error).__name__}: {error}")}],
                "isError": True,
            }
    else:
        if is_notification:
            return None
        return error_response(request_id, -32601, f"Unknown method {method!r}")

    if is_notification:
        return None
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def error_response(request_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def serve(stdin=None, stdout=None) -> None:
    """Line-delimited JSON-RPC, which is what MCP's stdio transport is."""
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout
    for line in stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            response = error_response(None, -32700, "Parse error")
        else:
            response = handle(message)
        if response is None:
            continue
        stdout.write(json.dumps(response) + "\n")
        stdout.flush()


if __name__ == "__main__":
    serve()
