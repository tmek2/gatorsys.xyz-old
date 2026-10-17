import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

/**
 * The MCP server is Python, so its own suite runs here as a subprocess and `npm
 * test` covers it.
 *
 * The end-to-end case drives the real stdio transport, which proves an MCP
 * client can speak to it at all.
 */
const directory = fileURLToPath(new URL("../tools/gator-mcp/", import.meta.url));
const run = promisify(execFile);

async function python(): Promise<string | null> {
  for (const candidate of ["python3", "python"]) {
    try {
      await run(candidate, ["--version"]);
      return candidate;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

test("the MCP server's own suite passes", async (t) => {
  const runtime = await python();
  if (!runtime) return t.skip("no Python available");

  const { stdout, stderr } = await run(runtime, ["test_server.py"], { cwd: directory });
  assert.match(stderr + stdout, /\nOK\b/, stderr || stdout);
});

test("an MCP client can complete a handshake and list tools", async (t) => {
  const runtime = await python();
  if (!runtime) return t.skip("no Python available");

  const responses = await new Promise<any[]>((resolve, reject) => {
    const child = spawn(runtime, ["server.py"], {
      cwd: directory,
      // Enough to start; no call below reaches the network.
      env: { ...process.env, GATOR_API_AUTH: "test-token", GATOR_ACTING_USER: "1" },
    });
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.on("error", reject);
    child.on("close", () => {
      try {
        resolve(out.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.write(
      [
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      ].join("\n") + "\n",
    );
    child.stdin.end();
  });

  // The notification in the middle must not have been answered.
  assert.equal(responses.length, 2, "a notification was replied to");
  assert.equal(responses[0].result.serverInfo.name, "gator");
  assert.equal(responses[0].result.protocolVersion, "2024-11-05");

  const names = responses[1].result.tools.map((tool: { name: string }) => tool.name);
  assert.ok(names.includes("gator_call_endpoint"), "the generic escape hatch is missing");
  assert.ok(names.includes("gator_get_config"));
  for (const tool of responses[1].result.tools) {
    assert.ok(tool.description, `${tool.name} has no description`);
    assert.equal(tool.inputSchema.type, "object");
  }
});
