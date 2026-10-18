import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const checker = path.resolve("scripts/check-env.mjs");
const example = {
  AUTH_SECRET: "disposable-test-secret-with-at-least-32-characters",
  AUTH_URL: "http://localhost:3000",
  DISCORD_CLIENT_ID: "100000000000000001",
  DISCORD_CLIENT_SECRET: "test-discord-secret",
  PROD_API_URL: "https://bot.example.test",
  API_AUTH: "test-bot-credential",
  NEXT_PUBLIC_DISCORD_CLIENT_ID: "100000000000000001",
};

function check(env: Record<string, string>) {
  const directory = mkdtempSync(path.join(tmpdir(), "dashboard-env-test-"));
  try {
    return spawnSync(process.execPath, [checker], { cwd: directory, env: { NODE_ENV: "test", ...env }, encoding: "utf8" });
  } finally {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("dashboard-env-test-"));
    rmSync(directory, { recursive: true });
  }
}

test("setup checker accepts representative settings and public deep links", () => {
  const result = check({ ...example, NEXT_PUBLIC_DOCS_URL: "https://docs.example.test/start?language=en#install" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Required settings are present/);
});

test("setup checker identifies missing names without exposing credentials", () => {
  const result = check({ AUTH_SECRET: example.AUTH_SECRET, API_AUTH: example.API_AUTH });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DISCORD_CLIENT_ID is missing/);
  assert.ok(!result.stderr.includes(example.API_AUTH));
  assert.ok(!result.stderr.includes(example.AUTH_SECRET));
});

test("setup checker rejects embedded credentials without printing them", () => {
  const result = check({ ...example, PROD_API_URL: "https://secret-user:secret-password@bot.example.test" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PROD_API_URL must be/);
  assert.ok(!result.stderr.includes("secret-user"));
  assert.ok(!result.stderr.includes("secret-password"));
});
