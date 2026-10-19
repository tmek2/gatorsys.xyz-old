import type { PreviewReply, PreviewRequest, PreviewState } from "./types";
import { PREVIEW_GUILDS, PREVIEW_SESSION as previewSession } from "./identity";
import { recordDepartmentApplication } from "./departments";
export { PREVIEW_SESSION as previewSession } from "./identity";

interface RobloxIdentity {
  linked: boolean;
  id: string;
  username: string;
  displayName: string;
  profileUrl: string;
  avatar: string;
}

interface PreviewCase {
  id: string;
  status: string;
  created: string;
  notified: boolean;
  notify_failure?: string;
  user: { id: string; name: string; avatar: string | null };
  author: { id: string; name: string; avatar: string | null };
  action: { type: string; details: string; evidence?: string };
}

interface TranscriptMessage {
  author_id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  message_id: string;
  timestamp: number;
  attachments: string[];
  embeds: Array<Record<string, unknown>>;
}

export interface AccountFixtures {
  roblox: RobloxIdentity;
  cases: Record<string, PreviewCase[]>;
  transcripts: Record<string, { GuildID: string; compact: TranscriptMessage[] }>;
}

const GUILD_IDS = PREVIEW_GUILDS.map((guild) => guild.id);
const copy = <T>(value: T): T => structuredClone(value);
const reply = (data: unknown, status = 200): PreviewReply => ({ status, data: copy(data) });
const reject = (message: string, status = 400) => reply({ message, detail: message, error: message }, status);

function robloxIdentity(second = false): RobloxIdentity {
  return {
    linked: true,
    id: second ? "1001002" : "1001001",
    username: second ? "PreviewBuilder" : "PreviewPlayer",
    displayName: second ? "Preview Builder" : "Preview Player",
    profileUrl: "/account/roblox",
    avatar: "/icon.svg",
  };
}

export function createAccountFixtures(): AccountFixtures {
  const cases: AccountFixtures["cases"] = {};
  const transcripts: AccountFixtures["transcripts"] = {};
  GUILD_IDS.forEach((guildId, index) => {
    cases[guildId] = [
      {
        id: "case-1", status: "active", created: new Date(Date.now() - 86_400_000).toISOString(), notified: true,
        user: { id: "100000000000000002", name: "Alex Morgan", avatar: null },
        author: { id: previewSession.user.id, name: previewSession.user.name!, avatar: "/icon.svg" },
        action: { type: "Written warning", details: "A fictional reminder to follow the community's session guidelines.", evidence: "This preview case contains no real member data." },
      },
      {
        id: "case-2", status: "resolved", created: new Date(Date.now() - 5 * 86_400_000).toISOString(), notified: false, notify_failure: "closed",
        user: { id: "100000000000000003", name: "Jamie Taylor", avatar: null },
        author: { id: previewSession.user.id, name: previewSession.user.name!, avatar: "/icon.svg" },
        action: { type: "Activity notice", details: "This sample case was resolved after a simulated discussion." },
      },
    ];
    const timestamp = Math.floor(Date.now() / 1000) - 3600;
    transcripts[`ticket-${index + 1}`] = {
      GuildID: guildId,
      // Newest first, matching the bot response that the transcript page reverses.
      compact: [
        { author_id: previewSession.user.id, author_name: previewSession.user.name!, author_avatar: "/icon.svg", content: "All set. This ticket is only a preview, and no messages were sent to Discord.", message_id: `message-${index}-2`, timestamp: timestamp + 120, attachments: [], embeds: [{ title: "Preview ticket closed", description: "The conversation stays inside this test workspace.", color: 0xf7a8c4 }] },
        { author_id: "100000000000000002", author_name: "Alex Morgan", author_avatar: "/icon.svg", content: `Hello <@${previewSession.user.id}>! Could you help me with the **staff application**? I read the _handbook_ at <t:${timestamp}:t>.`, message_id: `message-${index}-1`, timestamp, attachments: [], embeds: [] },
      ],
    };
  });
  return { roblox: robloxIdentity(), cases, transcripts };
}

function applicationFor(state: PreviewState, guildId: string, applicationId: string) {
  const guild = state.guilds[guildId];
  const applications = guild?.config?.Applications?.applications;
  if (!guild || !Array.isArray(applications)) return null;
  const application = applications.find((item) => String(item.id) === applicationId);
  return application ? { guild, application } : null;
}

function requiredAnswersMissing(questions: Array<Record<string, any>>, answers: Record<string, unknown>) {
  return questions.some((question) => {
    if (question.type === "section" || question.required === false) return false;
    const value = answers[String(question.id)];
    return value == null || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length);
  });
}

function handleApplications(state: PreviewState, request: PreviewRequest): PreviewReply | undefined {
  const { endpoint, params, body } = request;
  const method = request.method.toUpperCase();
  if (endpoint === "dashboard_application_by_public_id") {
    if (method !== "GET") return reject("Use GET to resolve a preview form", 405);
    for (const guild of Object.values(state.guilds)) {
      const applications = guild.config?.Applications?.applications;
      const application = Array.isArray(applications) ? applications.find((item) => String(item.public_id || "") === params.public) : null;
      if (application && params.public) return reply({ guild: guild.id, application: String(application.id) });
    }
    return reject("Preview application not found", 404);
  }
  if (!["dashboard_application_public", "dashboard_application_submit"].includes(endpoint)) return undefined;
  const selected = applicationFor(state, params.server, String(params.application || body.application || ""));
  if (!selected) return reject("Preview application not found", 404);
  const { guild, application } = selected;
  const alreadySubmitted = guild.management.responses.some((item) => item.applicationId === application.id && item.userId === previewSession.user.id);
  const open = application.enabled !== false && application.responses_open !== false;
  if (endpoint === "dashboard_application_public") {
    if (method !== "GET") return reject("Use GET to read a preview form", 405);
    return reply({
      guild: { name: guild.info.name, icon: null },
      application: { ...application, responses_open: open, questions: Array.isArray(application.questions) ? application.questions : [] },
      eligible: true,
      alreadySubmitted: alreadySubmitted && !application.allow_multiple,
    });
  }
  if (method !== "POST") return reject("Use POST to submit a preview form", 405);
  if (!open) return reject("This preview application is closed", 409);
  if (alreadySubmitted && !application.allow_multiple) return reject("You already submitted this preview application", 409);
  const answers = body.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return reject("Answers must be an object");
  if (JSON.stringify(answers).length > 100_000) return reject("These preview answers are too large", 413);
  if (requiredAnswersMissing(application.questions || [], answers)) return reject("Please answer every required question");
  if (application.require_roblox && !state.account.roblox.linked) return reject("Link the preview Roblox account first");
  const id = `preview-submission-${++state.sequence}`;
  const submission = {
    id, applicationId: String(application.id), applicationName: application.name || "Application",
    userId: previewSession.user.id, userName: previewSession.user.name, userHandle: "preview.developer", userAvatar: previewSession.user.image,
    isMember: true, status: "pending", answers: copy(answers), integrity: copy(body.integrity || {}),
    score: null, maxScore: null, createdAt: new Date().toISOString(), ...(body.caseId ? { caseId: String(body.caseId) } : {}),
  };
  guild.management.responses.unshift(submission);
  recordDepartmentApplication(state, guild.id, submission);
  return reply({ id, submissionStatus: "pending", submittedMessage: "Your preview application was submitted. No real data was sent." });
}

export function handleAccountRequest(state: PreviewState, request: PreviewRequest): PreviewReply | undefined {
  const { endpoint, params, body } = request;
  const method = request.method.toUpperCase();
  if (endpoint === "dashboard_roblox_identity") {
    if (method === "GET") return reply({ roblox: state.account.roblox });
    if (method !== "POST") return reject("Use GET or POST for the preview account", 405);
    if (!["start", "relink", "status", "unlink"].includes(String(body.action))) return reject("Unknown preview account action");
    if (body.action === "unlink") {
      state.account.roblox.linked = false;
      return reply({ status: "unlinked", roblox: state.account.roblox });
    }
    if (body.action === "relink") state.account.roblox = robloxIdentity(state.account.roblox.id === "1001001");
    state.account.roblox.linked = true;
    return reply({ status: "verified", roblox: state.account.roblox });
  }
  if (endpoint === "preview_roblox_user" || endpoint === "preview_roblox_search") {
    if (method !== "GET") return reject("Use GET for preview Roblox lookups", 405);
    const identities = [robloxIdentity(), robloxIdentity(true)];
    if (endpoint === "preview_roblox_search") {
      const query = String(params.keyword || "").trim().toLowerCase();
      return reply({ users: query.length < 2 ? [] : identities.filter((item) => `${item.username} ${item.displayName}`.toLowerCase().includes(query)).map((item) => ({ id: Number(item.id), name: item.username, displayName: item.displayName, avatarUrl: item.avatar })) });
    }
    const identity = identities.find((item) => item.id === params.id);
    return identity ? reply({ username: identity.username, avatarUrl: identity.avatar }) : reject("Preview Roblox user not found", 404);
  }

  const application = handleApplications(state, request);
  if (application) return application;

  if (["infractions", "infraction", "UpdateInfraction", "delinfraction"].includes(endpoint)) {
    const cases = state.account.cases[params.server];
    if (!state.guilds[params.server] || !cases) return reject("Preview community not found", 404);
    if (endpoint === "infractions") return method === "GET" ? reply(cases) : reject("Use GET to list preview cases", 405);
    const index = cases.findIndex((item) => item.id === params.id);
    if (index < 0) return reject("Preview case not found", 404);
    if (endpoint === "infraction") return method === "GET" ? reply(cases[index]) : reject("Use GET to read a preview case", 405);
    if (endpoint === "delinfraction") {
      if (method !== "DELETE") return reject("Use DELETE to remove a preview case", 405);
      cases.splice(index, 1);
      return reply({ message: "Preview case deleted" });
    }
    if (!["POST", "PUT"].includes(method)) return reject("Use POST or PUT to update a preview case", 405);
    if (!body.action || typeof body.action.type !== "string" || !body.action.type.trim() || typeof body.action.details !== "string") return reject("A case action and reason are required");
    cases[index] = {
      ...cases[index],
      action: { ...cases[index].action, type: body.action.type.trim().slice(0, 100), details: body.action.details.slice(0, 1000) },
      ...(typeof body.status === "string" ? { status: body.status } : {}),
    };
    return reply(cases[index]);
  }
  if (endpoint === "transcript") {
    if (method !== "GET") return reject("Use GET to read a preview transcript", 405);
    const transcript = state.account.transcripts[params.id];
    if (!transcript) return reject("Preview transcript not found", 404);
    const bot = { GuildID: transcript.GuildID, transcript: [{ compact: transcript.compact }] };
    return reply({ ...bot, data: bot, compact: transcript.compact });
  }
  return undefined;
}
