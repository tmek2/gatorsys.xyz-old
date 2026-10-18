import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const viewer = { user: { id: "100000000000000001", name: "Test member" } };
const guildId = "200000000000000001";
const caseId = "case-1";
const quietConsole = { error() {}, warn() {}, log() {} };

// Run the actual handlers while replacing only their service boundaries.
// This catches object-spread ordering bugs that source-pattern tests miss.
function loadModule(
  relativePath: string,
  dependencies: Record<string, unknown> = {},
  fetcher: typeof fetch = async () => {
    throw new Error("Unexpected network request in a test");
  },
  logger: Pick<Console, "error" | "warn" | "log"> = quietConsole,
): Record<string, any> {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const require = (name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name} in ${relativePath}`);
    return dependencies[name];
  };
  new Function("require", "module", "exports", "fetch", "console", "process", compiled)(
    require,
    module,
    module.exports,
    fetcher,
    logger,
    { env: { PROD_API_URL: "https://bot.example", API_AUTH: "test-key" } },
  );
  return module.exports;
}

const config = loadModule("src/server/config.ts");

function loadPermissions(
  answer: () => unknown,
  options: { status?: number; fail?: boolean } = {},
) {
  const calls: Array<{ path: string; params: Record<string, string> }> = [];
  const guards = loadModule("src/utils/discord-admin.ts", {
    "@/utils/api-helpers": {
      fetchWithRetry: async () => { throw new Error("Panel access must use the bot's current permissions"); },
    },
    "@/utils/discord-session-token": {
      getDiscordAccessToken: async () => { throw new Error("Panel access must not trust a Discord listing"); },
    },
    "@/utils/manage-api": {
      botDashboardGet: async (path: string, params: Record<string, string>) => {
        calls.push({ path, params });
        if (options.fail) throw new Error("Bot unavailable");
        return Response.json(answer(), { status: options.status ?? 200 });
      },
    },
  });
  return { check: guards.hasAdminPanelAccess, calls };
}

function routeHarness(
  relativePath: string,
  options: {
    allowed?: boolean;
    cached?: unknown;
    apiData?: unknown;
    apiError?: boolean;
    session?: unknown;
    permissionCheck?: (session: unknown, guild: string) => Promise<boolean>;
    fetcher?: typeof fetch;
  } = {},
) {
  const events: string[] = [];
  const reads: Array<{ url: URL; options?: RequestInit }> = [];
  const posts: Array<{ path: string; params: Record<string, string>; body: any }> = [];
  const invalidated: string[][] = [];
  const stored: Array<{ key: string; value: unknown; ttl: number }> = [];
  const middleware = loadModule("src/utils/api-middleware.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "~/auth": { auth: async () => options.session === undefined ? viewer : options.session },
    "@/utils/site-url": { getSiteUrl: () => "https://website.example" },
  });
  const route = loadModule(relativePath, {
    "next/server": { NextResponse: { json: Response.json } },
    "@/utils/api-middleware": {
      withAuth: middleware.withAuth,
      makeApiRequest: async (url: string, init?: RequestInit) => {
        events.push("bot");
        reads.push({ url: new URL(url), options: init });
        if (options.apiError) throw new Error("Bot rejected write");
        return options.apiData ?? { id: caseId, status: "active" };
      },
    },
    "@/utils/manage-api": {
      botDashboardGet: async () => Response.json({}),
      botDashboardPost: async (path: string, params: Record<string, string>, body: unknown) => {
        posts.push({ path, params, body });
        return Response.json({ ok: true });
      },
      relayBotResponse: async (response: Response) => response,
    },
    "@/utils/discord-admin": {
      hasAdminPanelAccess: async (session: unknown, guild: string) => {
        events.push("permission");
        assert.equal(guild, guildId);
        return options.permissionCheck
          ? options.permissionCheck(session, guild)
          : options.allowed !== false;
      },
    },
    "@/utils/redis": {
      getCached: async () => {
        events.push("cache");
        return options.cached ?? null;
      },
      setCached: async (key: string, value: unknown, ttl: number) => {
        stored.push({ key, value, ttl });
      },
      deleteCached: async (...keys: string[]) => { invalidated.push(keys); },
    },
    "@/server/config": config,
  }, options.fetcher);
  return { route, events, reads, posts, invalidated, stored };
}

function jsonRequest(body: unknown) {
  return new Request("https://website.example/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("joining a department expires both current server-list caches only after a successful join", async () => {
  const removed: string[][] = [];
  const mutual = loadModule("src/utils/mutual-servers.ts", {
    "@/utils/api-helpers": {}, "@/utils/discord-session-token": {},
    "@/utils/redis": { deleteCached: async (...keys: string[]) => { removed.push(keys); } },
    "@/server/config": config,
  });
  const middleware = loadModule("src/utils/api-middleware.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "~/auth": { auth: async () => viewer },
    "@/utils/site-url": { getSiteUrl: () => "https://website.example" },
  });
  let status = 200;
  const posts: any[] = [];
  const route = loadModule("src/app/api/departments/join/route.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "@/utils/api-middleware": middleware,
    "@/utils/mutual-servers": mutual,
    "@/utils/manage-api": {
      botDashboardPost: async (path: string, params: unknown, body: unknown) => {
        posts.push({ path, params, body });
        return Response.json({ joined: status === 200 }, { status });
      },
      relayBotResponse: async (response: Response) => response,
    },
  });
  assert.equal((await route.POST(jsonRequest({ code: "join-test", user: "forged" }))).status, 200);
  assert.deepEqual(posts[0], { path: "dashboard_departmentjoin", params: { server: "0" }, body: { code: "join-test", user: viewer.user.id } });
  assert.deepEqual(removed, [[`discord:servers_and_mutuals:v5:${viewer.user.id}`, `discord:servers_and_mutuals:v5:${viewer.user.id}:stale`]]);
  status = 403;
  assert.equal((await route.POST(jsonRequest({ code: "join-test" }))).status, 403);
  assert.equal(removed.length, 1, "a rejected join cannot invalidate the saved listing");
});

test("rejected application logs exclude private form text and upstream response details", async () => {
  const logs: unknown[][] = [];
  const privateText = "private-applicant-answer-do-not-log";
  const middleware = loadModule("src/utils/api-middleware.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "~/auth": { auth: async () => viewer },
    "@/utils/site-url": { getSiteUrl: () => "https://website.example" },
  });
  const route = loadModule("src/app/api/application/[guildId]/[appId]/route.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "@/utils/api-middleware": middleware,
    "@/utils/manage-api": {
      botDashboardPost: async () => Response.json({ detail: privateText }, { status: 403 }),
      relayBotResponse: async (response: Response) => response,
    },
  }, undefined, { ...quietConsole, error: (...args: unknown[]) => { logs.push(args); } });
  const response = await route.POST(jsonRequest({ answers: { question: privateText } }), { params: Promise.resolve({ guildId, appId: "application" }) });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).detail, privateText, "the bot's error contract still reaches its authorized caller");
  assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(privateText));
  assert.deepEqual(logs[0][1], { guildId, appId: "application", userId: viewer.user.id, status: 403 });
});

const writeRoutes = [
  "owner", "owner/context",
  ...[
    "aicontext", "aigaps", "applicationaiscan", "applicationdecision",
    "applicationpublishstaged", "applicationresponsedelete", "autoresponders",
    "botprofile", "connectionroles", "customcommandai", "customcommands",
    "departmentlink", "departmentprofiles", "deptresources", "staffaction",
    "templates", "ticketpanels", "ticketpanelsend",
  ].map((name) => `manage/[id]/${name}`),
];

test("write proxies keep the signed-in actor even when the browser supplies another user", async (t) => {
  for (const path of writeRoutes) {
    await t.test(path, async () => {
      const { route, posts } = routeHarness(`src/app/api/${path}/route.ts`);
      const response = await route.POST(
        jsonRequest({ user: "attacker-chosen-owner", action: "update", name: "Panel", channel: "channel-1" }),
        { params: Promise.resolve({ id: guildId }) },
      );
      assert.equal(response.status, 200);
      assert.equal(posts.length, 1);
      assert.equal(posts[0].body.user, viewer.user.id);
      assert.equal(posts[0].body.action, "update");
      if (path.startsWith("manage/")) assert.equal(posts[0].params.server, guildId);
    });
  }
});

test("case permissions are checked freshly and fail closed", async (t) => {
  for (const payload of [{}, null, { isAdmin: "true", isStaff: 1 }, { isAdmin: false, isStaff: false }]) {
    await t.test(JSON.stringify(payload), async () => {
      const { check, calls } = loadPermissions(() => payload);
      assert.equal(await check(viewer, guildId), false);
      assert.deepEqual(calls, [{ path: "permissions", params: { server: guildId, user: viewer.user.id } }]);
    });
  }
  for (const payload of [{ isAdmin: true }, { isStaff: true }]) {
    await t.test(JSON.stringify(payload), async () => {
      const { check } = loadPermissions(() => payload);
      assert.equal(await check(viewer, guildId), true);
    });
  }
  const forbidden = loadPermissions(() => ({ isAdmin: true }), { status: 403 });
  assert.equal(await forbidden.check(viewer, guildId), false);
  const unavailable = loadPermissions(() => ({ isAdmin: true }), { fail: true });
  assert.equal(await unavailable.check(viewer, guildId), false);
});

test("an absent or expired session cannot request panel permissions", async () => {
  const { check, calls } = loadPermissions(() => ({ isAdmin: true }));
  assert.equal(await check(null, guildId), false);
  assert.equal(await check({ user: {} }, guildId), false);
  assert.equal(await check({ user: { id: viewer.user.id, authError: "RefreshAccessTokenError" } }, guildId), false);
  assert.equal(calls.length, 0);
});

const caseRoute = "src/app/api/infractions/[id]/[singleid]/route.ts";
const caseContext = () => ({ params: Promise.resolve({ id: guildId, singleid: caseId }) });

test("a cached infraction cannot bypass a revoked permission", async () => {
  let allowed = true;
  const permission = loadPermissions(() => ({ isStaff: allowed }));
  const harness = routeHarness(caseRoute, {
    cached: { id: caseId, notes: "Private record" },
    permissionCheck: permission.check,
  });
  const first = await harness.route.GET(new Request("https://website.example/case"), caseContext());
  assert.equal(first.status, 200);
  assert.equal((await first.json()).notes, "Private record");
  assert.deepEqual(harness.events, ["permission", "cache"]);

  allowed = false;
  const second = await harness.route.GET(new Request("https://website.example/case"), caseContext());
  assert.equal(second.status, 403);
  assert.deepEqual(await second.json(), { message: "Unauthorized" });
  assert.deepEqual(harness.events, ["permission", "cache", "permission"]);
  assert.equal(permission.calls.length, 2);
  assert.equal(harness.reads.length, 0);
});

test("a signed-out visitor cannot read even a cached infraction", async () => {
  const harness = routeHarness(caseRoute, { session: null, cached: { id: caseId } });
  const response = await harness.route.GET(new Request("https://website.example/case"), caseContext());
  assert.equal(response.status, 401);
  assert.deepEqual(harness.events, []);
});

test("authorized uncached case reads await params and use the original bot contract", async () => {
  const harness = routeHarness(caseRoute);
  const response = await harness.route.GET(new Request("https://website.example/case"), caseContext());
  assert.equal(response.status, 200);
  assert.deepEqual(harness.events, ["permission", "cache", "bot"]);
  assert.equal(harness.reads[0].url.pathname, "/infraction");
  assert.equal(harness.reads[0].url.searchParams.get("server"), guildId);
  assert.equal(harness.reads[0].url.searchParams.get("id"), caseId);
  assert.deepEqual(harness.stored, [{ key: `infraction:${guildId}:${caseId}`, value: { id: caseId, status: "active" }, ttl: 300 }]);
});

test("case mutation handlers accept only their write verb and clear caches after success", async (t) => {
  for (const [suffix, verb, botPath, botMethod] of [
    ["delete", "DELETE", "/delinfraction", "DELETE"],
    ["update", "PUT", "/UpdateInfraction", "POST"],
  ]) {
    await t.test(suffix, async () => {
      const harness = routeHarness(`src/app/api/infractions/[id]/[singleid]/${suffix}/route.ts`);
      assert.equal(harness.route.HEAD, undefined);
      assert.equal(harness.route.OPTIONS, undefined);
      const response = await harness.route[verb](jsonRequest({ notes: "Updated" }), caseContext());
      assert.equal(response.status, 200);
      assert.equal(harness.reads[0].url.pathname, botPath);
      assert.equal(harness.reads[0].options?.method, botMethod);
      assert.deepEqual(harness.invalidated, [[`infraction:${guildId}:${caseId}`, `infractions:${guildId}`]]);
    });
  }
});

test("denied or failed writes do not mutate records or invalidate successful reads", async (t) => {
  for (const [suffix, verb] of [["delete", "DELETE"], ["update", "PUT"]]) {
    await t.test(suffix, async () => {
      const denied = routeHarness(`src/app/api/infractions/[id]/[singleid]/${suffix}/route.ts`, { allowed: false });
      assert.equal((await denied.route[verb](jsonRequest({ notes: "Updated" }), caseContext())).status, 403);
      assert.equal(denied.reads.length, 0);
      assert.equal(denied.invalidated.length, 0);
      const failed = routeHarness(`src/app/api/infractions/[id]/[singleid]/${suffix}/route.ts`, { apiError: true });
      assert.equal((await failed.route[verb](jsonRequest({ notes: "Updated" }), caseContext())).status, 500);
      assert.equal(failed.invalidated.length, 0);
    });
  }
});

test("malformed case updates return a client error without calling the bot", async () => {
  const harness = routeHarness("src/app/api/infractions/[id]/[singleid]/update/route.ts");
  const response = await harness.route.PUT(new Request("https://website.example/case", { method: "PUT", body: "{" }), caseContext());
  assert.equal(response.status, 400);
  assert.equal(harness.reads.length, 0);
});

test("guild lookup accepts async params and preserves its response shape", async () => {
  const harness = routeHarness("src/app/api/guild/[id]/route.ts", { apiData: { mutual: [{ id: guildId }] } });
  const response = await harness.route.GET(new Request("https://website.example/guild"), { params: Promise.resolve({ id: guildId }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mutualGuilds: [{ id: guildId }] });
  assert.deepEqual(JSON.parse(String(harness.reads[0].options?.body)), { user: viewer.user.id, guilds: [guildId] });
});

const transcriptData = { GuildID: guildId, transcript: [{ compact: [{ content: "Private transcript" }] }] };

test("transcripts require an explicit current permission before returning content", async (t) => {
  for (const [payload, status] of [[{}, 403], [{ isAdmin: "true" }, 403], [{ isStaff: true }, 200]] as const) {
    await t.test(JSON.stringify(payload), async () => {
      const permission = loadPermissions(() => payload);
      const harness = routeHarness("src/app/api/transcript/[id]/route.ts", {
        permissionCheck: permission.check,
        fetcher: async (url) => {
          const target = new URL(String(url));
          assert.equal(target.pathname, "/transcript");
          assert.equal(target.searchParams.get("id"), "ticket&other=value");
          return Response.json(transcriptData);
        },
      });
      const response = await harness.route.GET(new Request("https://website.example/transcript"), {
        params: Promise.resolve({ id: "ticket&other=value" }),
      });
      assert.equal(response.status, status);
      const data = await response.json();
      if (status === 200) assert.deepEqual(data, { data: transcriptData, compact: transcriptData.transcript[0].compact, GuildID: guildId });
      else assert.equal(data.compact, undefined);
    });
  }
});

test("missing or invalid transcript data fails without exposing upstream errors", async (t) => {
  for (const [body, expected] of [
    [{ transcript: [] }, 404],
    [{ transcript: [{ compact: [] }] }, 502],
    [{ GuildID: guildId, transcript: [{ compact: null }] }, 502],
    [{}, 502],
  ] as const) {
    await t.test(JSON.stringify(body), async () => {
      const harness = routeHarness("src/app/api/transcript/[id]/route.ts", { fetcher: async () => Response.json(body) });
      const response = await harness.route.GET(new Request("https://website.example/transcript"), { params: Promise.resolve({ id: "ticket-1" }) });
      assert.equal(response.status, expected);
      assert.equal(harness.events.length, 0);
    });
  }
  const failed = routeHarness("src/app/api/transcript/[id]/route.ts", {
    fetcher: async () => { throw new Error("private upstream connection details"); },
  });
  const response = await failed.route.GET(new Request("https://website.example/transcript"), { params: Promise.resolve({ id: "ticket-1" }) });
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private upstream/);
});
