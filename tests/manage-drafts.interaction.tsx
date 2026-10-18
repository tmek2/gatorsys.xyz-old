import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act, useState } from "react";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

// Browser styles are checked in the rendered app, not by the DOM test runner.
const require = createRequire(import.meta.url);
require.extensions[".css"] = () => undefined;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost",
});
const win = dom.window;
Object.assign(globalThis, {
  window: win,
  document: win.document,
  HTMLElement: win.HTMLElement,
  HTMLInputElement: win.HTMLInputElement,
  HTMLTextAreaElement: win.HTMLTextAreaElement,
  Element: win.Element,
  Event: win.Event,
  MouseEvent: win.MouseEvent,
  MutationObserver: win.MutationObserver,
  localStorage: win.localStorage,
  getComputedStyle: win.getComputedStyle,
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  IS_REACT_ACT_ENVIRONMENT: true,
});
win.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as any;

async function mount(node: React.ReactNode) {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return {
    container,
    async close() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

async function departmentHost(node: React.ReactNode) {
  const { WorkspaceHostProvider } = await import("../src/components/Manage/workspace-host");
  return <WorkspaceHostProvider value={{ guildId: "100", meta: null, setNotice: () => undefined, refreshConfig: async () => undefined }}>{node}</WorkspaceHostProvider>;
}

test("bot identity retries a failed load on focus after its cooldown and shares the request", async () => {
  const { useBotIdentity, refreshBotIdentity, publishBotIdentity } = await import("../src/components/Manage/bot-identity");
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 1_000_000;
  let calls = 0;
  Date.now = () => now;
  globalThis.fetch = (async () => {
    calls += 1;
    return calls === 1 ? Response.json({}, { status: 503 }) : Response.json({ profile: { display_name: `Recovered ${calls}` } });
  }) as typeof fetch;
  function Preview() { return <output>{useBotIdentity("identity-retry-test").name}</output>; }
  const m = await mount(<><Preview /><Preview /></>);
  try {
    assert.equal(calls, 1);
    assert.equal(m.container.textContent, "BotBot");
    await act(async () => win.dispatchEvent(new win.Event("focus")));
    assert.equal(calls, 1, "focus cannot hammer a failed request");
    now += 30_000;
    await act(async () => win.dispatchEvent(new win.Event("focus")));
    assert.equal(calls, 2, "both previews share one retry");
    assert.equal(m.container.textContent, "Recovered 2Recovered 2");
    await act(async () => win.dispatchEvent(new win.Event("focus")));
    assert.equal(calls, 2, "successful loads do not refetch on every focus");
    await act(async () => publishBotIdentity("identity-retry-test", { name: "Draft name", avatar: "/icon.svg" }));
    await act(async () => { await refreshBotIdentity("identity-retry-test"); });
    assert.equal(calls, 3);
    assert.equal(m.container.textContent, "Draft nameDraft name", "refresh preserves an active customization draft");
    await act(async () => publishBotIdentity("identity-retry-test", null));
    assert.equal(m.container.textContent, "Recovered 3Recovered 3");
  } finally {
    await m.close();
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("announcement mentions render and open only the exact matched member", async () => {
  const { MentionText } = await import("../src/components/Manage/department-workspace/mentions");
  const m = await mount(<MentionText text="Ask @Anna, @Annex and <@ann>." members={[
    { id: "ann", name: "Ann" }, { id: "anna", name: "Anna" },
  ]} />);
  try {
    const mentions = [...m.container.querySelectorAll<HTMLButtonElement>("button")];
    assert.deepEqual(mentions.map((button) => button.textContent), ["@Anna", "@Ann"]);
    assert.equal(m.container.textContent, "Ask @Anna, @Annex and @Ann.");
    await act(async () => mentions[0].click());
    assert.ok(document.querySelector('[aria-label="Anna profile"]'));
    assert.equal(document.querySelector('a[href="https://discord.com/users/ann"]'), null);
  } finally { await m.close(); }
});

test("posting after replacing a picked mention does not retain the old recipient", async () => {
  const { HomePage } = await import("../src/components/Manage/department-workspace/home-page");
  const originalFetch = globalThis.fetch;
  let posted: any;
  globalThis.fetch = (async (_url, init) => {
    posted = JSON.parse(String(init?.body));
    return Response.json({});
  }) as typeof fetch;
  const m = await mount(await departmentHost(<HomePage profile={{ id: "department", name: "Operations" } as any} feature={{}} viewer={{ id: "manager", name: "Manager" } as any} roster={{ memberRows: [
    { id: "ann", name: "Ann" }, { id: "anna", name: "Anna" },
  ] } as any} announcements={[]} resources={[]} roles={[]} canPost onRunAction={() => undefined} onOpenResource={() => undefined} onRefresh={async () => undefined} />));
  try {
    const area = m.container.querySelector<HTMLTextAreaElement>("textarea")!;
    async function type(value: string) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(area, value);
        area.setSelectionRange(value.length, value.length);
        area.dispatchEvent(new win.Event("input", { bubbles: true }));
      });
    }
    await type("@Ann");
    const choice = [...m.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Ann")!;
    await act(async () => choice.click());
    await type("Ask @Anna!");
    const post = [...m.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Post")!;
    await act(async () => post.click());
    assert.deepEqual(posted.mention_user_ids, ["anna"]);
  } finally {
    await m.close();
    globalThis.fetch = originalFetch;
  }
});

test("formatting works from keyboard activation and a pointer press formats once", async () => {
  const { MarkdownToolbar } = await import("../src/components/Manage/markdown-toolbar");
  const editor = document.createElement("div");
  const field = document.createElement("textarea");
  editor.append(field);
  document.body.append(editor);
  (editor as any).__lastFocused = field;
  const m = await mount(<MarkdownToolbar containerRef={{ current: editor }} />);
  try {
    field.value = "hello";
    field.setSelectionRange(0, 5);
    const bold = m.container.querySelector<HTMLButtonElement>('[aria-label="Bold"]')!;
    await act(async () => bold.click());
    assert.equal(field.value, "**hello**");
    await act(async () => {
      bold.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, detail: 1 }));
      bold.dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 1 }));
    });
    assert.equal(field.value, "hello", "one pointer press toggles the formatting only once");
  } finally {
    await m.close();
    editor.remove();
  }
});

test("sharing searches handles, lists people truthfully and adds keyboard choices once", async () => {
  const { ShareAccessPanel } = await import("../src/components/Manage/share-access-panel");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    roles: [{ id: "r1", name: "Reviewers", managed: false }],
    members: [
      { id: "u1", name: "River", username: "river.operator", avatar: null },
      { id: "u1", name: "River", username: "river.operator", avatar: null },
    ],
  }), { headers: { "Content-Type": "application/json" } })) as typeof fetch;
  let saved: any;
  function Panel() {
    const [resource, setResource] = useState({ id: "doc", share: { entries: [] } });
    return <ShareAccessPanel resource={resource} guildId="sharing-test" onChange={(next) => {
      saved = next;
      setResource(next);
    }} onClose={() => undefined} />;
  }
  const m = await mount(<Panel />);
  try {
    const input = m.container.querySelector<HTMLInputElement>('[aria-label="Add people or roles"]')!;
    await act(async () => {
      input.focus();
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, "@river.operator");
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
    });
    const candidates = [...m.container.querySelectorAll<HTMLButtonElement>("button")]
      .filter((button) => button.textContent?.includes("river.operator"));
    assert.equal(candidates.length, 1, "the directory cannot offer the same person twice");
    assert.match(m.container.textContent || "", /People and roles/);
    await act(async () => candidates[0].click());
    assert.equal(saved.share.entries.length, 1);
    assert.equal(saved.share.entries[0].id, "user:u1");
    assert.equal(saved.share.entries[0].type, "user");
    assert.match(m.container.textContent || "", /Person/);
  } finally {
    await m.close();
    globalThis.fetch = originalFetch;
  }
});

test("metadata cooldown stops its interval when refresh becomes available", async () => {
  const { ManageProvider, useManage } = await import("../src/components/Manage/manage-context");
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const originalSet = win.setInterval;
  const originalClear = win.clearInterval;
  let now = 1_000_000;
  let tick: (() => void) | undefined;
  const cleared: number[] = [];
  Date.now = () => now;
  win.setInterval = ((callback: () => void) => { tick = callback; return 71; }) as typeof win.setInterval;
  win.clearInterval = ((id: number) => { cleared.push(id); }) as typeof win.clearInterval;
  globalThis.fetch = (async (url: unknown) => new Response(JSON.stringify(
    String(url).includes("/config") ? { config: {} } : { guild: { id: "cooldown-test" }, roles: [], channels: [], modules: {} },
  ), { headers: { "Content-Type": "application/json" } })) as typeof fetch;
  let context: ReturnType<typeof useManage>;
  function Observer() { context = useManage(); return null; }
  const m = await mount(<ManageProvider guildId="cooldown-test" viewerId="test-user"><Observer /></ManageProvider>);
  try {
    await act(async () => { await context.refreshMeta(); });
    assert.equal(context!.metaCooldown, 30);
    now += 30_000;
    await act(async () => tick!());
    assert.equal(context!.metaCooldown, 0);
    assert.deepEqual(cleared, [71]);
  } finally {
    await m.close();
    Date.now = originalNow;
    win.setInterval = originalSet;
    win.clearInterval = originalClear;
    globalThis.fetch = originalFetch;
  }
});

test("a cached dashboard restores staged removals and saves the unset request", async () => {
  const { ManageProvider, useManage } = await import("../src/components/Manage/manage-context");
  const originalFetch = globalThis.fetch;
  let write: any;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (init?.method === "PATCH") write = JSON.parse(String(init.body));
    const data = String(url).includes("/config")
      ? { config: init?.method === "PATCH" ? { Welcome: {} } : { Welcome: { channel: "channel-id" } } }
      : { guild: { id: "restore-test" }, roles: [], channels: [], modules: {} };
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  let context: ReturnType<typeof useManage>;
  function Observer() { context = useManage(); return null; }
  const dashboard = () => <ManageProvider guildId="restore-test" viewerId="test-user"><Observer /></ManageProvider>;
  let m = await mount(dashboard());
  try {
    await act(async () => context.stage("Welcome.channel", undefined));
    assert.equal(context!.dirty, true);
    await m.close();
    m = await mount(dashboard());
    assert.ok(Object.hasOwn(context!.pending, "Welcome.channel"));
    assert.equal(context!.value("Welcome.channel"), undefined);
    await act(async () => { assert.equal(await context.save(), true); });
    assert.deepEqual(write.unset, ["Welcome.channel"]);
    assert.deepEqual(write.set, {});
    assert.equal(context!.dirty, false);
  } finally {
    await m.close();
    globalThis.fetch = originalFetch;
  }
});

test("disabled module fields are inert until the module is enabled", async () => {
  const { ManageProvider } = await import("../src/components/Manage/manage-context");
  const { ModuleGate } = await import("../src/components/Manage/module-gate");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown) => new Response(JSON.stringify(
    String(url).includes("/config") ? { config: { Modules: { Shifts: false } } } : { guild: { id: "gate-test" }, roles: [], channels: [], modules: {} },
  ), { headers: { "Content-Type": "application/json" } })) as typeof fetch;
  const m = await mount(<ManageProvider guildId="gate-test" viewerId="test-user"><ModuleGate moduleKey="Shifts" moduleLabel="Shifts" onGoBack={() => undefined}><input aria-label="Hidden setting" /></ModuleGate></ManageProvider>);
  try {
    assert.ok(m.container.querySelector('[aria-label="Hidden setting"]')!.closest("[inert]"));
  } finally {
    await m.close();
    globalThis.fetch = originalFetch;
  }
});

test("typing a point stage name keeps the same focused input through edits and moves", async () => {
  const { DepartmentPointsSystem } = await import("../src/components/Manage/department-points");
  function Points() {
    const [value, setValue] = useState<import("../src/components/Manage/department-points").PointsSystem>({ stages: [
      { name: "Warning", points: 1, type: "warning" as const },
      { name: "Final warning", points: 3, type: "warning" as const },
    ] });
    return <DepartmentPointsSystem value={value} onChange={setValue} />;
  }
  const m = await mount(<Points />);
  try {
    const name = m.container.querySelector<HTMLInputElement>('input[placeholder="Stage name"]')!;
    await act(async () => {
      name.focus();
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(name, "Written warning");
      name.dispatchEvent(new win.Event("input", { bubbles: true }));
    });
    assert.equal(document.activeElement, name);
    assert.equal(m.container.querySelector('input[placeholder="Stage name"]'), name);
    const move = m.container.querySelector<HTMLButtonElement>('[aria-label="Move Written warning down"]')!;
    await act(async () => move.click());
    assert.equal(m.container.querySelectorAll('input[placeholder="Stage name"]')[1], name);
    assert.equal(name.value, "Written warning");
  } finally {
    await m.close();
  }
});

test("leave requests follow optional reason and end-date settings", async () => {
  const ts = require("typescript");
  const compiled = ts.transpileModule(readFileSync(new URL("../src/components/Manage/department-workspace/leave-page.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as any };
  const fields = require("../src/components/Manage/fields.tsx");
  const loadDependency = (name: string) => {
    if (name === "../fields") return { ...fields, DateRangeField: ({ onChange }: { onChange: (start: string, end: string) => void }) => <button aria-label="Choose start only" onClick={() => onChange("2026-10-20", "")}>Choose start only</button> };
    if (name.startsWith("../")) return require(`../src/components/Manage/${name.slice(3)}.tsx`);
    if (name === "./shared") return require("../src/components/Manage/department-workspace/shared.tsx");
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(loadDependency, loaded, loaded.exports);
  const Leave = loaded.exports.LeavePage;
  const { WorkspaceHostProvider } = await import("../src/components/Manage/workspace-host");
  let setRequired: (value: boolean) => void;
  const originalFetch = globalThis.fetch;
  let write: any;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    write = JSON.parse(String(init?.body));
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  function Page() {
    const [required, update] = useState(false);
    setRequired = update;
    return <WorkspaceHostProvider value={{ guildId: "leave-test", meta: null, setNotice: () => undefined, refreshConfig: async () => undefined }}><Leave profile={{ id: "department" }} feature={{ loa: { require_reason: required, require_end_date: required } }} can={() => false} onStage={() => undefined} onRefresh={async () => undefined} /></WorkspaceHostProvider>;
  }
  const m = await mount(<Page />);
  try {
    const request = [...m.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Request leave"))!;
    await act(async () => request.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Choose start only"]')!.click());
    const submit = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Submit request")!;
    assert.equal(submit.disabled, false, "start-only leave is allowed when reason and end are optional");
    await act(async () => setRequired(true));
    assert.equal(submit.disabled, true, "enabling requirements blocks the same incomplete request");
    await act(async () => setRequired(false));
    await act(async () => submit.click());
    assert.equal(write.action, "loa_request");
    assert.equal(write.starts_at, "2026-10-20");
    assert.equal(write.ends_at, null);
    assert.equal(write.reason, "");
  } finally {
    await m.close();
    globalThis.fetch = originalFetch;
  }
});

test("department role linking is reachable and creates a mapping for the linked server", async () => {
  const { SettingsPage } = await import("../src/components/Manage/department-workspace/settings-page");
  const changes: [string, any][] = [];
  const m = await mount(await departmentHost(<SettingsPage profile={{ id: "department", name: "Operations" } as any} feature={{}} code="" onCode={async () => undefined} onStage={(path, value) => changes.push([path, value])} onProfile={() => undefined} resources={[]} onRefresh={async () => undefined} linkedServer={{ id: "200", name: "Training", reachable: true }} roles={[]} channels={[]} />));
  try {
    const linking = [...m.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Role Linking")!;
    await act(async () => linking.click());
    assert.match(m.container.textContent || "", /Discord role linking/);
    const create = [...m.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "New mapping")!;
    await act(async () => create.click());
    assert.equal(changes[0][0], "cross_role_links");
    assert.equal(changes[0][1][0].trigger_guild_id, "100");
    assert.equal(changes[0][1][0].target_guild_id, "200");
  } finally {
    await m.close();
  }
});

test("the roster includes members with missing and deleted ranks and keeps their actions", async () => {
  const { RosterPage } = await import("../src/components/Manage/department-workspace/roster-page");
  const roster: any = { members: 3, onLoa: 0, ranks: [], memberRows: [
    { id: "one", name: "Alex", username: "alex", rankRoleId: "active", rankName: "Officer", avatar: null },
    { id: "two", name: "Morgan", username: "morgan", rankRoleId: null, rankName: "Unranked", avatar: null },
    { id: "three", name: "River", username: "river", rankRoleId: "deleted", rankName: "Former rank", avatar: null },
  ] };
  const m = await mount(await departmentHost(<RosterPage profile={{ id: "department", name: "Operations" } as any} roster={roster} feature={{ ranks: [{ id: "active", name: "Officer", permissions: [] }] }} viewerId="manager" can={() => true} onStage={() => undefined} onProfile={() => undefined} onRefresh={async () => undefined} roles={[]} />));
  try {
    assert.equal(m.container.querySelectorAll(".roster-row").length, 3);
    const group = [...m.container.querySelectorAll("section")].find((section) => section.querySelector(".roster-head")?.textContent?.includes("Unranked"))!;
    assert.equal(group.querySelectorAll(".roster-row").length, 2);
    assert.equal(group.hasAttribute("data-rank-section"), false, "unranked is a display group, not a rank the bot can assign");
    const actions = m.container.querySelector<HTMLButtonElement>('[aria-label="Actions for River"]')!;
    await act(async () => actions.click());
    assert.ok([...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Promote"));
  } finally {
    await m.close();
  }
});

test("a failed announcement deletion puts the post back on screen", async () => {
  const { HomePage } = await import("../src/components/Manage/department-workspace/home-page");
  const originalFetch = globalThis.fetch;
  let release: (value: Response) => void;
  globalThis.fetch = (() => new Promise<Response>((resolve) => { release = resolve; })) as typeof fetch;
  localStorage.setItem("gator-skip-shout-delete", "1");
  const m = await mount(await departmentHost(<HomePage profile={{ id: "department", name: "Operations" } as any} feature={{}} viewer={null} announcements={[{ id: "post-1", author: "Team", content: "Keep this announcement", created_at: "2026-10-17T12:00:00Z" }]} resources={[]} onRefresh={async () => undefined} onRunAction={() => undefined} onOpenResource={() => undefined} roles={[]} />));
  try {
    await act(async () => m.container.querySelector<HTMLButtonElement>('article [aria-label="Delete"]')!.click());
    assert.equal(m.container.querySelector('[data-shout-id="post-1"]'), null);
    await act(async () => release(new Response('{"detail":"Deletion failed"}', { status: 500 })));
    assert.match(m.container.querySelector('[data-shout-id="post-1"]')!.textContent || "", /Keep this announcement/);
  } finally {
    await m.close();
    globalThis.fetch = originalFetch;
    localStorage.removeItem("gator-skip-shout-delete");
  }
});

test("a failed announcement keeps its reply, attachment, resource and schedule for retry", async () => {
  const { HomePage } = await import("../src/components/Manage/department-workspace/home-page");
  const originalFetch = globalThis.fetch;
  const originalReader = globalThis.FileReader;
  globalThis.FileReader = win.FileReader;
  const writes: any[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    writes.push(JSON.parse(String(init?.body)));
    return new Response(writes.length === 1 ? '{"detail":"Post failed"}' : "{}", { status: writes.length === 1 ? 500 : 200 });
  }) as typeof fetch;
  const m = await mount(await departmentHost(<HomePage profile={{ id: "department", name: "Operations" } as any} feature={{}} viewer={null} announcements={[{ id: "post-1", author: "Team", content: "Original", created_at: "2026-10-17T12:00:00Z" }]} resources={[{ id: "guide", title: "Operations guide", kind: "document" }]} onRefresh={async () => undefined} onRunAction={() => undefined} onOpenResource={() => undefined} roles={[]} />));
  const clickText = async (text: string, root: ParentNode = m.container) => {
    const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim().startsWith(text));
    assert.ok(button, `missing button: ${text}`);
    await act(async () => button.click());
  };
  try {
    const textarea = m.container.querySelector<HTMLTextAreaElement>("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "A scheduled reply");
      textarea.dispatchEvent(new win.Event("input", { bubbles: true }));
    });
    await act(async () => m.container.querySelector<HTMLButtonElement>('[aria-label="Reply to Team"]')!.click());
    const file = m.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(file, "files", { configurable: true, value: [new win.File(["notes"], "notes.pdf", { type: "application/pdf" })] });
    await act(async () => {
      file.dispatchEvent(new win.Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    await clickText("More options");
    await clickText("Attach a Bot resource");
    await clickText("Operations guide", document);
    await clickText("More options");
    await clickText("Schedule this shout");
    await act(async () => m.container.querySelector<HTMLButtonElement>('[aria-label="Increase days"]')!.click());
    await clickText("Schedule");
    assert.equal(textarea.value, "A scheduled reply");
    assert.match(m.container.textContent || "", /notes.pdf/);
    assert.match(m.container.textContent || "", /Operations guide/);
    assert.match(m.container.textContent || "", /Replying to Team/);
    await clickText("Schedule");
    assert.equal(writes.length, 2);
    for (const body of writes) {
      assert.equal(body.content, "A scheduled reply");
      assert.equal(body.reply_to, "post-1");
      assert.equal(body.resource_id, "guide");
      assert.equal(body.attachment.name, "notes.pdf");
      assert.ok(new Date(body.scheduled_for).getTime() > Date.now() + 23 * 3600_000);
    }
  } finally {
    await m.close();
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  }
});

test("the Home profile shows the hour requirement configured under Activity", async () => {
  const { HomePage } = await import("../src/components/Manage/department-workspace/home-page");
  const m = await mount(await departmentHost(<HomePage profile={{ id: "department", name: "Operations" } as any} feature={{ activity: { required_hours: 3 } }} activity={{ viewer: { seconds: 3600 } }} viewer={null} announcements={[]} resources={[]} onRefresh={async () => undefined} onRunAction={() => undefined} onOpenResource={() => undefined} roles={[]} />));
  try {
    assert.match(m.container.textContent || "", /Hour requirement/);
    assert.match(m.container.textContent || "", /1.0 \/ 3 hrs/);
  } finally {
    await m.close();
  }
});

test("the department application remains open on failed saves and retries its complete draft", async () => {
  const ts = require("typescript");
  const filename = new URL("../src/components/Manage/department-workspace/application-editor-screen.tsx", import.meta.url);
  const localRequire = createRequire(filename);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as any };
  new Function("require", "module", "exports", compiled)((name: string) => name === "./questions" ? { QuestionList: () => null } : localRequire(name), loaded, loaded.exports);
  const Application = loaded.exports.ApplicationEditorScreen;
  let rejectSave = true;
  let closed = false;
  let saved: any;
  function Editor() {
    const [resource, setResource] = useState({ id: "application", title: "Original", questions: [] });
    return <Application resource={resource} profile={{ id: "department", name: "Operations" }} channels={[]} responses={[]} resources={[]} onChange={setResource} onSave={async () => {
      if (rejectSave) return false;
      saved = resource;
      return true;
    }} onClose={() => { closed = true; }} onDelete={async () => undefined} onRefresh={async () => undefined} />;
  }
  const m = await mount(await departmentHost(<Editor />));
  try {
    const title = m.container.querySelector<HTMLInputElement>('[aria-label="Application title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(title, "Unsaved application");
      title.dispatchEvent(new win.Event("input", { bubbles: true }));
    });
    const close = m.container.querySelector<HTMLButtonElement>('header [aria-label="Close"]')!;
    await act(async () => close.click());
    assert.equal(closed, false);
    assert.match(m.container.querySelector('[role="alert"]')!.textContent || "", /Could not save/);
    assert.equal(title.value, "Unsaved application");
    rejectSave = false;
    await act(async () => close.click());
    assert.equal(closed, true);
    assert.equal(saved.title, "Unsaved application");
  } finally {
    await m.close();
  }
});

test("a document stays open after a failed save and closes after a successful retry", async () => {
  const { DepartmentDocumentEditor } = await import("../src/components/Manage/department-document-editor");
  let rejectSave = true;
  let closed = false;
  let savedTitle = "";
  function Document() {
    const [resource, setResource] = useState({ id: "save-test", title: "Original", document_html: "<p>Notes</p>" });
    return <DepartmentDocumentEditor resource={resource} onChange={setResource} onSave={async () => {
      if (rejectSave) throw new Error("Save service unavailable");
      savedTitle = resource.title;
    }} onClose={() => { closed = true; }} onDelete={async () => undefined} />;
  }
  const m = await mount(<Document />);
  try {
    const title = m.container.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(title, "Unsaved notes");
      title.dispatchEvent(new win.Event("input", { bubbles: true }));
    });
    const close = m.container.querySelector<HTMLButtonElement>('header [aria-label="Close"]')!;
    await act(async () => close.click());
    assert.equal(closed, false);
    assert.equal(title.value, "Unsaved notes");
    assert.match(m.container.querySelector('[role="alert"]')!.textContent || "", /Save service unavailable/);
    rejectSave = false;
    await act(async () => close.click());
    assert.equal(closed, true);
    assert.equal(savedTitle, "Unsaved notes");
  } finally {
    await m.close();
  }
});

test("closing a spreadsheet flushes cells before saving and shares a spreadsheet URL", async () => {
  // Render the real component with a small workbook runtime. Univer itself
  // needs a canvas; this test exercises our save boundary and link handling.
  const ts = require("typescript");
  const filename = new URL("../src/components/Manage/department-spreadsheet-editor.tsx", import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let snapshot: any;
  const handlers: Record<string, (event: unknown) => void> = {};
  const workbook = { save: () => snapshot };
  const api = {
    Event: { SheetValueChanged: "value", SheetNameChanged: "name", CommandExecuted: "command" },
    createWorkbook(initial: any) { snapshot = initial; return workbook; },
    addEvent(name: string, handler: (event: unknown) => void) { handlers[name] = handler; return { dispose() {} }; },
  };
  const loaded = { exports: {} as any };
  const loadDependency = (name: string) => {
    if (name.endsWith(".css")) return {};
    if (name === "@univerjs/presets") return { createUniver: () => ({ univer: { dispose() {} }, univerAPI: api }), LocaleType: { EN_US: "enUS" }, mergeLocales: () => ({}) };
    if (name === "@univerjs/themes") return { defaultTheme: {} };
    if (name.startsWith("@univerjs/preset-sheets-")) {
      if (name.includes("/locales/")) return { default: {} };
      const kind = name.split("preset-sheets-")[1].split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join("");
      return { [`UniverSheets${kind}Preset`]: () => ({}) };
    }
    if (name.includes("version-history")) return { VersionHistory: () => null };
    if (name === "./share-access-panel") return { ShareAccessPanel: ({ shareUrl }: { shareUrl: string }) => <output data-testid="share-url">{shareUrl}</output> };
    if (name === "@/utils/short-links") return require("../src/utils/short-links.ts");
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(loadDependency, loaded, loaded.exports);
  const Spreadsheet = loaded.exports.DepartmentSpreadsheetEditor;
  let saved: any;
  let closed = false;
  function Sheet() {
    const [resource, setResource] = useState({ id: "sheet-save-test", title: "Tracker", spreadsheet_data: [] });
    return <Spreadsheet resource={resource} guildId="100" onChange={setResource} onSave={async () => { saved = resource; }} onClose={() => { closed = true; }} onDelete={async () => undefined} />;
  }
  const m = await mount(<Sheet />);
  try {
    assert.ok(handlers.command, "the workbook initialized and registered edit events");
    const share = [...m.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Share")!;
    await act(async () => share.click());
    assert.match(m.container.querySelector('[data-testid="share-url"]')!.textContent || "", /\/spreadsheet\//);
    snapshot.sheets["sheet-1"].cellData = { 0: { 0: { v: "Latest cell" } } };
    await act(async () => handlers.command({ type: 2, id: "set-cell" }));
    const close = m.container.querySelector<HTMLButtonElement>('header [aria-label="Close"]')!;
    await act(async () => close.click());
    assert.equal(closed, true);
    assert.equal(saved.spreadsheet_data[0][0], "Latest cell");
    assert.equal(saved.spreadsheet_snapshot.sheets["sheet-1"].cellData[0][0].v, "Latest cell");
  } finally {
    await m.close();
  }
});
