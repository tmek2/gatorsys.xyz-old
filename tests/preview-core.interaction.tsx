import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewState } from "../src/preview/seed";
import { dispatchPreview } from "../src/preview/dispatch";
import { getPreviewState, resetPreviewState } from "../src/preview/store";
import { mapPreviewRoute } from "../src/preview/routes";
import { PREVIEW_GUILDS, PREVIEW_USER_ID } from "../src/preview/identity";

const guild = PREVIEW_GUILDS[0].id;
const read = (state: ReturnType<typeof createPreviewState>, server: string = guild) => dispatchPreview(state, { endpoint: "dashboard_config", method: "GET", params: { server }, body: {} }).data as any;

test("each visitor and server owns independent settings; reset restores seeds", () => {
  const a = getPreviewState("unit-visitor-a");
  const b = getPreviewState("unit-visitor-b");
  assert.equal(Object.keys(a.guilds).length, 3);
  const result = dispatchPreview(a, { endpoint: "dashboard_config", method: "POST", params: { server: guild, user: "spoof" }, body: { user: "spoof", set: { "Modules.Welcome": false } } });
  assert.equal(result.status, 200);
  assert.equal(read(a).config.Modules.Welcome, false);
  assert.equal(read(b).config.Modules.Welcome, true);
  assert.equal(read(a, PREVIEW_GUILDS[1].id).config.Modules.Welcome, true);
  assert.equal(a.guilds[guild].management.audit[0].actor_id, PREVIEW_USER_ID);
  (result.data as any).config.Modules.Welcome = true;
  assert.equal(read(a).config.Modules.Welcome, false, "returned data cannot mutate saved state");
  assert.equal(read(resetPreviewState("unit-visitor-a")).config.Modules.Welcome, true);
});

test("invalid config paths reject the entire save without changing prototype or earlier fields", () => {
  const state = createPreviewState();
  const result = dispatchPreview(state, { endpoint: "dashboard_config", method: "POST", params: { server: guild }, body: { set: { "Modules.Welcome": false, "__proto__.polluted": true } } });
  assert.equal(result.status, 400);
  assert.equal(read(state).config.Modules.Welcome, true);
  assert.equal(({} as any).polluted, undefined);
});

test("unknown routes, unseeded servers and owner actions fail closed", () => {
  const state = createPreviewState();
  assert.equal(mapPreviewRoute("/api/private-service", "GET", new URLSearchParams(), {}), null);
  for (const endpoint of ["unknown", "dashboard_config", "dashboard_meta"]) {
    assert.equal(dispatchPreview(state, { endpoint, method: "GET", params: { server: "not-real" }, body: {} }).status, 404);
  }
  assert.equal(dispatchPreview(state, { endpoint: "dashboard_owner", method: "GET", params: {}, body: {} }).status, 403);
});

test("read requests cannot perform case or staff mutations", () => {
  const state = createPreviewState();
  const before = JSON.stringify(state);
  for (const endpoint of ["delinfraction", "UpdateInfraction", "dashboard_staffaction", "dashboard_departmentaction"]) {
    for (const method of ["GET", "HEAD"]) {
      assert.equal(dispatchPreview(state, { endpoint, method, params: { server: guild, id: "case-1" }, body: { action: "delete" } }).status, 405);
    }
  }
  assert.equal(JSON.stringify(state), before);
});

test("all three management and portal routes resolve to the same datasets", () => {
  const state = createPreviewState();
  for (const server of PREVIEW_GUILDS) {
    const mapped = mapPreviewRoute(`/api/manage/${server.id}/meta`, "GET", new URLSearchParams(), {})!;
    const result = dispatchPreview(state, mapped.request);
    assert.equal((result.data as any).guild.name, server.name);
    const membership = dispatchPreview(state, { endpoint: "dashboard_mydepartments", method: "GET", params: {}, body: {} }).data as any;
    assert.ok(membership.departments.some((item: any) => item.parentGuildId === server.id));
  }
});
