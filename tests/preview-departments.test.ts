import assert from "node:assert/strict";
import { test } from "node:test";
import { createDepartmentFixtures, departmentPayload, handleDepartmentRequest, recordDepartmentApplication, decideDepartmentApplication } from "../src/preview/departments.ts";
import type { PreviewGuildBase, PreviewState, PreviewReply } from "../src/preview/types.ts";

const viewer = "100000000000000001";
const server = "100000000000000101";
const day = 86_400_000;

function fixtureState(): PreviewState {
  const state = { guilds: {}, account: {}, sequence: 1000 } as PreviewState;
  for (let index = 0; index < 3; index++) {
    const id = String(BigInt(server) + BigInt(index));
    const base: PreviewGuildBase = {
      id, info: { id, name: `Community ${index}`, icon: null },
      meta: {
        guild: { id, name: `Community ${index}`, icon: null, memberCount: 200, ownerId: viewer, createdAt: "2024-01-01T00:00:00Z", premiumTier: 0, boostCount: 0 },
        me: { id: viewer, isAdmin: true, isOwner: true }, modules: { Department: true },
        roles: [0, 1, 2].map((position) => ({ id: `${id}-role-${position}`, name: `Role ${position}`, color: null, managed: false, position })),
        channels: [0, 1].map((position) => ({ id: `${id}-channel-${position}`, name: `channel-${position}`, type: "text", parentId: null, position })),
      },
      config: { Applications: { applications: [{ id: "existing-global-form", name: "Existing form" }] }, Department: { profiles: [] } },
      members: Array.from({ length: 8 }, (_, position) => ({ id: String(BigInt(viewer) + BigInt(position)), name: `Member ${position}`, username: `member_${position}`, display_name: `Member ${position}`, avatar: "/icon.svg", roles: [] })),
    };
    const departments = createDepartmentFixtures(base, index);
    state.guilds[id] = { ...base, departments, management: { audit: [], responses: [] } } as PreviewState["guilds"][string];
  }
  return state;
}

function call(state: PreviewState, endpoint: string, body: Record<string, any> = {}, params: Record<string, string> = {}, method = "POST"): PreviewReply {
  const result = handleDepartmentRequest(state, { endpoint, method, params: { server, user: viewer, ...params }, body: { user: viewer, ...body } });
  assert.ok(result, `Expected ${endpoint} to be handled`);
  return result;
}

function action(state: PreviewState, body: Record<string, any>): any {
  const result = call(state, "dashboard_departmentaction", { department_id: "department-1", ...body });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}

function payload(state: PreviewState): any { return departmentPayload(state, server, "department-1")!; }
function data(result: PreviewReply): any { return result.data; }

test("three department seeds are useful, isolated, and keep existing applications", () => {
  const state = fixtureState();
  const secondVisitor = fixtureState();
  for (const guild of Object.values(state.guilds)) {
    const department = guild.departments.records[0];
    const projection = departmentPayload(state, guild.id, department.profile.id)!;
    assert.equal(projection.rosters[0].members, 6);
    assert.equal(projection.feature.activity.required_hours, 4);
    assert.equal(projection.resources.length, 3);
    assert.equal(projection.responses.filter((response: any) => !response.status).length, 1);
    assert.ok(projection.rosters[0].memberRows.some((member: any) => member.rankRoleId === null));
    assert.equal(guild.config.Applications.applications[0].id, "existing-global-form");
    assert.equal(guild.config.Department.profiles[0].id, department.profile.id);
  }
  action(state, { action: "roster_cell", member_id: viewer, column_id: "callsign", value: "CHANGED" });
  assert.equal(payload(state).rosters[0].memberRows[0].columns.callsign, "CHANGED");
  assert.equal(payload(secondVisitor).rosters[0].memberRows[0].columns.callsign, "OPS-10");
  assert.equal(departmentPayload(state, "100000000000000102", "department-2")!.rosters[0].memberRows[0].columns.callsign, "OPS-10");
  const membership = data(call(state, "dashboard_mydepartments", {}, { server: "" }, "GET"));
  assert.equal(membership.departments.length, 3);
  assert.equal(membership.departments[0].parentGuildId, server);
  assert.equal(membership.departments[0].parentId, server);
  assert.equal(payload(state).network.linked[0].id, "100000000000000102");
});

test("roster changes, membership review, co-owner access and invalid bulk writes persist correctly", () => {
  const state = fixtureState();
  const department = state.guilds[server].departments.records[0];
  const unranked = department.members[5].id;
  action(state, { action: "rank", member_ids: [unranked], role_id: "department-1-member", ignore_discord_role_sync: true });
  assert.equal(payload(state).rosters[0].memberRows[5].rankName, "Member");
  const before = structuredClone(department.members);
  const invalid = call(state, "dashboard_departmentaction", { department_id: "department-1", action: "rank", member_ids: [unranked, "missing"], role_id: "department-1-lead" });
  assert.equal(invalid.status, 400);
  assert.deepEqual(department.members, before);
  action(state, { action: "owner_update", member_ids: [unranked], enabled: true });
  assert.equal(department.members[5].owner, "co");
  assert.ok(state.guilds[server].config.Department.profiles[0].manager_ids.includes(unranked));
  action(state, { action: "owner_update", member_ids: [unranked], enabled: false });
  action(state, { action: "remove", member_ids: [unranked] });
  assert.equal(payload(state).rosters[0].members, 5);
  const applicant = department.requests[0].id;
  const submission = data(call(state, "dashboard_membersubmission", {}, { department: "department-1", member: applicant }, "GET"));
  assert.equal(submission.found, true);
  assert.ok(submission.submission.answers.interest);
  action(state, { action: "membership_accept", member_id: applicant });
  assert.ok(payload(state).rosters[0].memberRows.some((member: any) => member.id === applicant && member.rankName === "Member"));
  assert.equal(department.requests.length, 0);
});

test("activity accrues duty time, excludes breaks, and preserves completed history", (context) => {
  let now = Date.parse("2026-10-18T12:00:00Z");
  context.mock.method(Date, "now", () => now);
  const state = fixtureState();
  const initial = payload(state).activity.viewer.seconds;
  action(state, { action: "shift_break" });
  now += 10 * 60_000;
  assert.equal(payload(state).activity.viewer.seconds, initial);
  assert.equal(payload(state).activity.viewer.activeShift.onBreak, true);
  action(state, { action: "shift_break" });
  now += 5 * 60_000;
  assert.equal(payload(state).activity.viewer.seconds, initial + 300);
  action(state, { action: "shift_end" });
  now += 5 * 60_000;
  assert.equal(payload(state).activity.viewer.activeShift, null);
  assert.equal(payload(state).activity.viewer.seconds, initial + 300);
  action(state, { action: "shift_start" });
  assert.equal(call(state, "dashboard_departmentaction", { department_id: "department-1", action: "shift_start" }).status, 409);
  action(state, { action: "shift_end" });
  assert.ok(payload(state).activity.waves.length >= 2);
});

test("announcements preserve attachment, visibility, replies, mentions and scheduled delivery", (context) => {
  let now = Date.parse("2026-10-18T12:00:00Z");
  context.mock.method(Date, "now", () => now);
  const state = fixtureState();
  const result = action(state, { action: "announcement_post", content: "A test update", attachment: { name: "proof.svg", type: "image/svg+xml", data: "/icon.svg" }, resource_id: "department-1-handbook", visibility: "roles", visibility_role_ids: ["department-1-member"], visibility_user_ids: [], mention_user_ids: [viewer], reply_to: "department-1-welcome", scheduled_for: new Date(now + 60_000).toISOString() });
  const announcement = payload(state).announcements.find((item: any) => item.id === result.announcement.id);
  assert.equal(announcement.attachment.name, "proof.svg");
  assert.equal(announcement.reply_to, "department-1-welcome");
  assert.deepEqual(announcement.mention_user_ids, [viewer]);
  assert.equal(result.dm.targets, 0);
  assert.equal(announcement.delivered_at, null);
  now += 61_000;
  assert.ok(payload(state).announcements.find((item: any) => item.id === announcement.id).delivered_at);
  action(state, { action: "announcement_delete", id: announcement.id });
  assert.ok(!payload(state).announcements.some((item: any) => item.id === announcement.id));
});

test("leave requests honor settings and review changes the same roster", (context) => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  context.mock.method(Date, "now", () => now);
  const state = fixtureState();
  const department = state.guilds[server].departments.records[0];
  const invalid = call(state, "dashboard_departmentaction", { department_id: department.profile.id, action: "loa_request", reason: "", starts_at: new Date(now).toISOString(), ends_at: null });
  assert.equal(invalid.status, 400);
  action(state, { action: "loa_request", reason: "Taking a break", starts_at: new Date(now - 60_000).toISOString(), ends_at: new Date(now + 2 * day).toISOString() });
  const leave = payload(state).viewerLoas[0];
  assert.equal(leave.status, "pending");
  action(state, { action: "loa_review", id: leave.id, approve: true });
  assert.equal(payload(state).rosters[0].memberRows.find((member: any) => member.id === viewer).onLoa, true);
  action(state, { action: "loa_end", id: leave.id });
  assert.equal(payload(state).rosters[0].memberRows.find((member: any) => member.id === viewer).onLoa, false);
  call(state, "dashboard_departmentfeature", { department_id: department.profile.id, feature: { loa: { require_reason: false, require_end_date: false } } });
  action(state, { action: "loa_request", reason: "", starts_at: new Date(now).toISOString(), ends_at: null });
  action(state, { action: "loa_review", id: payload(state).viewerLoas[0].id, approve: false });
  assert.equal(payload(state).viewerLoas[0].status, "denied");
});

test("infractions and immediate/scheduled promotions update real member projections", (context) => {
  let now = Date.parse("2026-10-18T12:00:00Z");
  context.mock.method(Date, "now", () => now);
  const state = fixtureState();
  const memberId = state.guilds[server].departments.records[0].members[5].id;
  action(state, { action: "infract", member_ids: [memberId], reason: "Missed session", points: 3, expires_in_days: 1, proof: ["/icon.svg"] });
  assert.equal(payload(state).rosters[0].memberRows[5].points, 3);
  const infraction = payload(state).infractions.find((item: any) => item.member_id === memberId);
  assert.deepEqual(infraction.proof, ["/icon.svg"]);
  action(state, { action: "infraction_delete", infraction_id: infraction.id });
  assert.equal(payload(state).rosters[0].memberRows[5].points, 0);
  action(state, { action: "promotion_create", member_ids: [memberId], to_rank_id: "department-1-member", kind: "promote", create_shout: true, shout_message: "Welcome aboard", dm_members: true, scheduled_for: null });
  assert.equal(payload(state).rosters[0].memberRows[5].rankName, "Member");
  action(state, { action: "promotion_create", member_ids: [memberId], to_rank_id: "department-1-senior", kind: "promote", create_shout: true, dm_members: true, scheduled_for: new Date(now + 60_000).toISOString() });
  assert.equal(payload(state).rosters[0].memberRows[5].rankName, "Member");
  now += 61_000;
  assert.equal(payload(state).rosters[0].memberRows[5].rankName, "Senior Member");
  assert.ok(payload(state).announcements.some((item: any) => item.content === "Welcome aboard"));
});

test("wave actions validate overlap, edit/cancel schedules, and start/end/reset waves", (context) => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  context.mock.method(Date, "now", () => now);
  const state = fixtureState();
  assert.equal(call(state, "dashboard_departmentaction", { department_id: "department-1", action: "wave_schedule", name: "Overlap", starts_at: new Date(now + day).toISOString(), ends_at: new Date(now + 2 * day).toISOString() }).status, 409);
  action(state, { action: "wave_update", wave_id: "department-1-wave-next", name: "Next events", starts_at: new Date(now + 6 * day).toISOString(), ends_at: new Date(now + 12 * day).toISOString(), shift_type: "Event" });
  assert.equal(payload(state).activity.scheduledWaves[0].name, "Next events");
  action(state, { action: "wave_cancel", wave_id: "department-1-wave-next" });
  action(state, { action: "wave_schedule", name: "Future events", starts_at: new Date(now + 6 * day).toISOString(), ends_at: new Date(now + 7 * day).toISOString(), shift_type: "Event" });
  action(state, { action: "wave_end", wave_id: "department-1-wave-current" });
  action(state, { action: "wave_start", name: "New wave", ends_at: new Date(now + day).toISOString(), shift_type: "" });
  assert.equal(payload(state).activity.wave.name, "New wave");
  action(state, { action: "waves_reset" });
  assert.equal(payload(state).activity.waves.length, 0);
  assert.equal(payload(state).activity.activeShifts.length, 0);
});

test("resource save, reader, history, restore and sharing use one canonical record", () => {
  const state = fixtureState();
  const original = state.guilds[server].departments.resources[0];
  const updated = { ...structuredClone(original), title: "Updated handbook", document_html: "<h1>Changed</h1>", share: { access: "restricted", entries: [{ type: "user", id: viewer }] } };
  assert.equal(call(state, "dashboard_deptresources", { action: "save", resource: updated }).status, 200);
  let reader = data(call(state, "dashboard_deptdocument", {}, { resource: original.id }, "GET"));
  assert.equal(reader.resource.title, "Updated handbook");
  assert.equal(reader.can_edit, false);
  const history = data(call(state, "dashboard_resource_versions", {}, { resource: original.id }, "GET")).versions;
  assert.equal(history[0].title, "Team handbook");
  assert.ok(!("content" in history[0]));
  assert.equal(call(state, "dashboard_resource_version_restore", { resource: original.id, version: history[0].id }).status, 200);
  reader = data(call(state, "dashboard_deptdocument", {}, { resource: original.id }, "GET"));
  assert.equal(reader.resource.title, "Team handbook");
  assert.equal(reader.resource.share.access, "restricted");
  assert.equal(reader.resource.share.entries[0].id, viewer);
  assert.equal(payload(state).resources.find((item: any) => item.id === original.id).title, "Team handbook");
  const publicData = data(call(state, "dashboard_departmentpublic", {}, { department: "department-1" }, "GET"));
  assert.ok(!publicData.documents.some((item: any) => item.id === original.id));
  assert.ok(publicData.documents.some((item: any) => item.kind === "spreadsheet"));
  assert.equal(call(state, "dashboard_deptresources", { action: "delete", id: original.id }).status, 200);
  assert.equal(call(state, "dashboard_deptdocument", {}, { resource: original.id }, "GET").status, 404);
});

test("spreadsheet operation cursors, snapshots, presence, forms and review work without a bot", () => {
  const state = fixtureState();
  const sheet = structuredClone(state.guilds[server].departments.resources[1]);
  action(state, { action: "spreadsheet_op", resource_id: sheet.id, client_id: "first", ops: [{ id: "sheet.mutation.set-range-values", params: { value: "Edited cell" } }] });
  const other = data(call(state, "dashboard_deptsheetops", {}, { resource: sheet.id, since: "0", client: "second" }, "GET"));
  assert.equal(other.cursor, 1);
  assert.equal(other.ops[0].ops[0].params.value, "Edited cell");
  assert.equal(data(call(state, "dashboard_deptsheetops", {}, { resource: sheet.id, since: "0", client: "first" }, "GET")).ops.length, 0);
  sheet.spreadsheet_data[1][2] = "Done";
  sheet.spreadsheet_snapshot = { sheets: { main: { cellData: { 1: { 2: { v: "Done" } } } } }, sheetOrder: ["main"] };
  call(state, "dashboard_deptresources", { action: "save", resource: sheet });
  assert.equal(data(call(state, "dashboard_deptdocument", {}, { resource: sheet.id }, "GET")).resource.spreadsheet_snapshot.sheets.main.cellData[1][2].v, "Done");
  assert.deepEqual(data(call(state, "dashboard_deptresources", { action: "presence", id: sheet.id, typing: true })).presence, []);
  const formId = "department-1-feedback";
  const response = data(call(state, "dashboard_deptresources", { action: "submit", id: formId, answers: { interest: "Helpful session", availability: "weekends" } })).response;
  assert.equal(response.status, null);
  call(state, "dashboard_deptresources", { action: "review", id: response.id, status: "approved", note: "Thanks for your feedback" });
  const saved = payload(state).responses.find((item: any) => item.id === response.id);
  assert.equal(saved.review_note, "Thanks for your feedback");
  assert.equal(saved.status, "approved");
});

test("join codes, leave/rejoin, application gating and shared decisions update membership", () => {
  const state = fixtureState();
  const department = state.guilds[server].departments.records[0];
  assert.equal(data(call(state, "dashboard_departmentjoinpreview", {}, { server: "0", code: "preview1" }, "GET")).state, "member");
  action(state, { action: "membership_leave" });
  assert.equal(data(call(state, "dashboard_mydepartments", {}, { server: "" }, "GET")).departments.length, 2);
  const result = call(state, "dashboard_departmentjoin", { code: "PREVIEW1" }, { server: "0" });
  assert.equal(data(result).state, "requested");
  action(state, { action: "membership_deny", member_id: viewer });
  department.profile.application_id = "department-1-application";
  const gate = data(call(state, "dashboard_departmentjoin", { code: "PREVIEW1" }, { server: "0" }));
  assert.equal(gate.state, "application_required");
  const response = { applicationId: gate.application.id, userId: viewer, userName: "Member 0", userHandle: "member_0", answers: { interest: "I'd like to help", availability: "weekends" }, createdAt: new Date().toISOString() };
  recordDepartmentApplication(state, server, response);
  assert.ok(department.requests.some((item) => item.id === viewer));
  decideDepartmentApplication(state, server, response, true);
  assert.ok(department.members.some((item) => item.id === viewer));
  assert.ok(!department.requests.some((item) => item.id === viewer));
  call(state, "dashboard_departmentjoin", { action: "set_code", department_id: "department-1", code: "TEAMNEW" });
  assert.equal(call(state, "dashboard_departmentjoinpreview", {}, { server: "0", code: "PREVIEW1" }, "GET").status, 404);
  assert.equal(data(call(state, "dashboard_departmentjoinpreview", {}, { server: "0", code: "TEAMNEW" }, "GET")).department.id, "department-1");
});

test("legacy join forms create reviewable requests and approval adds the same member", () => {
  const state = fixtureState();
  const department = state.guilds[server].departments.records[0];
  action(state, { action: "membership_leave" });
  department.profile.application_id = "department-1-feedback";
  const gate = data(call(state, "dashboard_departmentjoin", { code: "PREVIEW1" }, { server: "0" }));
  assert.equal(gate.state, "application_required");
  assert.equal(gate.application.source, "legacy");
  const response = data(call(state, "dashboard_deptresources", { action: "submit", id: gate.application.id, answers: { interest: "Ready to help", availability: "weekends" } })).response;
  assert.equal(response.join_request, true);
  assert.ok(department.requests.some((item) => item.id === viewer));
  assert.equal(department.submissions[viewer].answers.interest, "Ready to help");
  call(state, "dashboard_deptresources", { action: "review", id: response.id, status: "approved", note: "Welcome" });
  assert.ok(department.members.some((item) => item.id === viewer));
  assert.ok(!department.requests.some((item) => item.id === viewer));
});

test("settings, scoped application patches, actions, unlink and deletion stay within their guild", () => {
  const state = fixtureState();
  call(state, "dashboard_departmentfeature", { department_id: "department-1", feature: { activity: { required_hours: 6 } }, profile: { name: "Operations", id: "forbidden" } });
  assert.equal(payload(state).feature.activity.required_hours, 6);
  assert.equal(payload(state).profiles[0].id, "department-1");
  assert.equal(state.guilds[server].config.Department.profiles[0].name, "Operations");
  const config = data(call(state, "dashboard_departmentappconfig", {}, { department: "department-1" }, "GET")).config;
  const departmentApp = structuredClone(config.Applications.applications.find((item: any) => item.department_id === "department-1"));
  departmentApp.name = "Updated department application";
  call(state, "dashboard_departmentappconfig", { set: { "Applications.applications": [departmentApp], "Modules.Applications": true }, unset: ["Modules.Unused"] }, { department: "department-1" }, "PATCH");
  assert.equal(state.guilds[server].config.Applications.applications[0].id, "existing-global-form");
  assert.equal(payload(state).applications[0].name, departmentApp.name);
  const before = structuredClone(state.guilds[server].config);
  assert.equal(call(state, "dashboard_departmentappconfig", { set: { "Modules.Applications": false, "__proto__.polluted": true } }, { department: "department-1" }, "PATCH").status, 400);
  assert.deepEqual(state.guilds[server].config, before);
  action(state, { action: "execute", action_id: "department-1-handover", answers: { summary: "All sessions completed", followup: "no" } });
  assert.equal(payload(state).actionExecutions[0].answers.summary, "All sessions completed");
  call(state, "dashboard_departmentlink", { action: "unlink", guild_id: "100000000000000102" });
  assert.equal(payload(state).network.linked.length, 0);
  assert.ok(state.guilds[server].management.audit.length >= 4);
  action(state, { action: "department_delete" });
  assert.equal(call(state, "dashboard_departments", {}, { department: "department-1" }, "GET").status, 404);
  assert.equal(state.guilds["100000000000000102"].departments.records.length, 1);
  assert.equal(handleDepartmentRequest(state, { endpoint: "unknown_endpoint", method: "POST", params: {}, body: {} }), undefined);
});

test("public department pages resolve the configured public slug", () => {
  const state = fixtureState();
  call(state, "dashboard_departmentfeature", { department_id: "department-1", feature: { public_page: { slug: "operations-team" } } });
  const bySlug = call(state, "dashboard_departmentpublic", {}, { department: "operations-team" }, "GET");
  assert.equal(bySlug.status, 200);
  assert.equal(data(bySlug).department.id, "department-1");
  assert.equal(call(state, "dashboard_departmentpublic", {}, { department: "missing-slug" }, "GET").status, 404);
});

test("public department links follow the displayed department name, including after a rename", () => {
  const state = fixtureState();
  for (const [index, slug] of ["community-operations", "event-team", "member-support"].entries()) {
    const serverId = String(BigInt(server) + BigInt(index));
    const result = call(state, "dashboard_departmentpublic", {}, { server: serverId, department: slug }, "GET");
    assert.equal(result.status, 200);
    assert.equal(data(result).department.id, `department-${index + 1}`);
  }
  call(state, "dashboard_departmentfeature", { department_id: "department-1", profile: { name: "  Community & Events!  " } });
  const renamed = call(state, "dashboard_departmentpublic", {}, { department: "community-events" }, "GET");
  assert.equal(renamed.status, 200);
  assert.equal(data(renamed).department.id, "department-1");
});
