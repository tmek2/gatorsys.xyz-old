import type { PreviewGuildBase, PreviewReply, PreviewRequest, PreviewState } from "./types";
import { RUNNABLE_STEPS, RUNNABLE_TRIGGERS, graphToAutomation } from "../components/Manage/workflow/serialize";
import { workflowIssues } from "../components/Manage/workflow/validation";
import type { WorkflowGraph } from "../components/Manage/workflow/workflow-canvas";
import { MODULE_SECTIONS } from "../components/Manage/schema";
import { decideDepartmentApplication } from "./departments";
import { PREVIEW_SESSION, PREVIEW_USER_ID } from "./identity";

type Fixture = Record<string, any>;
type TemplateKind = "embeds" | "containers" | "forms" | "messages";

export interface ManagementFixtures {
  messages: Record<string, Fixture | null>;
  templates: Record<TemplateKind, Fixture[]>;
  panels: Fixture[];
  commands: Fixture[];
  responders: Fixture[];
  responses: Fixture[];
  qotd: Fixture;
  profile: Fixture;
  assistant: Fixture;
  knowledge: Fixture[];
  gaps: Fixture[];
  connections: Fixture[];
  infractionTypes: Fixture[];
  automations: Fixture[];
  runs: Fixture[];
  audit: Fixture[];
  deliveries: Fixture[];
  staff: Fixture[];
}

const copy = <T>(value: T): T => structuredClone(value);
const reply = (data: unknown, status = 200): PreviewReply => ({ status, data: copy(data) });
const reject = (detail: string, status = 400) => reply({ detail, message: detail }, status);
const now = () => new Date().toISOString();
const stamp = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
const supported = [...new Set([...RUNNABLE_TRIGGERS, ...RUNNABLE_STEPS])];

function sampleGraph(channel: string, text: string): WorkflowGraph {
  return {
    nodes: [
      { id: "event", type: "manual", x: 80, y: 80 },
      { id: "send", type: "send", x: 480, y: 80, values: { channel, text } },
    ],
    edges: [{ id: "start", from: { node: "event", port: "next" }, to: { node: "send", port: "in" } }],
  };
}

export function createManagementFixtures(base: PreviewGuildBase, index: number): ManagementFixtures {
  const textChannels = base.meta.channels.filter((channel) => channel.type === "text");
  const channel = textChannels[0]?.id || "";
  const reviewChannel = textChannels[1]?.id || channel;
  let category = base.meta.channels.find((item) => item.type === "category")?.id;
  if (!category) {
    category = String(100000000000030000n + BigInt(index));
    base.meta.channels.push({ id: category, name: "Support tickets", type: "category", parentId: null, position: base.meta.channels.length });
    base.info.channelCount = base.meta.channels.length;
  }
  const roles = base.meta.roles.filter((role) => !role.managed);
  const staffRole = roles[0]?.id || "";
  const applicant = base.members[1] || base.members[0];
  const reviewer = base.members[0];
  base.config.Integrations = { ...(base.config.Integrations || {}), PRC: { ...(base.config.Integrations?.PRC || {}), has_key: index === 0 } };
  base.config.Sessions = { channel_id: channel, ping_role_id: null, management_role_ids: staffRole ? [staffRole] : [], poll: { mode: "fixed", fixed_votes_needed: 10, auto_start: false }, messages: { start: { content: "A new session is starting.", embed: { title: "Session open", description: "Join the preview game and meet the team.", color: "#5865f2" } } }, ...(base.config.Sessions || {}) };
  const moduleMessages: Record<string, Fixture> = {};
  for (const section of MODULE_SECTIONS) {
    if (section.message) moduleMessages[section.message.type] = { ...copy(section.message.defaults || {}), render_mode: "legacy", components: [] };
    for (const message of section.configMessages || []) {
      const existing = message.path.split(".").reduce((value: any, key) => value?.[key], base.config);
      if (existing == null) setPath(base.config, message.path, copy(message.defaults || {}));
    }
  }
  const application = {
    id: `staff-application-${index + 1}`, name: "Staff application", description: "Tell us about your experience and when you can help.",
    responses_open: true, require_discord_member: true, allow_multiple: false,
    accent_color: ["#f7a8c4", "#8fb9ff", "#8ad9b2"][index % 3],
    manager_role_ids: staffRole ? [staffRole] : [], editor_roles: staffRole ? [staffRole] : [],
    review_channel_id: reviewChannel, staging_pipeline: true,
    questions: [
      { id: "experience", type: "text_paragraph", question: "What experience would you bring to the team?", required: true },
      { id: "availability", type: "multiple_choice", question: "When are you usually available?", required: true, options: [{ value: "weekdays", label: "Weekdays" }, { value: "weekends", label: "Weekends" }, { value: "both", label: "Both" }] },
      { id: "ready", type: "boolean", question: "Have you read the staff handbook?", required: true },
    ],
    accept_message: { content: "Your application was approved. Welcome to the team!" },
    deny_message: { content: "Thanks for applying. You are welcome to try again after gaining more experience." },
  };
  base.config.Applications = { ...(base.config.Applications || {}), applications: [...(base.config.Applications?.applications || []), application] };
  const announcement = { content: "A preview announcement for your community.", embed: { title: "Community update", description: "Everything you change in this preview stays in your test workspace.", color: "f7a8c4", fields: [{ name: "Next session", value: "Saturday, 18:00 UTC", inline: true }, { name: "Help", value: "Open a support ticket.", inline: true }] }, render_mode: "legacy", components: [] };
  const layout = [{ id: "notice", type: "container", color: "5865f2", blocks: [{ id: "heading", type: "text", content: "## Welcome to the community\nPlease read the rules and introduce yourself." }, { id: "line", type: "separator", divider: true }] }];
  const graph = sampleGraph(channel, "This is a simulated workflow message. No message is sent to Discord.");
  return {
    messages: {
      ...moduleMessages,
      welcome: { content: "Welcome, {user.mention}!", embed: { title: "Make yourself at home", description: "Read the rules and ask the team if you need help.", color: "f7a8c4" }, render_mode: "legacy", components: [] },
      goodbye: { content: "Thanks for spending time with us, {user.name}.", render_mode: "legacy", embed: {}, components: [] },
      infraction: { content: "", embed: { title: "Staff notice", description: "{user.mention}\n{reason}", color: "f7a8c4" }, render_mode: "legacy", components: [] },
    },
    templates: {
      embeds: [{ name: "Community update", embed: copy(announcement.embed) }],
      containers: [{ name: "Welcome card", content: "Hello, {user.mention}!", color: "5865f2", layout: copy(layout) }],
      forms: [{ name: "Support request", title: "Support request", questions: [{ label: "How can we help?", kind: "paragraph", required: true }] }],
      messages: [{ name: "Community update", description: "An editable announcement", message: copy(announcement), content: announcement.content }],
    },
    panels: [
      { _id: `subject-${index}`, guild: base.id, type: "single", name: "General support", description: "Questions about the server", Category: category, TranscriptChannel: reviewChannel, AutoCreateChannel: true, SupportRoles: staffRole ? [staffRole] : [], Button: { label: "Open a ticket", style: "Blue" }, Questions: [{ label: "What do you need help with?", kind: "paragraph", required: true }], Message: { content: "The team will be with you shortly. Please describe what happened." } },
      { _id: `panel-${index}`, guild: base.id, type: "multi", name: "Support desk", Panels: ["General support"], DisplayMode: "buttons", Message: { content: "Need help? Choose a subject below." } },
    ],
    commands: [{ name: "welcome", Command: "welcome", description: "Share a community welcome", category: "Community", content: "Welcome to the server, {user.mention}!", embed: { title: "Useful information", description: "Read the rules and open a support ticket if you need help.", color: "f7a8c4" }, command_options: [], permissionroles: [], components: [], render_mode: "legacy", disabled: false }],
    responders: [{ trigger: "how do I apply", response: "Open the staff application from the Resources page.", response_message: { content: "Open the staff application from the Resources page." }, similarity: 80, actions: [], requirements: [] }],
    responses: ["pending", "staged_approved", "approved", "denied"].map((status, position) => ({
      id: `response-${index}-${position}`, applicationId: application.id, applicationName: application.name,
      userId: applicant?.id || "100000000000000002", userName: position === 0 ? applicant?.name || "Alex Morgan" : ["", "Jamie Taylor", "Sam Rivers", "Casey Ellis"][position],
      userHandle: applicant?.username || "alex.morgan", userAvatar: applicant?.avatar || null, isMember: true,
      status, answers: { experience: "I have helped moderate community events and enjoy making new members feel welcome. I can help answer questions and keep sessions organized.", availability: "both", ready: "true" },
      score: null, maxScore: null, createdAt: stamp(4 + position * 12),
      reviewer: position > 1 ? { id: reviewer?.id || "100000000000000001", name: reviewer?.name || "Preview developer", avatar: reviewer?.avatar || null } : null,
      decidedAt: position > 1 ? stamp(position) : null, decisionReason: position > 1 ? "Reviewed in the test workspace." : null,
    })),
    qotd: { channel_id: channel, pingrole: null, qotdthread: true, nextdate: null },
    profile: { display_name: `${base.meta.guild.name} Helper`, global_name: "Community Bot", avatar: "/icon.svg", banner: null },
    assistant: { enabled: true, personality: "balanced", age: "everyday", filter: "standard", respond_to_replies: true, allow_ask_command: true, image_generation: true, channels: [], web_search: false, cooldown_seconds: 30, escalate_after_turns: 5, escalation_summary: true, escalation_routes: [{ panel: "General support", channel_id: reviewChannel }], actions: { allow_close: false, allow_notify: true, notify_channel_ids: [reviewChannel], ping_role_ids: staffRole ? [staffRole] : [] }, known_issue: "", blocked_users: [] },
    knowledge: [{ index: 0, text: "Staff applications are reviewed each weekend.", always: false, detected: false }, { index: 1, text: "If a member needs account help, ask them to open a support ticket.", always: true, detected: true }],
    gaps: [{ id: `gap-${index}`, question: "When is the next training session?", neededContext: "The training schedule has not been added.", occurrences: 3 }],
    connections: roles.length > 1 ? [{ guild: base.id, parent: roles[1].id, child: roles[0].id }] : [],
    infractionTypes: (base.config.Infraction?.types || ["Warning", "Suspension"]).map((name: string, position: number) => ({ name, given_roles: [], removed_roles: [], change_group_role: false, group_role: "", staff_database_removal: false, channel: reviewChannel, demote: position === 1, demote_department: "", demote_skip_to: "" })),
    automations: [{ _id: `workflow-${index}`, name: "Send a community reminder", enabled: false, trigger: "manual", graph, steps: graphToAutomation(graph).steps, cooldown_seconds: 60, last_run_at: stamp(2) }],
    runs: [{ _id: `run-${index}`, automation_id: `workflow-${index}`, automation_name: "Send a community reminder", created_at: stamp(2), notes: ["Preview run completed. No Discord or bot actions were taken."] }],
    audit: [
      { guild_id: base.id, actor_id: reviewer?.id || "100000000000000001", actor_name: reviewer?.name || "Preview developer", action: "preview.created", module: "Dashboard", summary: "Test workspace created", created_at: stamp(1) },
      { guild_id: base.id, actor_id: applicant?.id || "100000000000000002", actor_name: applicant?.name || "Alex Morgan", action: "command", module: "Shifts", command: "/shift start", summary: "Started a test shift", status: "success", duration_ms: 184, channel_id: channel, arguments: { type: "Staff" }, created_at: stamp(2) },
    ],
    deliveries: [],
    staff: base.members.slice(0, 5).map((member, position) => ({ id: member.id, user_id: member.id, userId: member.id, name: member.name, username: member.username, avatar: member.avatar, roles: member.roles, rank: position === 0 ? "Manager" : "Staff", on_duty: position < 2, total_seconds: 7_200 + position * 1_800, shifts: [{ id: `shift-${index}-${position}`, started_at: stamp(3 + position), ended_at: stamp(1), duration_seconds: 7_200 }], infractions: [], notes: [] })),
  };
}

function replaceByName(list: Fixture[], record: Fixture, originalName = record.name): Fixture[] {
  const existing = list.findIndex((item) => item.name === originalName);
  if (existing === -1) return [...list, copy(record)];
  return list.map((item, index) => index === existing ? copy(record) : item);
}

function nextId(state: PreviewState, prefix: string): string {
  state.sequence += 1;
  return `${prefix}-${state.sequence}`;
}

function setPath(target: Fixture, path: string, value: unknown) {
  const keys = path.split(".");
  if (keys.some((key) => ["__proto__", "constructor", "prototype"].includes(key))) return;
  let current = target;
  for (const key of keys.slice(0, -1)) current = current[key] ??= {};
  current[keys[keys.length - 1]] = copy(value);
}

const endpoints = new Set([
  "dashboard_messages", "dashboard_templates", "dashboard_panels", "dashboard_ticketpanels", "dashboard_ticketpanelsend",
  "dashboard_customcommands", "dashboard_customcommand_ai", "dashboard_autoresponders", "dashboard_qotd", "dashboard_botprofile", "dashboard_media",
  "dashboard_gatorai", "dashboard_aigaps", "dashboard_aicontext", "dashboard_connectionroles", "dashboard_infractiontypes", "dashboard_audit",
  "dashboard_application_responses", "dashboard_application_decision", "dashboard_application_decision_bulk", "dashboard_application_publish_staged", "dashboard_application_response_delete", "dashboard_application_ai_scan",
  "dashboard_departmentappresponses", "dashboard_departmentappdecision",
  "dashboard_automations", "dashboard_sessionpanel", "dashboard_prcserver",
  "dashboard_staff", "dashboard_staffmember", "dashboard_staffaction",
]);

export function handleManagementRequest(state: PreviewState, request: PreviewRequest): PreviewReply | undefined {
  if (!endpoints.has(request.endpoint)) return undefined;
  const guild = state.guilds[request.params.server];
  if (!guild) return reject("This test server does not exist.", 404);
  const fixture = guild.management;
  const { endpoint, params, body } = request;
  const reading = request.method === "GET";
  const departmentId = String(params.department || body.department_id || body.department || "");
  const departmentName = guild.departments.records.find((department) => department.profile.id === departmentId)?.profile.name;
  const departmentApplications = new Set((guild.config.Applications?.applications || []).filter((application: Fixture) => departmentId && [departmentId, departmentName].includes(application.department_id || application.department)).map((application: Fixture) => application.id));
  const channel = guild.meta.channels.find((entry) => entry.type === "text")?.id || "";
  const capabilities = { erlc: Boolean(guild.config.Integrations?.PRC?.has_key), modules: guild.config.Modules || {}, supported };
  const delivered = (kind: string) => {
    fixture.deliveries.unshift({ id: nextId(state, "delivery"), kind, channel: body.channel || body.channel_id || channel, created_at: now(), simulated: true });
    fixture.deliveries = fixture.deliveries.slice(0, 40);
    return reply({ success: true, simulated: true, message: "Preview action completed. Nothing was sent to a real server." });
  };
  if (!reading) {
    fixture.audit.unshift({ guild_id: guild.id, actor_id: PREVIEW_USER_ID, actor_name: PREVIEW_SESSION.user.name, action: String(body.action || "update"), module: endpoint.replace("dashboard_", ""), summary: "Requested a change in the test workspace", created_at: now() });
    fixture.audit = fixture.audit.slice(0, 100);
  }
  switch (endpoint) {
    case "dashboard_messages": {
      const type = String(params.type || body.type || "welcome");
      if (!reading) fixture.messages[type] = body.data == null ? null : copy(body.data);
      return reply({ message: fixture.messages[type] ?? null });
    }
    case "dashboard_templates": {
      if (reading) return reply(fixture.templates);
      const kinds: Record<string, TemplateKind> = { embed: "embeds", container: "containers", form: "forms", message: "messages" };
      const kind = kinds[String(body.type)];
      if (!kind || !String(body.name || "").trim()) return reject("Choose a template type and name.");
      if (body.action === "delete") fixture.templates[kind] = fixture.templates[kind].filter((template) => template.name !== body.name);
      else if (body.action === "send") return delivered("template");
      else {
        const { action: _action, user: _user, type: _type, ...template } = body;
        fixture.templates[kind] = replaceByName(fixture.templates[kind], template);
      }
      return reply(fixture.templates);
    }
    case "dashboard_panels": return reply({ panels: fixture.panels });
    case "dashboard_ticketpanels": {
      const type = String(body.type || "single");
      const name = String(body.name || "").trim();
      if (!name) return reject("Give the ticket subject or panel a name.");
      const target = fixture.panels.find((panel) => panel.name === name && (panel.type || "single") === type);
      if (body.action === "delete") {
        fixture.panels = fixture.panels.filter((panel) => panel !== target);
        if (type === "single") for (const panel of fixture.panels) if (Array.isArray(panel.Panels)) panel.Panels = panel.Panels.filter((subject: string) => subject !== name);
      }
      else if (body.action === "create") {
        if (target) return reject("A ticket item already uses this name.");
        fixture.panels.push({ _id: nextId(state, "ticket"), guild: guild.id, type, name, Questions: [], Panels: [], Button: { label: "Open ticket", style: "Grey" }, Message: { content: "How can we help?" } });
      } else if (body.action === "update") {
        if (!target) return reject("That ticket item no longer exists.", 404);
        const renamed = String(body.set?.rename || name).trim();
        if (fixture.panels.some((panel) => panel !== target && panel.type === type && panel.name === renamed)) return reject("A ticket item already uses that name.");
        for (const [key, value] of Object.entries(body.set || {})) if (key !== "rename") setPath(target, key, value);
        for (const key of body.unset || []) delete target[key];
        target.name = renamed;
        if (type === "single" && renamed !== name) for (const panel of fixture.panels) if (Array.isArray(panel.Panels)) panel.Panels = panel.Panels.map((subject: string) => subject === name ? renamed : subject);
      }
      return reply({ panels: fixture.panels });
    }
    case "dashboard_ticketpanelsend": return delivered("ticket panel");
    case "dashboard_customcommands": {
      if (!reading) {
        if (body.action === "delete") fixture.commands = fixture.commands.filter((command) => command.name !== body.name);
        else if (body.command) fixture.commands = replaceByName(fixture.commands, { ...body.command, Command: body.command.name }, body.original_name || body.command.name);
        else return reject("The command draft is missing.");
      }
      return reply({ commands: fixture.commands });
    }
    case "dashboard_customcommand_ai": return reply({ simulated: true, suggestion: { ...(body.command || {}), description: "Preview command draft", content: `Preview suggestion: ${String(body.prompt || "A helpful community response").slice(0, 800)}`, embed: { title: "Community help", description: "Review and edit this example before saving.", color: "f7a8c4" } } });
    case "dashboard_autoresponders": {
      if (!reading) {
        if (body.action === "delete") fixture.responders = fixture.responders.filter((item) => item.trigger !== body.trigger);
        else {
          fixture.responders = fixture.responders.filter((item) => item.trigger !== (body.original_trigger || body.trigger));
          fixture.responders.push(copy({ trigger: body.trigger, response: body.response || "", response_message: body.response_message, similarity: body.similarity ?? 100, actions: body.actions || [], requirements: body.requirements || [] }));
        }
      }
      return reply({ responders: fixture.responders });
    }
    case "dashboard_qotd": {
      if (!reading) fixture.qotd = { ...fixture.qotd, ...copy(body.set || {}) };
      return reply({ qotd: fixture.qotd });
    }
    case "dashboard_botprofile": {
      if (!reading) {
        for (const key of ["display_name", "avatar", "banner"]) if (Object.hasOwn(body, key)) fixture.profile[key] = body[key];
        for (const key of body.reset_fields || []) if (["display_name", "avatar", "banner"].includes(key)) fixture.profile[key] = key === "avatar" ? "/icon.svg" : null;
      }
      return reply({ profile: fixture.profile });
    }
    case "dashboard_media": return typeof body.image === "string" && /^data:image\/(png|jpeg|gif|webp);base64,/.test(body.image) ? reply({ url: body.image }) : reject("Choose a PNG, JPEG, GIF or WebP image.");
    case "dashboard_gatorai": {
      if (!reading) fixture.assistant = { ...fixture.assistant, ...copy(body.settings || {}), cooldown_seconds: Math.max(30, Number(body.settings?.cooldown_seconds ?? fixture.assistant.cooldown_seconds)) };
      return reply({ settings: fixture.assistant, channels: guild.meta.channels.filter((entry) => entry.type === "text"), blocked: (fixture.assistant.blocked_users || []).map((entry: Fixture) => ({ ...entry, name: guild.members.find((member) => member.id === entry.user_id)?.name || `Member ${entry.user_id}` })) });
    }
    case "dashboard_aigaps": {
      if (!reading) {
        if (body.action === "answer" && String(body.answer || "").trim()) fixture.knowledge.push({ index: nextId(state, "knowledge"), text: body.answer, always: false });
        fixture.gaps = fixture.gaps.filter((gap) => gap.id !== body.id);
      }
      return reply({ gaps: fixture.gaps });
    }
    case "dashboard_aicontext": {
      if (!reading) {
        if (body.action === "add") fixture.knowledge.push({ index: nextId(state, "knowledge"), text: String(body.text || ""), always: body.always ?? null });
        else if (body.action === "delete") fixture.knowledge = fixture.knowledge.filter((item) => String(item.index) !== String(body.index));
        else if (body.action === "edit") fixture.knowledge = fixture.knowledge.map((item) => String(item.index) === String(body.index) ? { ...item, text: body.text, always: body.always ?? null } : item);
      }
      return reply({ items: fixture.knowledge });
    }
    case "dashboard_connectionroles": {
      if (!reading) {
        fixture.connections = fixture.connections.filter((entry) => !(entry.parent === body.parent && entry.child === body.child));
        if (body.action === "add") fixture.connections.push({ guild: guild.id, parent: body.parent, child: body.child });
      }
      return reply({ connections: fixture.connections });
    }
    case "dashboard_infractiontypes": {
      if (!reading) fixture.infractionTypes = copy(body.types || []);
      if (reading && Array.isArray(guild.config.Infraction?.types)) fixture.infractionTypes = guild.config.Infraction.types.map((name: string) => fixture.infractionTypes.find((type) => type.name === name) || { name, given_roles: [], removed_roles: [], change_group_role: false, group_role: "", staff_database_removal: false, channel: "", demote: false, demote_department: "", demote_skip_to: "" });
      const ranks = (ids: string[]) => ids.map((id, position) => ({ id, name: guild.meta.roles.find((role) => role.id === id)?.name || "Deleted role", position }));
      const hierarchy = guild.config.Promo?.System?.single?.Hierarchy || guild.meta.roles.filter((role) => !role.managed).map((role) => role.id).reverse();
      const departments = (guild.config.Department?.profiles || []).map((department: Fixture) => ({ id: department.id, name: department.name, ranks: ranks(department.rank_roles || []) }));
      return reply({ types: fixture.infractionTypes, departments, hierarchy: ranks(hierarchy), group_roles: [], system: "single" });
    }
    case "dashboard_application_responses":
    case "dashboard_departmentappresponses": return reply({ responses: fixture.responses.filter((response) => (!params.application || response.applicationId === params.application) && (endpoint !== "dashboard_departmentappresponses" || departmentApplications.has(response.applicationId))) });
    case "dashboard_application_response_delete": {
      fixture.responses = fixture.responses.filter((response) => response.id !== body.id);
      return reply({ success: true });
    }
    case "dashboard_application_decision":
    case "dashboard_departmentappdecision":
    case "dashboard_application_decision_bulk": {
      if (!["approve", "deny"].includes(body.decision)) return reject("Choose approve or deny.");
      const ids: string[] = endpoint.endsWith("_bulk") ? body.ids || [] : [body.id];
      const failed: Fixture[] = [];
      for (const id of ids) {
        const submission = fixture.responses.find((response) => response.id === id);
        if (!submission) { failed.push({ id, error: "Submission not found" }); continue; }
        if (endpoint === "dashboard_departmentappdecision" && !departmentApplications.has(submission.applicationId)) { failed.push({ id, error: "This submission does not belong to the selected department." }); continue; }
        const form = guild.config.Applications?.applications?.find((application: Fixture) => application.id === submission.applicationId);
        const verdict = body.decision === "approve" ? "approved" : "denied";
        submission.status = form?.staging_pipeline ? `staged_${verdict}` : verdict;
        submission.decisionReason = body.reason || "Reviewed in the test workspace.";
        submission.decidedAt = now();
        submission.reviewer = { id: PREVIEW_USER_ID, name: PREVIEW_SESSION.user.name, avatar: PREVIEW_SESSION.user.image };
        if (!form?.staging_pipeline) decideDepartmentApplication(state, guild.id, submission, verdict === "approved");
      }
      return failed.length && ids.length === 1 ? reject(failed[0].error, 404) : reply({ success: true, failed });
    }
    case "dashboard_application_publish_staged": {
      for (const submission of fixture.responses) if (submission.applicationId === body.application && String(submission.status).startsWith("staged_")) {
        submission.status = submission.status.slice(7);
        decideDepartmentApplication(state, guild.id, submission, submission.status === "approved");
      }
      return reply({ success: true, undelivered: [] });
    }
    case "dashboard_application_ai_scan": {
      const submission = fixture.responses.find((response) => response.id === body.submission);
      if (!submission) return reject("Submission not found", 404);
      submission.aiDetection = { model_available: false, preview: true, questions: Object.fromEntries(Object.keys(submission.answers).map((id) => [id, { verdict: "clear", reason: "Preview example. No real authorship assessment was performed." }])) };
      return reply({ detection: submission.aiDetection });
    }
    case "dashboard_automations": {
      if (reading) return reply({ automations: fixture.automations, runs: fixture.runs, capabilities });
      const graph = body.graph as WorkflowGraph | undefined;
      if (body.action === "validate" || body.action === "upsert") {
        if (!Array.isArray(graph?.nodes) || !Array.isArray(graph?.edges)) return reject("The workflow graph is missing.");
        const issues = workflowIssues(graph, capabilities);
        if (body.action === "validate") return reply({ valid: issues.length === 0, issues });
        if (body.enabled && issues.length) return reject(issues.map((issue) => issue.message).join(" "));
        const id = String(body.id || nextId(state, "workflow"));
        const automation = { _id: id, name: String(body.name || "Untitled workflow"), graph: copy(graph), ...graphToAutomation(graph), enabled: Boolean(body.enabled), cooldown_seconds: Math.max(0, Number(body.cooldown_seconds) || 0), issues };
        const at = fixture.automations.findIndex((item) => item._id === id);
        if (at < 0) fixture.automations.push(automation); else fixture.automations[at] = automation;
        return reply({ id, automations: fixture.automations });
      }
      if (body.action === "delete") fixture.automations = fixture.automations.filter((automation) => automation._id !== body.id);
      else if (body.action === "run") {
        const automation = fixture.automations.find((item) => item._id === body.id);
        if (!automation) return reject("Workflow not found", 404);
        const issues = workflowIssues(automation.graph, capabilities);
        if (issues.length) return reject(issues.map((issue) => issue.message).join(" "));
        const notes = ["Preview run completed. No Discord or bot actions were taken."];
        automation.last_run_at = now();
        fixture.runs.unshift({ _id: nextId(state, "run"), automation_id: automation._id, automation_name: automation.name, created_at: now(), notes });
        fixture.runs = fixture.runs.slice(0, 60);
        return reply({ notes, automations: fixture.automations, runs: fixture.runs });
      }
      return reply({ automations: fixture.automations, runs: fixture.runs, capabilities });
    }
    case "dashboard_audit": return reply({ entries: fixture.audit.filter((entry) => params.kind === "commands" ? entry.action === "command" : entry.action !== "command").slice(0, Math.max(1, Math.min(100, Number(params.limit) || 50))) });
    case "dashboard_sessionpanel": return delivered("session panel");
    case "dashboard_prcserver": return reply(capabilities.erlc ? { linked: true, online: true, server: { name: `${guild.meta.guild.name} roleplay`, joinCode: "PREVIEW", players: 24, maxPlayers: 40, queue: 2, ownerId: "100000000000000001", coOwnerIds: [], verifiedReq: "Email", teamBalance: true } } : { linked: false, online: false });
    case "dashboard_staff": return reply({ staff: fixture.staff, members: fixture.staff, total: fixture.staff.length, on_duty: fixture.staff.filter((member) => member.on_duty) });
    case "dashboard_staffmember": {
      const member = fixture.staff.find((entry) => entry.id === params.member);
      return member ? reply({ member, staff: member, shifts: member.shifts, infractions: member.infractions, notes: member.notes }) : reject("Test staff member not found.", 404);
    }
    case "dashboard_staffaction": {
      const member = fixture.staff.find((entry) => entry.id === String(body.member || body.member_id || body.user_id));
      if (!member) return reject("Choose a test staff member.", 404);
      if (["start_shift", "clock_in"].includes(body.action)) member.on_duty = true;
      else if (["end_shift", "clock_out", "end_break"].includes(body.action)) member.on_duty = false;
      else if (body.action === "promote") member.rank = "Senior staff";
      else if (body.action === "demote") member.rank = "Staff";
      else if (["note", "add_note"].includes(body.action)) member.notes.push({ text: String(body.note || body.reason || "Preview note"), created_at: now() });
      else member.notes.push({ text: `Simulated ${String(body.action || "staff update")}`, created_at: now() });
      return reply({ success: true, simulated: true, member, staff: fixture.staff });
    }
  }
}
