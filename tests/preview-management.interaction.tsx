import assert from "node:assert/strict";
import test from "node:test";
import { createManagementFixtures, handleManagementRequest } from "../src/preview/management";
import type { PreviewGuildBase, PreviewRequest, PreviewState } from "../src/preview/types";
import { createPreviewState } from "../src/preview/seed";
import { dispatchPreview } from "../src/preview/dispatch";
import { mapPreviewRoute } from "../src/preview/routes";

const guildIds = ["100000000000000101", "100000000000000102", "100000000000000103"];

function base(index: number): PreviewGuildBase {
  const id = guildIds[index];
  return {
    id,
    info: { id, name: `Test server ${index + 1}`, icon: null, owner: true, permissions: "8" } as PreviewGuildBase["info"],
    meta: {
      guild: { id, name: `Test server ${index + 1}`, icon: null, memberCount: 20, ownerId: "100000000000000001", createdAt: "2020-01-01T00:00:00Z", premiumTier: 1, boostCount: 2 },
      me: { id: "100000000000000001", isAdmin: true, isOwner: true },
      roles: [{ id: `${id}1`, name: "Staff", color: "#f7a8c4", position: 1, managed: false }, { id: `${id}2`, name: "Member", color: null, position: 0, managed: false }],
      channels: [{ id: `${id}3`, name: "announcements", type: "text", parentId: null, position: 0 }, { id: `${id}4`, name: "review", type: "text", parentId: null, position: 1 }],
      modules: { Tickets: true, Applications: true, GatorAI: true, Shifts: true },
    },
    config: { Modules: { Tickets: true, Applications: true, GatorAI: true, Shifts: true }, Integrations: { PRC: { has_key: index === 0 } }, Applications: { applications: [{ id: "existing", name: "Existing form" }] } },
    members: [{ id: "100000000000000001", name: "Preview developer", username: "developer", display_name: "Preview developer", avatar: null, roles: [`${id}1`] }, { id: `${id}5`, name: "Alex Morgan", username: "alex", display_name: "Alex Morgan", avatar: null, roles: [`${id}2`] }],
  };
}

function setup(): PreviewState {
  const state: PreviewState = { guilds: {}, sequence: 100, account: {} as PreviewState["account"] };
  for (let index = 0; index < 3; index++) {
    const guild = base(index);
    state.guilds[guild.id] = { ...guild, management: createManagementFixtures(guild, index), departments: { records: [], resources: [], responses: [], versions: {}, sheetOps: {} } };
  }
  return state;
}

function call(state: PreviewState, endpoint: string, body: Record<string, any> = {}, params: Record<string, string> = {}, method = "POST") {
  const request: PreviewRequest = { endpoint, method, body, params: { server: guildIds[0], ...params } };
  const result = handleManagementRequest(state, request);
  assert.ok(result, `No handler for ${endpoint}`);
  return result as { status: number; data: any };
}

test("preview editor seeds retain existing applications and isolate servers and visitors", () => {
  const state = setup();
  const otherVisitor = setup();
  assert.equal(state.guilds[guildIds[0]].config.Applications.applications[0].id, "existing");
  assert.equal(state.guilds[guildIds[0]].config.Applications.applications.length, 2);
  const message = { content: "Edited", embeds: [{ title: "One" }, { title: "Two" }], v2_explicit_layout: true, v2_layout: [{ type: "text", content: "Outside" }] };
  call(state, "dashboard_messages", { type: "welcome", data: message });
  message.content = "Outside mutation";
  const read = call(state, "dashboard_messages", {}, { type: "welcome" }, "GET");
  assert.equal(read.data.message.content, "Edited");
  assert.equal(read.data.message.embeds.length, 2);
  read.data.message.content = "Response mutation";
  assert.equal(state.guilds[guildIds[0]].management.messages.welcome!.content, "Edited");
  assert.notEqual(state.guilds[guildIds[1]].management.messages.welcome!.content, "Edited");
  assert.notEqual(otherVisitor.guilds[guildIds[0]].management.messages.welcome!.content, "Edited");
});

test("templates round-trip container text and explicit layouts, then delete locally", () => {
  const state = setup();
  call(state, "dashboard_templates", { action: "save", type: "container", name: "Local card", content: "Above", color: "5865f2", layout: [{ type: "text", content: "Outside" }] });
  const template = call(state, "dashboard_templates", {}, {}, "GET").data.containers.find((entry: any) => entry.name === "Local card");
  assert.equal(template.content, "Above");
  assert.equal(template.layout[0].type, "text");
  call(state, "dashboard_templates", { action: "send", type: "container", name: "Local card", channel_id: "channel" });
  assert.equal(state.guilds[guildIds[0]].management.deliveries[0].simulated, true);
  call(state, "dashboard_templates", { action: "delete", type: "container", name: "Local card" });
  assert.equal(state.guilds[guildIds[0]].management.templates.containers.some((entry) => entry.name === "Local card"), false);
});

test("ticket creation, field changes and renaming preserve the panel's subject references", () => {
  const state = setup();
  call(state, "dashboard_ticketpanels", { action: "create", type: "single", name: "Billing" });
  assert.equal(call(state, "dashboard_ticketpanels", { action: "create", type: "single", name: "Billing" }).status, 400);
  call(state, "dashboard_ticketpanels", { action: "update", type: "multi", name: "Support desk", set: { Panels: ["Billing"] } });
  call(state, "dashboard_ticketpanels", { action: "update", type: "single", name: "Billing", set: { rename: "Account help", Questions: [{ label: "Question", kind: "select", max_values: 1, options: [{ label: "A" }] }] } });
  const panels = call(state, "dashboard_panels", {}, {}, "GET").data.panels;
  assert.deepEqual(panels.find((entry: any) => entry.type === "multi").Panels, ["Account help"]);
  assert.equal(panels.find((entry: any) => entry.name === "Account help").Questions[0].max_values, 1);
  call(state, "dashboard_ticketpanels", { action: "delete", type: "single", name: "Account help" });
  assert.equal(state.guilds[guildIds[0]].management.panels.some((entry) => entry.name === "Account help"), false);
  assert.deepEqual(state.guilds[guildIds[0]].management.panels.find((entry) => entry.type === "multi")!.Panels, []);
});

test("command rename, responder edit, QOTD, role links and profile changes persist", () => {
  const state = setup();
  call(state, "dashboard_customcommands", { action: "save", original_name: "welcome", command: { name: "hello", content: "Hi", embed: {}, command_options: [], components: [] } });
  assert.deepEqual(call(state, "dashboard_customcommands", {}, {}, "GET").data.commands.map((entry: any) => entry.name), ["hello"]);
  call(state, "dashboard_autoresponders", { action: "upsert", original_trigger: "how do I apply", trigger: "apply", response_message: { content: "Application updated" }, response: "Application updated" });
  assert.equal(call(state, "dashboard_autoresponders", {}, {}, "GET").data.responders[0].trigger, "apply");
  call(state, "dashboard_qotd", { set: { qotdthread: false } });
  assert.equal(call(state, "dashboard_qotd", {}, {}, "GET").data.qotd.qotdthread, false);
  call(state, "dashboard_connectionroles", { action: "add", parent: "granted", child: "trigger" });
  assert.ok(state.guilds[guildIds[0]].management.connections.some((entry) => entry.parent === "granted" && entry.child === "trigger"));
  call(state, "dashboard_connectionroles", { action: "remove", parent: "granted", child: "trigger" });
  assert.equal(state.guilds[guildIds[0]].management.connections.some((entry) => entry.parent === "granted"), false);
  const dataUrl = "data:image/png;base64,aGVsbG8=";
  call(state, "dashboard_botprofile", { display_name: "Local helper", avatar: dataUrl });
  assert.equal(call(state, "dashboard_botprofile", {}, {}, "GET").data.profile.avatar, dataUrl);
  call(state, "dashboard_botprofile", { reset_fields: ["avatar"] });
  assert.equal(call(state, "dashboard_botprofile", {}, {}, "GET").data.profile.avatar, "/icon.svg");
  assert.equal(call(state, "dashboard_media", { image: dataUrl }).data.url, dataUrl);
});

test("application decisions share the response store, stage, publish and delete", () => {
  const state = setup();
  const fixture = state.guilds[guildIds[0]].management;
  const pending = fixture.responses[0];
  const application = pending.applicationId;
  fixture.responses.push({ id: "new-public-submission", applicationId: application, status: "pending", answers: {} });
  assert.equal(call(state, "dashboard_application_responses", {}, { application }, "GET").data.responses.length, 5);
  call(state, "dashboard_application_decision", { id: pending.id, decision: "approve" });
  assert.equal(pending.status, "staged_approved");
  const bulk = call(state, "dashboard_application_decision_bulk", { ids: ["new-public-submission", "missing"], decision: "deny", reason: "Training first" });
  assert.equal(bulk.data.failed[0].id, "missing");
  assert.equal(fixture.responses.find((entry) => entry.id === "new-public-submission")!.status, "staged_denied");
  call(state, "dashboard_application_publish_staged", { application });
  assert.equal(pending.status, "approved");
  call(state, "dashboard_application_response_delete", { id: pending.id });
  assert.equal(fixture.responses.some((entry) => entry.id === pending.id), false);
});

test("Assistant examples and knowledge edits are local and update their related lists", () => {
  const state = setup();
  const fixture = state.guilds[guildIds[0]].management;
  call(state, "dashboard_gatorai", { settings: { known_issue: "Test issue", cooldown_seconds: 1 } });
  assert.equal(call(state, "dashboard_gatorai", {}, {}, "GET").data.settings.cooldown_seconds, 30);
  call(state, "dashboard_aigaps", { action: "answer", id: fixture.gaps[0].id, answer: "Training is Saturday." });
  assert.equal(fixture.gaps.length, 0);
  const added = fixture.knowledge.at(-1)!;
  call(state, "dashboard_aicontext", { action: "edit", index: added.index, text: "Training moved to Sunday.", always: true });
  assert.equal(fixture.knowledge.at(-1)!.text, "Training moved to Sunday.");
  call(state, "dashboard_aicontext", { action: "delete", index: added.index });
  assert.equal(fixture.knowledge.some((entry) => entry.index === added.index), false);
  const suggestion = call(state, "dashboard_customcommand_ai", { prompt: "Explain the schedule" });
  assert.equal(suggestion.data.simulated, true);
  assert.match(suggestion.data.suggestion.content, /Preview suggestion/);
});

test("workflows use real graph validation and retain save, run, history and delete state", () => {
  const state = setup();
  const fixture = state.guilds[guildIds[0]].management;
  const graph = fixture.automations[0].graph;
  assert.deepEqual(call(state, "dashboard_automations", { action: "validate", graph }).data.issues, []);
  const saved = call(state, "dashboard_automations", { action: "upsert", name: "Local workflow", graph, enabled: true, cooldown_seconds: 15 });
  assert.equal(saved.status, 200);
  const id = saved.data.id;
  const run = call(state, "dashboard_automations", { action: "run", id });
  assert.match(run.data.notes[0], /No Discord or bot actions/);
  assert.equal(fixture.runs[0].automation_id, id);
  const invalid = { nodes: [{ id: "bad", type: "not-supported", x: 0, y: 0 }], edges: [] };
  assert.equal(call(state, "dashboard_automations", { action: "validate", graph: invalid }).data.valid, false);
  assert.equal(call(state, "dashboard_automations", { action: "upsert", name: "Invalid", graph: invalid, enabled: true }).status, 400);
  assert.equal(call(state, "dashboard_automations", { action: "upsert", name: "Draft", graph: invalid, enabled: false }).status, 200);
  call(state, "dashboard_automations", { action: "delete", id });
  assert.equal(fixture.automations.some((entry) => entry._id === id), false);
  assert.equal(call(state, "dashboard_prcserver", {}, { server: guildIds[1] }, "GET").data.linked, false);
});

test("staff actions and simulated delivery affect only the chosen test server", () => {
  const state = setup();
  const fixture = state.guilds[guildIds[0]].management;
  const member = fixture.staff[0].id;
  call(state, "dashboard_staffaction", { action: "end_shift", member });
  assert.equal(call(state, "dashboard_staffmember", {}, { member }, "GET").data.member.on_duty, false);
  call(state, "dashboard_staffaction", { action: "add_note", member, note: "Practice review" });
  assert.equal(fixture.staff[0].notes.at(-1).text, "Practice review");
  assert.equal(state.guilds[guildIds[1]].management.staff[0].on_duty, true);
  call(state, "dashboard_sessionpanel", { channel: "channel" });
  assert.equal(fixture.deliveries[0].simulated, true);
  assert.equal(call(state, "dashboard_prcserver", {}, {}, "GET").data.server.joinCode, "PREVIEW");
});

test("the real route mapping reaches command suggestions and shared public-to-review application state", () => {
  const state = createPreviewState();
  const request = (path: string, method = "GET", body: Record<string, any> = {}) => {
    const mapped = mapPreviewRoute(path, method, new URLSearchParams(), body);
    assert.ok(mapped);
    return dispatchPreview(state, mapped.request) as { status: number; data: any };
  };
  const suggestion = request(`/api/manage/${guildIds[0]}/customcommandai`, "POST", { prompt: "Share the rules" });
  assert.equal(suggestion.status, 200);
  assert.equal(suggestion.data.simulated, true);
  const application = state.guilds[guildIds[0]].config.Applications.applications.find((entry: any) => entry.id === "staff-application-1");
  const submitted = request(`/api/application/${guildIds[0]}/${application.id}`, "POST", { answers: { experience: "I enjoy helping members.", availability: "both", ready: "true" } });
  assert.equal(submitted.status, 200);
  const record = state.guilds[guildIds[0]].management.responses.find((entry) => entry.id === submitted.data.id)!;
  assert.equal(record.userId, "100000000000000001");
  assert.equal(record.status, "pending");
  assert.equal(request(`/api/manage/${guildIds[0]}/applicationdecision`, "POST", { id: record.id, decision: "approve" }).status, 200);
  assert.equal(record.status, "staged_approved");
  assert.equal(request(`/api/manage/${guildIds[0]}/applicationpublishstaged`, "POST", { application: application.id }).status, 200);
  assert.equal(record.status, "approved");
  assert.equal(state.guilds[guildIds[0]].management.messages.Infractions!.render_mode, "legacy");
});

test("department application staging waits for publish before updating membership", () => {
  const state = createPreviewState();
  const guild = state.guilds[guildIds[0]];
  const department = guild.departments.records[0];
  const application = guild.config.Applications.applications.find((entry: any) => entry.department_id === department.profile.id);
  application.staging_pipeline = true;
  const applicant = department.requests[0];
  const response = { id: "department-review", applicationId: application.id, userId: applicant.id, userName: applicant.name, answers: { interest: "I enjoy helping members.", availability: "weekends" }, status: "pending" };
  guild.management.responses.push(response);
  assert.equal(department.members.some((member) => member.id === applicant.id), false);
  call(state, "dashboard_application_decision", { id: response.id, decision: "approve" });
  assert.equal(response.status, "staged_approved");
  assert.equal(department.members.some((member) => member.id === applicant.id), false);
  call(state, "dashboard_application_publish_staged", { application: application.id });
  assert.equal(response.status, "approved");
  assert.equal(department.members.some((member) => member.id === applicant.id), true);
  assert.equal(department.requests.some((member) => member.id === applicant.id), false);
});

test("department review routes filter the shared responses and reject an unrelated submission", () => {
  const state = createPreviewState();
  const guild = state.guilds[guildIds[0]];
  const department = guild.departments.records[0];
  const application = guild.config.Applications.applications.find((entry: any) => entry.department_id === department.profile.id);
  const entry = { id: "scoped-review", applicationId: application.id, userId: "100000000000000099", userName: "New applicant", status: "pending", answers: {} };
  guild.management.responses.push(entry);
  const read = mapPreviewRoute(`/api/departments/${guild.id}/${department.profile.id}/applicationresponses`, "GET", new URLSearchParams({ application: application.id }), {});
  assert.ok(read);
  assert.deepEqual((dispatchPreview(state, read.request).data as any).responses.map((item: any) => item.id), [entry.id]);
  const own = call(state, "dashboard_departmentappdecision", { id: entry.id, decision: "approve" }, { department: department.profile.id });
  assert.equal(own.status, 200);
  assert.equal(entry.status, "approved");
  const other = call(state, "dashboard_departmentappdecision", { id: guild.management.responses[0].id, decision: "deny" }, { department: department.profile.id });
  assert.equal(other.status, 404);
});
