import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewState } from "../src/preview/seed";
import { dispatchPreview } from "../src/preview/dispatch";
import { PREVIEW_GUILDS, PREVIEW_USER_ID } from "../src/preview/identity";
import { mapPreviewRoute } from "../src/preview/routes";
import type { PreviewState } from "../src/preview/types";

function request(state: PreviewState, path: string, method = "GET", body: Record<string, unknown> = {}) {
  const url = new URL(path, "http://preview.local");
  const mapped = mapPreviewRoute(url.pathname, method, url.searchParams, body);
  assert.ok(mapped, `Missing route mapping for ${path}`);
  return dispatchPreview(state, mapped.request) as { status: number; data: any };
}

test("department public form submission updates both the review queue and member submission", () => {
  const state = createPreviewState();
  const otherVisitor = createPreviewState();
  const guild = state.guilds[PREVIEW_GUILDS[0].id];
  const department = guild.departments.records[0];
  const application = guild.config.Applications.applications.find((item: any) => item.department_id === department.profile.id);
  assert.ok(application);
  const path = `/api/application/${guild.id}/${application.id}`;
  const before = request(state, path);
  assert.equal(before.status, 200);
  assert.equal(before.data.alreadySubmitted, false);
  const answers = { interest: "I would like to organize community sessions.", availability: "weekends" };
  const submitted = request(state, path, "POST", { answers, user: "forged-user", integrity: { pasted: 0 } });
  assert.equal(submitted.status, 200);
  const record = guild.management.responses.find((entry) => entry.id === submitted.data.id);
  assert.equal(record?.userId, PREVIEW_USER_ID);
  assert.deepEqual(record?.answers, answers);
  assert.deepEqual(department.submissions[PREVIEW_USER_ID].answers, answers);
  assert.equal(request(state, path).data.alreadySubmitted, true);
  assert.equal(request(otherVisitor, path).data.alreadySubmitted, false);
  const reviewed = request(state, `/api/manage/${guild.id}/applicationresponses?application=${application.id}`);
  assert.equal(reviewed.data.responses.some((entry: any) => entry.id === submitted.data.id), true);
});

test("all three legacy panels and transcript routes share isolated local account state", () => {
  const state = createPreviewState();
  const otherVisitor = createPreviewState();
  for (const [index, guild] of PREVIEW_GUILDS.entries()) {
    const list = request(state, `/api/infractions/${guild.id}`);
    assert.equal(list.status, 200);
    assert.equal(list.data.length, 2);
    const saved = request(state, `/api/infractions/${guild.id}/case-1/update`, "PUT", { action: { type: "Coaching", details: `Preview case ${index + 1}` }, author: { id: "forged-user" } });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.author.id, PREVIEW_USER_ID);
    assert.equal(request(state, `/api/infractions/${guild.id}/case-1`).data.action.details, `Preview case ${index + 1}`);
    assert.notEqual(request(otherVisitor, `/api/infractions/${guild.id}/case-1`).data.action.details, `Preview case ${index + 1}`);
    const transcript = request(state, `/api/transcript/ticket-${index + 1}`);
    assert.equal(transcript.status, 200);
    assert.equal(transcript.data.GuildID, guild.id);
    assert.deepEqual(transcript.data.compact, transcript.data.data.transcript[0].compact);
  }
  const changed = request(state, "/api/account/roblox", "POST", { action: "relink" });
  assert.equal(changed.data.roblox.username, "PreviewBuilder");
  assert.equal(request(otherVisitor, "/api/account/roblox").data.roblox.username, "PreviewPlayer");
  assert.equal(request(state, "/api/roblox/search?keyword=builder").data.users[0].name, "PreviewBuilder");
});
