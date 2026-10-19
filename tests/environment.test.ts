import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

function check(env: Record<string, string>, files: Record<string, string> = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "dashboard-env-test-"));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(path.join(directory, name), content);
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

test("setup checker reads a deployed .env file and keeps host settings first", () => {
  const file = Object.entries({ ...example, AUTH_URL: "invalid-base-value" }).map(([key, value]) => `${key}=${value}`).join("\n");
  const result = check({ NODE_ENV: "production", AUTH_URL: "https://dashboard.example.test" }, { ".env": file, ".env.production": "AUTH_URL=invalid-override" });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes(example.API_AUTH));
});

test("production settings override base .env values", () => {
  const file = Object.entries({ ...example, AUTH_URL: "invalid-base-value" }).map(([key, value]) => `${key}=${value}`).join("\n");
  const result = check({ NODE_ENV: "production" }, { ".env": file, ".env.production": "AUTH_URL=https://dashboard.example.test" });
  assert.equal(result.status, 0, result.stderr);
});

test("setup checker accepts supported auth aliases", () => {
  const { AUTH_URL, AUTH_SECRET, ...other } = example;
  const result = check({ ...other, NEXTAUTH_URL: AUTH_URL, NEXTAUTH_SECRET: AUTH_SECRET });
  assert.equal(result.status, 0, result.stderr);
});

test("public website origins reject page paths while bot API prefixes remain valid", () => {
  for (const name of ["AUTH_URL", "SITE", "CANONICAL_URL"]) {
    const result = check({ ...example, [name]: "https://dashboard.example.test/wrong-path" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /a page path/);
  }
  assert.equal(check({ ...example, DASHBOARD_PUBLIC_URL: "https://dashboard.example.test/wrong-path" }).status, 1);
  assert.equal(check({ ...example, PROD_API_URL: "https://bot.example.test/api" }).status, 0);
});

test("setup checker rejects commented API credential placeholders without exposing them", () => {
  const marker = "#replace-this-credential";
  const result = check({ ...example, API_AUTH: marker });
  assert.equal(result.status, 1);
  assert.ok(!result.stderr.includes(marker));
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
