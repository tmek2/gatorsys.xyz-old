import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function load(path: string, dependencies: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  new Function("require", "module", "exports", "process", "fetch", code)(
    (name: string) => {
      if (name === "react/jsx-runtime") return require(name);
      assert.ok(name in dependencies, `Unexpected dependency ${name} in ${path}`);
      return dependencies[name];
    }, module, module.exports,
    { env: new Proxy({}, { get: (_target, name) => { throw new Error(`Preview attempted to read environment ${String(name)}`); } }) },
    () => { throw new Error("Preview attempted an external request"); },
  );
  return module.exports;
}

const identity = load("src/preview/identity.ts");
const registrations: unknown[][] = [];
const account = load("src/preview/account.ts", {
  "./identity": identity,
  "./departments": { recordDepartmentApplication: (...args: unknown[]) => { registrations.push(args); } },
});
const viewer = identity.PREVIEW_SESSION.user;
const guildId = identity.PREVIEW_GUILDS[0].id;

function state() {
  return {
    sequence: 1000,
    account: account.createAccountFixtures(),
    guilds: Object.fromEntries(identity.PREVIEW_GUILDS.map((guild: any) => [guild.id, {
      id: guild.id, info: guild,
      config: { Applications: { applications: [{ id: "staff-form", name: "Staff application", responses_open: true, allow_multiple: false, questions: [{ id: "experience", type: "text_paragraph", required: true }, { id: "ready", type: "boolean", required: true }] }] } },
      management: { responses: [] }, departments: { records: [] },
    }])),
  };
}

function request(endpoint: string, params: Record<string, string> = {}, body: Record<string, unknown> = {}, method = "GET") {
  return { endpoint, params, body, method };
}

test("preview identities are local, immediately linked and independent between visitors", () => {
  const first = state();
  const second = state();
  assert.equal(Object.keys(first.account.cases).length, 3);
  assert.equal(Object.keys(first.account.transcripts).length, 3);
  const read = () => account.handleAccountRequest(first, request("dashboard_roblox_identity"));
  assert.equal(read().data.roblox.linked, true);
  assert.match(read().data.roblox.avatar, /^\//);
  const originalId = read().data.roblox.id;
  const changed = account.handleAccountRequest(first, request("dashboard_roblox_identity", {}, { action: "relink" }, "POST"));
  assert.equal(changed.data.status, "verified");
  assert.notEqual(changed.data.roblox.id, originalId);
  assert.equal(second.account.roblox.id, originalId);
  account.handleAccountRequest(first, request("dashboard_roblox_identity", {}, { action: "unlink" }, "POST"));
  assert.equal(read().data.roblox.linked, false);
  assert.equal(account.handleAccountRequest(first, request("dashboard_roblox_identity", {}, { action: "start" }, "POST")).data.roblox.linked, true);
  assert.equal(account.handleAccountRequest(first, request("dashboard_roblox_identity", {}, { action: "unknown" }, "POST")).status, 400);
});

test("preview Roblox lookups use fixtures and preserve the existing website response shapes", () => {
  const data = state();
  const get = (endpoint: string, params: Record<string, string>) => account.handleAccountRequest(data, request(endpoint, params));
  assert.deepEqual(get("preview_roblox_user", { id: "1001001" }).data, { username: "PreviewPlayer", avatarUrl: "/icon.svg" });
  assert.equal(get("preview_roblox_user", { id: "not-a-preview-user" }).status, 404);
  assert.deepEqual(get("preview_roblox_search", { keyword: "p" }).data, { users: [] });
  const matches = get("preview_roblox_search", { keyword: "builder" }).data.users;
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 1001002);
  assert.equal(matches[0].name, "PreviewBuilder");
  assert.match(matches[0].avatarUrl, /^\//);
});

test("public preview forms read live settings and submissions appear in that same dashboard response store", () => {
  const data = state();
  const params = { server: guildId, application: "staff-form" };
  const read = () => account.handleAccountRequest(data, request("dashboard_application_public", params));
  assert.equal(read().data.application.name, "Staff application");
  const application = data.guilds[guildId].config.Applications.applications[0];
  application.name = "Changed form title";
  assert.equal(read().data.application.name, "Changed form title");
  const invalid = account.handleAccountRequest(data, request("dashboard_application_submit", params, { answers: { ready: false } }, "POST"));
  assert.equal(invalid.status, 400);
  const answers = { experience: "I can help with weekend sessions.", ready: false };
  const result = account.handleAccountRequest(data, request("dashboard_application_submit", params, { user: "forged-user", answers, integrity: { experience: { typed: 30 } } }, "POST"));
  assert.equal(result.status, 200);
  assert.equal(result.data.submissionStatus, "pending");
  const saved = data.guilds[guildId].management.responses[0];
  assert.equal(saved.id, result.data.id);
  assert.equal(saved.userId, viewer.id);
  assert.equal(saved.applicationId, "staff-form");
  assert.deepEqual(saved.answers, answers);
  assert.equal((registrations.at(-1)![2] as any).id, saved.id);
  answers.experience = "Changed only in caller";
  assert.notEqual(saved.answers.experience, answers.experience);
  assert.equal(read().data.alreadySubmitted, true);
  assert.equal(account.handleAccountRequest(data, request("dashboard_application_submit", params, { answers }, "POST")).status, 409);
  application.responses_open = false;
  assert.equal(read().data.application.responses_open, false);
  assert.equal(account.handleAccountRequest(data, request("dashboard_application_public", { server: "unknown", application: "staff-form" })).status, 404);
});

test("public form IDs resolve to configured forms and unknown IDs fail locally", () => {
  const data = state();
  data.guilds[guildId].config.Applications.applications[0].public_id = "123456789";
  assert.deepEqual(account.handleAccountRequest(data, request("dashboard_application_by_public_id", { public: "123456789" })).data, { guild: guildId, application: "staff-form" });
  assert.equal(account.handleAccountRequest(data, request("dashboard_application_by_public_id", { public: "unknown" })).status, 404);
});

test("legacy case edits and deletion update the list while invalid verbs and forged identities do not", () => {
  const data = state();
  const params = { server: guildId, id: "case-1" };
  const before = account.handleAccountRequest(data, request("infraction", params)).data;
  assert.equal(account.handleAccountRequest(data, request("delinfraction", params)).status, 405);
  const updated = account.handleAccountRequest(data, request("UpdateInfraction", params, { user: { name: "forged" }, author: { id: "forged" }, status: "resolved", action: { type: "  Coaching  ", details: "A changed preview reason" } }, "POST"));
  assert.equal(updated.status, 200);
  assert.equal(updated.data.action.type, "Coaching");
  assert.deepEqual(updated.data.user, before.user);
  assert.deepEqual(updated.data.author, before.author);
  const list = account.handleAccountRequest(data, request("infractions", { server: guildId })).data;
  assert.equal(list[0].action.details, "A changed preview reason");
  assert.equal(list[0].status, "resolved");
  assert.equal(account.handleAccountRequest(data, request("delinfraction", params, {}, "DELETE")).status, 200);
  assert.equal(account.handleAccountRequest(data, request("infraction", params)).status, 404);
  assert.equal(account.handleAccountRequest(data, request("infractions", { server: guildId })).data.length, 1);
});

test("transcript reads match both legacy contracts and never mutate their stored order", () => {
  const data = state();
  const read = () => account.handleAccountRequest(data, request("transcript", { id: "ticket-1" })).data;
  const first = read();
  assert.equal(first.GuildID, guildId);
  assert.deepEqual(first.compact, first.transcript[0].compact);
  assert.deepEqual(first.data.transcript[0].compact, first.compact);
  const latest = first.compact[0].message_id;
  first.compact.reverse();
  assert.equal(read().compact[0].message_id, latest);
  assert.equal(account.handleAccountRequest(data, request("transcript", { id: "unknown" })).status, 404);
});

test("fake auth, provider seed and disabled cache never read live configuration or load OAuth credentials", async () => {
  const redirects: string[] = [];
  const navigation = { redirect: (target: string) => { redirects.push(target); } };
  const local = load("src/utils/local-redirect.ts");
  const auth = load("auth.ts", { "next/navigation": navigation, "./src/preview/identity": identity, "./src/utils/local-redirect": local });
  const session = await auth.auth();
  assert.equal(session.user.id, viewer.id);
  session.user.name = "Changed by caller";
  assert.equal((await auth.auth()).user.name, viewer.name);
  assert.equal(await auth.signIn("discord", { redirectTo: "//outside.example", redirect: false }), "/servers");
  assert.equal(await auth.signOut({ redirectTo: "/account", redirect: false }), "/account");
  const response = await auth.handlers.GET(new Request("https://live-looking.example/api/auth/session"));
  assert.equal((await response.json()).user.id, viewer.id);
  const csrf = await auth.handlers.GET(new Request("https://live-looking.example/api/auth/csrf"));
  assert.equal((await csrf.json()).csrfToken, "offline-preview");
  const provider = load("src/app/providers.tsx", { "next-auth/react": { SessionProvider: () => null }, "@/preview/identity": identity, react: require("react") });
  const element = provider.SessionProviders({ children: "Preview" });
  assert.equal(element.props.session, identity.PREVIEW_SESSION);
  assert.equal(element.props.refetchOnWindowFocus, false);
  const token = load("src/utils/discord-session-token.ts", { "server-only": {} });
  assert.equal(await token.getDiscordAccessToken(), null);
  const redis = load("src/utils/redis.ts");
  assert.equal(await redis.getCached("private-key"), null);
  await redis.setCached("private-key", { secret: "unused" });
  await redis.deleteCached("private-key");
  await redis.bumpGeneration("private-key");
  assert.equal(await redis.readGeneration("private-key"), 0);
  assert.equal(load("src/utils/site-url.ts").getSiteUrl(), "http://localhost:3000");
  assert.deepEqual(redirects, []);
});

test("legacy and mutual adapters dispatch in process and discard any supplied private credential", async () => {
  const calls: any[] = [];
  const transport = { previewBotRequest: async (...args: unknown[]) => { calls.push(args); return Response.json({ mutual: identity.PREVIEW_GUILDS, departments: [] }); } };
  const middleware = load("src/utils/api-middleware.ts", { "next/server": { NextResponse: { json: Response.json } }, "~/auth": { auth: async () => identity.PREVIEW_SESSION }, "@/preview/server": transport });
  await middleware.makeApiRequest(`https://must-not-contact.invalid/UpdateInfraction?auth=unused-private-key&server=${guildId}&id=case-1`, { method: "POST", body: JSON.stringify({ action: { type: "Warning", details: "Preview" } }) });
  assert.deepEqual(calls[0], ["UpdateInfraction", { server: guildId, id: "case-1" }, { action: { type: "Warning", details: "Preview" } }, "POST"]);
  const mutual = load("src/utils/mutual-servers.ts", { "@/preview/server": transport, "@/preview/identity": identity });
  const response = await mutual.fetchMutualServersForSession({ user: { id: "ignored-real-account" } }, { forceRefresh: true });
  assert.equal(response.mutual.length, 3);
  assert.deepEqual(calls[1], ["mutual_servers", { user: viewer.id }]);
});
