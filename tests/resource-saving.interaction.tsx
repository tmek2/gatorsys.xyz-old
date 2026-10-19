import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React, { act, useState } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { useResourceAutosave } from "../src/components/Manage/use-resource-autosave";
import { mergeSavedResource } from "../src/components/Manage/resource-save";

const require = createRequire(import.meta.url);
require.extensions[".css"] = () => undefined;
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true, url: "https://website.example/manage/test/resources/notes" });
const win = dom.window;
Object.assign(globalThis, {
  window: win, document: win.document, HTMLElement: win.HTMLElement, Element: win.Element,
  HTMLInputElement: win.HTMLInputElement, Node: win.Node, Event: win.Event,
  MutationObserver: win.MutationObserver, getComputedStyle: win.getComputedStyle,
  requestAnimationFrame: win.requestAnimationFrame.bind(win), cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: win.navigator });
win.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as any;

function loadComponent(path: string, overrides: Record<string, unknown>) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = { exports: {} as any };
  new Function("require", "module", "exports", compiled)((name: string) => name in overrides ? overrides[name] : require(name.startsWith(".") ? resolve(dirname(filename), name) : name), loaded, loaded.exports);
  return loaded.exports;
}

async function mount(node: React.ReactNode) {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, async close() { await act(async () => root.unmount()); container.remove(); } };
}

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("a real document editor settles on Saved after a server timestamp changes", async () => {
  const { DepartmentDocumentEditor } = await import("../src/components/Manage/department-document-editor");
  let calls = 0;
  function Document() {
    const [resource, setResource] = useState({ id: "notes", title: "Original", document_html: "<p>Notes</p>", updated_at: "initial" });
    return <DepartmentDocumentEditor resource={resource} onChange={setResource} onSave={async (snapshot) => {
      calls++;
      setResource((current) => mergeSavedResource(current, snapshot, { ...snapshot, updated_at: `save-${calls}` })!);
    }} onClose={() => undefined} onDelete={async () => undefined} />;
  }
  const m = await mount(<Document />);
  try {
    await type(m.container.querySelector<HTMLInputElement>('[aria-label="Document title"]')!, "Saved notes");
    await act(async () => m.container.querySelector<HTMLButtonElement>('[aria-label="Unsaved changes"]')!.click());
    assert.ok(m.container.querySelector('[aria-label="Saved"]'));
    await act(async () => wait(1400));
    assert.equal(calls, 1, "acknowledgement metadata must not trigger another autosave");
    assert.ok(m.container.querySelector('[aria-label="Saved"]'));
  } finally { await m.close(); }
});

test("the shared editor queue saves edits made during a slow request without overlapping writes", async () => {
  const snapshots: any[] = [];
  let resolveFirst: () => void;
  function Editor() {
    const [resource, setResource] = useState({ id: "queue", title: "Original", updated_at: "initial" });
    const { saveState } = useResourceAutosave(resource, async (snapshot) => {
      snapshots.push(snapshot);
      if (snapshots.length === 1) await new Promise<void>((resolve) => { resolveFirst = resolve; });
      setResource((current) => mergeSavedResource(current, snapshot, { ...snapshot, updated_at: `save-${snapshots.length}` })!);
    }, 10);
    return <><input aria-label="Title" value={resource.title} onChange={(event) => setResource((current) => ({ ...current, title: event.target.value }))} /><output>{saveState}</output></>;
  }
  const m = await mount(<Editor />);
  try {
    const input = m.container.querySelector("input")!;
    await type(input, "First edit");
    await act(async () => wait(30));
    assert.equal(snapshots.length, 1);
    await type(input, "Newer edit");
    await act(async () => wait(30));
    assert.equal(snapshots.length, 1, "a second save must wait for the first");
    await act(async () => resolveFirst());
    assert.equal(input.value, "Newer edit");
    await act(async () => wait(30));
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[0].title, "First edit");
    assert.equal(snapshots[1].title, "Newer edit");
    assert.equal(m.container.querySelector("output")!.textContent, "saved");
  } finally { await m.close(); }
});

for (const kind of ["document", "spreadsheet"]) {
  test(`the actual server ${kind} parent keeps newer edits when an older save returns`, async () => {
    function Editor({ resource, onChange, onSave }: any) {
      return <><input aria-label="Title" value={resource.title} onChange={(event) => onChange({ ...resource, title: event.target.value })} /><button onClick={() => void onSave(resource)}>Save</button><output>{resource.updated_at}</output></>;
    }
    const { ServerResourceClient } = loadComponent("../src/app/manage/[id]/resources/[resourceId]/server-resource-client.tsx", {
      "next/navigation": { useRouter: () => ({ push() {}, replace() {} }) },
      "@/components/Manage/department-document-editor": { DepartmentDocumentEditor: Editor },
      "@/components/Manage/department-spreadsheet-editor": { DepartmentSpreadsheetEditor: Editor },
    });
    const originalFetch = globalThis.fetch;
    let resolveSave: (response: Response) => void;
    let submitted: any;
    globalThis.fetch = (async (_url, init) => {
      if (!init?.body) return Response.json({ resources: [{ id: "notes", kind, title: "Original", updated_at: "initial" }] });
      submitted = JSON.parse(String(init.body)).resource;
      return new Promise<Response>((resolve) => { resolveSave = resolve; });
    }) as typeof fetch;
    const m = await mount(<ServerResourceClient guildId="server" resourceId="notes" />);
    try {
      const input = m.container.querySelector<HTMLInputElement>("input")!;
      await type(input, "Submitted edit");
      await act(async () => m.container.querySelector<HTMLButtonElement>("button")!.click());
      await type(input, "Newer edit");
      await act(async () => resolveSave(Response.json({ resources: [{ ...submitted, updated_at: "saved" }] })));
      assert.equal(input.value, "Newer edit");
      assert.equal(m.container.querySelector("output")!.textContent, "saved");
      assert.equal(submitted.title, "Submitted edit");
    } finally { await m.close(); globalThis.fetch = originalFetch; }
  });
}
