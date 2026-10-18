import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React, { act, useState } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { applicationDraftKey } from "../src/components/use-application-draft";

const require = createRequire(import.meta.url);
require.extensions[".css"] = () => undefined;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true, url: "https://website.example/document/example",
});
const win = dom.window;
Object.assign(globalThis, {
  window: win, document: win.document, localStorage: win.localStorage,
  HTMLElement: win.HTMLElement, Element: win.Element, Node: win.Node,
  HTMLInputElement: win.HTMLInputElement, HTMLTextAreaElement: win.HTMLTextAreaElement,
  HTMLButtonElement: win.HTMLButtonElement, DocumentFragment: win.DocumentFragment,
  Event: win.Event, MouseEvent: win.MouseEvent, CustomEvent: win.CustomEvent,
  MutationObserver: win.MutationObserver, getComputedStyle: win.getComputedStyle,
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: win.navigator });
win.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as any;

// Exercise our actual components, replacing only session/router boundaries and
// the form field widget when its internal formatting is irrelevant to drafts.
function loadComponent(path: string, overrides: Record<string, unknown>) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as any };
  new Function("require", "module", "exports", compiled)((name: string) => {
    if (name in overrides) return overrides[name];
    return require(name.startsWith(".") ? resolve(dirname(filename), name) : name);
  }, loaded, loaded.exports);
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

function button(container: ParentNode, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label);
  assert.ok(found, `Missing button: ${label}`);
  return found;
}

test("department forms restore only the active person's answers and clear only the submitted form", async () => {
  localStorage.clear();
  let user = "person-a";
  const { ResourceLibrary } = loadComponent("../src/components/Manage/department-workspace/resource-library.tsx", {
    "next-auth/react": { useSession: () => ({ data: { user: { id: user } } }) },
    "@/components/form-question-field": {
      FormQuestionCard: ({ question, value, onChange }: any) => <label data-question-id={question.id}>{question.label}<input aria-label="Answer" value={String(value || "")} onChange={(event) => onChange(event.target.value)} /></label>,
    },
  });
  const { WorkspaceHostProvider } = await import("../src/components/Manage/workspace-host");
  const resources = ["first", "second"].map((id) => ({
    id, title: `${id} form`, kind: "application",
    questions: [{ id: "answer", label: "Answer", type: "short", required: true }],
  }));
  const keyA = applicationDraftKey("person-a", "draft-server", "first");
  const keyB = applicationDraftKey("person-b", "draft-server", "first");
  const secondKey = applicationDraftKey("person-a", "draft-server", "second");
  localStorage.setItem(keyA, JSON.stringify({ answer: "First person's answer" }));
  localStorage.setItem(keyB, JSON.stringify({ answer: "Second person's answer" }));
  localStorage.setItem(secondKey, JSON.stringify({ answer: "Other form answer" }));
  const page = () => <WorkspaceHostProvider value={{ guildId: "draft-server", meta: null, setNotice: () => undefined, refreshConfig: async () => undefined }}><ResourceLibrary profile={{ id: "department" }} resources={resources} onRefresh={async () => undefined} /></WorkspaceHostProvider>;
  const originalFetch = globalThis.fetch;
  let submitted: any;
  globalThis.fetch = (async (_url, init) => { submitted = JSON.parse(String(init?.body)); return Response.json({}); }) as typeof fetch;
  const m = await mount(page());
  const answer = () => m.container.querySelector<HTMLInputElement>('[aria-label="Answer"]')!;
  try {
    assert.equal(answer().value, "First person's answer");
    const paste = new win.Event("paste", { bubbles: true });
    Object.defineProperty(paste, "clipboardData", { value: { getData: () => "Pasted text" } });
    await act(async () => answer().dispatchEvent(paste));
    await act(async () => button(m.container, "second form").click());
    assert.equal(answer().value, "Other form answer");
    await act(async () => button(m.container, "first form").click());
    assert.equal(answer().value, "First person's answer", "switching forms keeps their independent drafts");
    user = "person-b";
    await m.show(page());
    assert.equal(answer().value, "Second person's answer", "changing account cannot show the previous person's answer");
    assert.equal(JSON.parse(localStorage.getItem(keyA)!).answer, "First person's answer");
    await act(async () => button(m.container, "Submit application").click());
    assert.equal(submitted.answers.answer, "Second person's answer");
    assert.equal(submitted.integrity.paste_events, 0, "integrity signals also reset on form/account changes");
    assert.equal(answer().value, "");
    assert.equal(localStorage.getItem(keyB), null);
    assert.equal(JSON.parse(localStorage.getItem(keyA)!).answer, "First person's answer");
    assert.equal(JSON.parse(localStorage.getItem(secondKey)!).answer, "Other form answer");
  } finally { await m.close(); globalThis.fetch = originalFetch; }
});

test("reader copy feedback waits for the clipboard and reports a denied write truthfully", async () => {
  const router = { push() {}, replace() {} };
  const { DocumentReader } = loadComponent("../src/components/document-reader.tsx", {
    "next/navigation": { useRouter: () => router },
    "next-auth/react": { useSession: () => ({ data: null }) },
    "@/components/legacy-header/header-shell": { HeaderShell: () => null },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ resource: { id: "document", title: "Shared notes", document_html: "<p>Readable notes</p>" }, can_edit: false })) as typeof fetch;
  let resolveCopy: () => void;
  Object.defineProperty(win.navigator, "clipboard", { configurable: true, value: { writeText: () => new Promise<void>((resolve) => { resolveCopy = resolve; }) } });
  const m = await mount(<DocumentReader apiPath="/api/docs/example" />);
  async function copy() {
    await act(async () => button(m.container, "File").click());
    await act(async () => button(m.container, "Copy doc link").click());
  }
  try {
    await copy();
    assert.doesNotMatch(m.container.textContent || "", /Link copied/);
    await act(async () => resolveCopy());
    assert.match(m.container.querySelector('[role="status"]')!.textContent || "", /Link copied/);
    Object.defineProperty(win.navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });
    (document as any).execCommand = () => false;
    await copy();
    assert.doesNotMatch(m.container.textContent || "", /Link copied/);
    assert.match(m.container.querySelector('[role="status"]')!.textContent || "", /Could not copy this link/);
    assert.match(m.container.textContent || "", /Readable notes/, "a clipboard failure must not replace the loaded document");
  } finally { await m.close(); globalThis.fetch = originalFetch; }
});

test("restoring a version immediately replaces the visible text on the same document page", async () => {
  const { DepartmentDocumentEditor } = await import("../src/components/Manage/department-document-editor");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url) => String(url).includes("resourceversionrestore")
    ? Response.json({ resource: { document_html: "<p>Restored <strong>version</strong></p><script>bad()</script>", active_document_id: "root" } })
    : Response.json({ versions: [{ id: "earlier", title: "Earlier notes", savedBy: null, savedByName: "Editor", savedByAvatar: null, savedAt: "2026-10-17T00:00:00Z", characters: 20, rows: 0 }] })) as typeof fetch;
  function Editor() {
    const [resource, setResource] = useState({ id: "restore-document", title: "Notes", document_html: "<p>Current version</p>", active_document_id: "root" });
    return <DepartmentDocumentEditor resource={resource} guildId="restore-server" onChange={setResource} onSave={async () => undefined} onClose={() => undefined} onDelete={async () => undefined} />;
  }
  const m = await mount(<Editor />);
  try {
    assert.match(m.container.querySelector(".tiptap")!.textContent || "", /Current version/);
    await act(async () => button(m.container, "History").click());
    await act(async () => button(m.container, "Restore").click());
    const confirmation = document.querySelector('[role="alertdialog"]')!;
    assert.ok(confirmation);
    await act(async () => button(confirmation, "Restore").click());
    const editor = m.container.querySelector(".tiptap")!;
    assert.equal(editor.textContent, "Restored version");
    assert.equal(editor.querySelector("strong")?.textContent, "version");
    assert.equal(editor.querySelector("script"), null);
  } finally { await m.close(); globalThis.fetch = originalFetch; }
});

test("document editor copy feedback also waits for permission and distinguishes failure", async () => {
  const { DepartmentDocumentEditor } = await import("../src/components/Manage/department-document-editor");
  let resolveCopy: () => void;
  Object.defineProperty(win.navigator, "clipboard", { configurable: true, value: { writeText: () => new Promise<void>((resolve) => { resolveCopy = resolve; }) } });
  const m = await mount(<DepartmentDocumentEditor resource={{ id: "copy-document", title: "Notes", document_html: "<p>Notes</p>" }} shareUrl="https://website.example/document/shared" onChange={() => undefined} onSave={async () => undefined} onClose={() => undefined} onDelete={async () => undefined} />);
  async function copy() {
    await act(async () => button(m.container, "File").click());
    await act(async () => button(m.container, "Copy doc link").click());
  }
  try {
    await copy();
    assert.equal(m.container.querySelector('[role="status"]'), null);
    await act(async () => resolveCopy());
    assert.match(m.container.querySelector('[role="status"]')!.textContent || "", /Document link copied to clipboard/);
    Object.defineProperty(win.navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });
    (document as any).execCommand = () => false;
    await copy();
    const status = m.container.querySelector('[role="status"]')!;
    assert.match(status.textContent || "", /Could not copy this link/);
    assert.doesNotMatch(status.textContent || "", /copied to clipboard/);
    assert.match(status.className, /tone-bad-line/);
  } finally { await m.close(); }
});
