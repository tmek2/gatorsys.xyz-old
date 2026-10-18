import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".css"] = () => undefined;
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true, url: "https://website.example" });
const win = dom.window;
Object.assign(globalThis, {
  window: win, document: win.document, localStorage: win.localStorage,
  HTMLElement: win.HTMLElement, Element: win.Element, Node: win.Node,
  HTMLInputElement: win.HTMLInputElement, HTMLTextAreaElement: win.HTMLTextAreaElement,
  Event: win.Event, MouseEvent: win.MouseEvent, MutationObserver: win.MutationObserver,
  getComputedStyle: win.getComputedStyle, requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win), IS_REACT_ACT_ENVIRONMENT: true,
});
win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as any;

function loadComponent(path: string, overrides: Record<string, unknown>) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as any };
  new Function("require", "module", "exports", compiled)((name: string) => name in overrides
    ? overrides[name] : require(name.startsWith(".") ? resolve(dirname(filename), name) : name), loaded, loaded.exports);
  return loaded.exports;
}

async function mount(node: React.ReactNode) {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return {
    container,
    async show(next: React.ReactNode) { await act(async () => root.render(next)); },
    async close() { await act(async () => root.unmount()); container.remove(); },
  };
}

function button(parent: ParentNode, text: string) {
  const node = [...parent.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text);
  assert.ok(node, `Missing ${text} button`);
  return node;
}

test("a submitted dropdown is inert and closing it for review cannot change its answer", async () => {
  const { FormQuestionField } = await import("../src/components/form-question-field");
  const changes: string[] = [];
  const question = { id: "choice", question: "Choose", type: "multiple_choice", display: "dropdown", options: [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }] };
  const field = (disabled: boolean) => <FormQuestionField question={question} value="a" onChange={(value) => changes.push(value)} disabled={disabled} />;
  const m = await mount(field(true));
  try {
    const trigger = () => m.container.querySelector<HTMLButtonElement>(".gw-picker-trigger")!;
    assert.equal(trigger().disabled, true);
    await act(async () => trigger().click());
    assert.equal(document.querySelector('[role="listbox"]'), null);
    await m.show(field(false));
    await act(async () => trigger().click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.ok(document.querySelector('[role="listbox"]'));
    await m.show(field(true));
    assert.equal(trigger().disabled, true);
    assert.equal(document.querySelector('[role="listbox"]'), null);
    assert.deepEqual(changes, []);
    assert.match(trigger().textContent || "", /Option A/);
  } finally { await m.close(); }
});

test("verification handles already-decoded and malformed percent text without query injection", async () => {
  const queries: string[] = [];
  let value = "%E0%A4%A&other=1";
  const { default: Verified } = loadComponent("../src/app/verified/page.tsx", {
    react: { ...React, use: () => ({ u: value }) },
    "@/components/status-screen": { StatusScreen: ({ title }: any) => <h1>{title}</h1> },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url) => { queries.push(String(url)); return Response.json({ username: "PreviewPlayer" }); }) as typeof fetch;
  const m = await mount(<Verified searchParams={Promise.resolve({})} />);
  try {
    assert.equal(queries[0], `/api/roblox?id=${encodeURIComponent(value)}`);
    assert.match(m.container.textContent || "", /Welcome, PreviewPlayer/);
    value = "12345";
    await m.show(<Verified searchParams={Promise.resolve({})} />);
    assert.equal(queries[1], "/api/roblox?id=12345");
  } finally { await m.close(); globalThis.fetch = originalFetch; }
});

test("the actual Roblox account page supplies only local return links to its connection control", async () => {
  const { default: Page } = loadComponent("../src/app/account/roblox/page.tsx", {
    "~/auth": { auth: async () => ({ user: { id: "viewer" } }) },
    "next/navigation": { redirect: () => { throw new Error("Unexpected sign-in redirect"); } },
    "@/components/site/site-nav": { SiteNav: () => null },
    "@/components/site/site-footer": { SiteFooter: () => null },
    "@/components/roblox-account-card": { RobloxAccountCard: ({ callbackUrl }: any) => <output>{callbackUrl}</output> },
    "@/components/tidy-url": { TidyUrl: () => null },
    "@/components/site/dot-field": { DotField: () => null },
  });
  for (const target of ["//outside.example/path", "/\\outside.example/path", "/manage/123?tab=resources"]) {
    const m = await mount(await Page({ searchParams: Promise.resolve({ callbackUrl: target }) }));
    try { assert.equal(m.container.querySelector("output")!.textContent, target.startsWith("/manage") ? target : "/servers"); }
    finally { await m.close(); }
  }
});

test("department save failures retain newer edits for retry, serialize writes and flush the old department on navigation", async () => {
  const router = { push() {}, replace() {} };
  const { DepartmentMemberWorkspace } = loadComponent("../src/components/department-member-workspace.tsx", {
    "next/navigation": { useRouter: () => router, useSearchParams: () => new URLSearchParams("tab=settings") },
    "@/components/Manage/department-workspace": {
      DepartmentWorkspace: ({ profile, feature, onStageFeature, onRefresh }: any) => <section>
        <output data-testid="profile">{profile.name}</output><output data-testid="title">{feature.title}</output>
        <button onClick={() => onStageFeature("title", "First edit")}>Edit first</button>
        <button onClick={() => onStageFeature("title", "Latest edit")}>Edit latest</button>
        <button onClick={() => onStageFeature("enabled", true)}>Enable feature</button>
        <button onClick={() => void onRefresh()}>Reload data</button>
      </section>,
    },
  });
  const originalFetch = globalThis.fetch;
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const timers = new Map<number, () => void>();
  let timerId = 10000;
  globalThis.setTimeout = ((callback: () => void, ms?: number, ...args: any[]) => {
    if (ms === 900) { const id = ++timerId; timers.set(id, callback); return id; }
    return originalSet(callback, ms, ...args);
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: any) => { if (!timers.delete(Number(id))) originalClear(id); }) as typeof clearTimeout;
  const writes: Array<{ url: string; body: any }> = [];
  let rejectFirst: (response: Response) => void;
  let loads = 0;
  globalThis.fetch = (async (url, init) => {
    if (init?.method === "POST") {
      writes.push({ url: String(url), body: JSON.parse(String(init.body)) });
      if (writes.length === 1) return new Promise<Response>((resolve) => { rejectFirst = resolve; });
      return Response.json({});
    }
    if (String(url).endsWith("/mine")) return Response.json({ departments: [] });
    loads += 1;
    return Response.json({ profiles: [{ id: "department", name: "Operations" }], feature: { title: "Saved", enabled: false }, rosters: [], resources: [], parentRoles: [], parentChannels: [] });
  }) as typeof fetch;
  const page = (departmentId = "department-a") => <DepartmentMemberWorkspace parentId="server" departmentId={departmentId} />;
  const m = await mount(page());
  async function flushTimer() {
    const next = timers.entries().next().value as [number, () => void];
    assert.ok(next, "expected an autosave timer");
    timers.delete(next[0]);
    await act(async () => next[1]());
  }
  try {
    await act(async () => button(m.container, "Edit first").click());
    await flushTimer();
    assert.equal(writes.length, 1);
    await act(async () => button(m.container, "Edit latest").click());
    await flushTimer();
    assert.equal(writes.length, 1, "new edits wait for the pending write");
    await act(async () => rejectFirst(Response.json({ detail: "Save unavailable" }, { status: 503 })));
    assert.equal(m.container.querySelector('[data-testid="title"]')!.textContent, "Latest edit");
    assert.match(m.container.querySelector('[role="alert"]')!.textContent || "", /Your edits are kept/);
    assert.equal(loads, 1, "a failed save must not reload over the unsaved draft");
    await act(async () => button(m.container, "Reload data").click());
    assert.equal(m.container.querySelector('[data-testid="title"]')!.textContent, "Latest edit", "a later refresh also keeps the pending patch");
    await act(async () => button(m.container, "Retry save").click());
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[1].body, { feature: { title: "Latest edit" }, profile: {} });
    assert.equal(m.container.querySelector('[role="alert"]'), null);
    await act(async () => button(m.container, "Enable feature").click());
    assert.equal(timers.size, 1);
    await m.show(page("department-b"));
    assert.equal(timers.size, 0, "navigation cancels the old autosave timer");
    assert.equal(writes.length, 3, "navigation flushes the remaining old-department patch once");
    assert.equal(writes[2].url, "/api/departments/server/department-a/feature");
    assert.deepEqual(writes[2].body, { feature: { enabled: true }, profile: {} });
    assert.equal(m.container.querySelector('[data-testid="title"]')!.textContent, "Saved", "a different department gets fresh state");
  } finally {
    await m.close();
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});
