import assert from "node:assert/strict";
import test from "node:test";
import { fieldProblem } from "../src/components/Manage/config-health.ts";

test("an unloaded resource list does not report deleted selections", () => {
  assert.equal(fieldProblem("channel", "100000000000000001", null), null);
  assert.equal(fieldProblem("role", "100000000000000001", {}), null);
});

test("a successfully loaded empty list identifies deleted selections", () => {
  assert.equal(fieldProblem("channel", "100000000000000001", { channels: [] })?.tag, "Deleted channel");
  assert.equal(fieldProblem("roles", ["100000000000000001", "100000000000000002"], { roles: [] })?.tag, "2 deleted roles");
  assert.equal(fieldProblem("ladder", [], { roles: [] }), null);
});
