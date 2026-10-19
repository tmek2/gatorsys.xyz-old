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
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true, url: "https://website.example/manage/editor/applications/staff",
});
const win = dom.window;
Object.assign(globalThis, {
  window: win, self: win, document: win.document, localStorage: win.localStorage,
  HTMLElement: win.HTMLElement, Element: win.Element, Node: win.Node, Window: win.Window,
  HTMLInputElement: win.HTMLInputElement, HTMLTextAreaElement: win.HTMLTextAreaElement,
  HTMLButtonElement: win.HTMLButtonElement, DocumentFragment: win.DocumentFragment,
  Event: win.Event, MouseEvent: win.MouseEvent, CustomEvent: win.CustomEvent,
  MutationObserver: win.MutationObserver, getComputedStyle: win.getComputedStyle,
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: win.navigator });
win.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as any;
win.HTMLElement.prototype.scrollIntoView = () => undefined;
win.scrollTo = () => undefined;

function loadEditor() {
  const filename = fileURLToPath(new URL("../src/components/Manage/application-editor.tsx", import.meta.url));
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} as any };
  new Function("require", "module", "exports", compiled)((name: string) => {
    if (name === "next/navigation") return { useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams() };
    return require(name.startsWith(".") ? resolve(dirname(filename), name) : name);
  }, loaded, loaded.exports);
  return loaded.exports.ApplicationEditorPage as React.ComponentType<any>;
}

const ApplicationEditorPage = loadEditor();
let sequence = 0;
async function mountEditor(config: Record<string, any>, portal = false) {
  const guildId = `application-editor-${++sequence}`;
  const originalFetch = globalThis.fetch;
  let saved = structuredClone(config);
  const writes: any[] = [];
  let patchResult: ((payload: any, attempt: number) => Promise<Response | undefined>) | undefined;
  globalThis.fetch = (async (url, init) => {
    const endpoint = String(url);
    if (endpoint.includes("scope=meta") || endpoint.endsWith("/meta")) return Response.json({
      guild: { id: guildId, name: "Test server", createdAt: "2020-01-01", memberCount: 5 },
      me: { id: "editor", isAdmin: true, isOwner: true }, channels: [], roles: [], modules: { Applications: true },
    });
    if (endpoint.includes("/config") || endpoint.includes("/appconfig")) {
      if (init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body));
        writes.push(payload);
        const response = await patchResult?.(payload, writes.length);
        if (response) return response;
        for (const [path, value] of Object.entries(payload.set || {})) {
          const keys = path.split(".");
          let current = saved;
          for (const key of keys.slice(0, -1)) current = current[key] ??= {};
          current[keys.at(-1)!] = structuredClone(value);
        }
      }
      return Response.json({ config: saved });
    }
    if (endpoint.includes("applicationresponses")) return Response.json({ responses: [] });
    throw new Error(`Unexpected request: ${endpoint}`);
  }) as typeof fetch;
  const { createRoot } = require("react-dom/client") as typeof import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const node = <ApplicationEditorPage guildId={guildId} viewerId="editor" appId="staff" portalDepartmentId={portal ? "department" : undefined} />;
  await act(async () => root.render(node));
  return { container, writes, saved: () => saved,
    onPatch(handler: NonNullable<typeof patchResult>) { patchResult = handler; },
    async close() { await act(async () => root.unmount()); container.remove(); globalThis.fetch = originalFetch; },
  };
}

function exampleConfig() {
  return { Modules: { Applications: true }, Applications: { applications: [{
    id: "staff", name: "Staff application", description: "Join our team", questions: [
      { id: "experience", type: "text_paragraph", question: "Your experience", required: true },
      { id: "availability", type: "multiple_choice", question: "Your availability", options: [{ value: "weekends", label: "Weekends" }] },
      { id: "ready", type: "boolean", question: "Ready to join?", required: true },
    ],
  }] } };
}

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
}

test("the actual application editor loads all questions and autosaves question edits", async () => {
  const view = await mountEditor(exampleConfig());
  try {
    const questions = () => [...view.container.querySelectorAll<HTMLInputElement>('[aria-label="Question title"]')];
    assert.equal(questions().length, 3);
    await type(questions()[0], "Tell us about your experience");
    assert.equal(questions()[0].value, "Tell us about your experience");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.equal(view.writes.length, 1);
    assert.equal(view.saved().Applications.applications[0].questions[0].question, "Tell us about your experience");
    assert.ok(view.container.querySelector('[aria-label="Saved"]'));
  } finally { await view.close(); }
});

test("the application editor retains failed edits until Retry succeeds", async () => {
  const view = await mountEditor(exampleConfig());
  view.onPatch(async (_payload, attempt) => attempt === 1 ? Response.json({ detail: "Temporarily offline" }, { status: 503 }) : undefined);
  try {
    const title = view.container.querySelector<HTMLInputElement>('[aria-label="Question title"]')!;
    await type(title, "Retain this question");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    const retry = [...view.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Save failed. Retry");
    assert.ok(retry);
    assert.equal(title.value, "Retain this question");
    assert.equal(view.saved().Applications.applications[0].questions[0].question, "Your experience");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.equal(view.writes.length, 1, "a failed write waits for Retry or a new edit");
    await act(async () => retry.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.equal(view.writes.length, 2);
    assert.equal(view.saved().Applications.applications[0].questions[0].question, "Retain this question");
    assert.ok(view.container.querySelector('[aria-label="Saved"]'));
  } finally { await view.close(); }
});

test("new application edits made during a slow save are saved next without being replaced", async () => {
  const view = await mountEditor(exampleConfig());
  let release!: () => void;
  view.onPatch(async (_payload, attempt) => {
    if (attempt === 1) await new Promise<void>((resolve) => { release = resolve; });
    return undefined;
  });
  try {
    const title = () => view.container.querySelector<HTMLInputElement>('[aria-label="Question title"]')!;
    await type(title(), "Earlier wording");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.equal(view.writes.length, 1);
    await type(title(), "Newer wording");
    await act(async () => release());
    assert.equal(title().value, "Newer wording");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.equal(view.writes.length, 2);
    assert.equal(view.saved().Applications.applications[0].questions[0].question, "Newer wording");
    assert.ok(view.container.querySelector('[aria-label="Saved"]'));
  } finally { await view.close(); }
});

for (const portal of [false, true]) test(`${portal ? "department" : "server"} application settings save alongside question changes`, async () => {
  const view = await mountEditor(exampleConfig(), portal);
  try {
    const settings = [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent === "settings")!;
    await act(async () => settings.click());
    const option = (label: string) => [...view.container.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find((button) => button.querySelector(".gw-opt-name")?.textContent === label)!;
    await act(async () => option("Accepting responses").click());
    assert.equal(option("Accepting responses").getAttribute("aria-checked"), "false");
    await act(async () => option("Allow multiple submissions").click());
    assert.equal(option("Accepting responses").getAttribute("aria-checked"), "false", "a second setting must preserve the first");
    assert.equal(option("Allow multiple submissions").getAttribute("aria-checked"), "true");
    const form = [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent === "Questions")!;
    await act(async () => form.click());
    await type(view.container.querySelector<HTMLInputElement>('[aria-label="Application title"]')!, "Updated application");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.equal(view.writes.length, 1);
    const saved = view.saved().Applications.applications[0];
    assert.equal(saved.name, "Updated application");
    assert.equal(saved.responses_open, false, JSON.stringify(saved));
    assert.equal(saved.allow_multiple, true);
    assert.equal(saved.questions.length, 3);
    assert.equal(view.writes[0].module, "Applications");
  } finally { await view.close(); }
});

test("questions can become optional and automatic grading can be disabled when neither flag was stored", async () => {
  const config = exampleConfig();
  const app = config.Applications.applications[0] as any;
  delete app.questions[0].required;
  app.quiz_mode = true;
  const view = await mountEditor(config);
  try {
    const required = view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    assert.equal(required.checked, true);
    await act(async () => required.click());
    assert.equal(required.checked, false);
    await act(async () => [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent === "settings")!.click());
    const grading = [...view.container.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find((button) => button.querySelector(".gw-opt-name")?.textContent === "Automatic grading")!;
    assert.equal(grading.getAttribute("aria-checked"), "true");
    await act(async () => grading.click());
    assert.equal(grading.getAttribute("aria-checked"), "false");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.equal(view.saved().Applications.applications[0].questions[0].required, false);
    assert.equal(view.saved().Applications.applications[0].auto_grade, false);
  } finally { await view.close(); }
});

test("adding a dropdown keeps its type when editing options, duplicating and reordering", async () => {
  const view = await mountEditor(exampleConfig());
  const questions = () => [...view.container.querySelectorAll<HTMLInputElement>('[aria-label="Question title"]')];
  const button = (parent: ParentNode, label: string) => {
    const found = [...parent.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label || item.getAttribute("aria-label") === label);
    assert.ok(found, `Missing button: ${label}`);
    return found;
  };
  try {
    await act(async () => button(view.container, "Add question").click());
    await act(async () => button(document.body, "Dropdown").click());
    assert.equal(questions().length, 4);
    const added = questions()[3].closest('[data-swapy-item]')!;
    assert.ok([...added.querySelectorAll("button")].some((item) => item.title === "Change question type" && item.textContent?.trim() === "Dropdown"), "a new dropdown must keep its display flag");
    await type(questions()[3], "Preferred shift");
    await type(added.querySelector<HTMLInputElement>('[placeholder="Add option"]')!, "Morning");
    await type(added.querySelector<HTMLInputElement>('[placeholder="Add option"]')!, "Evening");
    assert.equal(added.querySelector<HTMLInputElement>('[placeholder="Option 1"]')!.value, "Morning");
    await act(async () => button(added, "Duplicate question").click());
    assert.equal(questions().length, 5);
    await act(async () => button(questions()[4].closest('[data-swapy-item]')!, "Move up").click());
    await act(async () => button(questions()[4].closest('[data-swapy-item]')!, "Remove question").click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    const savedQuestions = view.saved().Applications.applications[0].questions;
    assert.equal(savedQuestions.length, 4);
    assert.equal(savedQuestions[3].display, "dropdown");
    assert.equal(savedQuestions[3].type, "multiple_choice");
    assert.deepEqual(savedQuestions[3].options.map((option: any) => option.label), ["Morning", "Evening"]);
    assert.equal(new Set(savedQuestions.map((question: any) => question.id)).size, 4);
  } finally { await view.close(); }
});

test("dragging questions keeps the visible cards attached to the question being edited", async () => {
  const runtimeErrors: string[] = [];
  const onError = (event: ErrorEvent) => { runtimeErrors.push(event.message); event.preventDefault(); };
  win.addEventListener("error", onError);
  const oldRect = win.HTMLElement.prototype.getBoundingClientRect;
  win.HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const slot = this.closest<HTMLElement>("[data-swapy-slot]");
    const index = slot ? Number(slot.dataset.swapySlot?.split("-").at(-1)) : 0;
    return { x: 0, y: 100 + index * 300, left: 0, top: 100 + index * 300, right: 800, bottom: 350 + index * 300, width: 800, height: 250, toJSON() {} };
  };
  const view = await mountEditor(exampleConfig());
  const questions = () => [...view.container.querySelectorAll<HTMLInputElement>('[aria-label="Question title"]')];
  async function pointer(target: Element, type: string, y: number) {
    const event = new win.MouseEvent(type, { bubbles: true, clientX: 20, clientY: y, buttons: type === "pointerup" ? 0 : 1 });
    Object.defineProperty(event, "isPrimary", { value: true });
    await act(async () => { target.dispatchEvent(event); await new Promise((resolve) => setTimeout(resolve, 30)); });
  }
  try {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 40)));
    const handle = questions()[0].closest('[data-swapy-item]')!.querySelector('[data-swapy-handle]')!;
    await pointer(handle, "pointerdown", 120);
    assert.ok(view.container.querySelector('[data-swapy-dragging]'), "the drag handle starts a reorder");
    await pointer(document.body, "pointermove", 450);
    await pointer(document.body, "pointerup", 450);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.deepEqual(view.saved().Applications.applications[0].questions.map((question: any) => question.id), ["availability", "experience", "ready"], "the saved order follows the drag");
    assert.deepEqual(questions().map((input) => input.value), ["Your availability", "Your experience", "Ready to join?"]);
    const tab = (label: string) => [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent === label)!;
    await act(async () => tab("settings").click());
    assert.equal(questions().length, 0);
    await act(async () => tab("Questions").click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 40)));
    const returnedHandle = questions()[1].closest('[data-swapy-item]')!.querySelector('[data-swapy-handle]')!;
    await pointer(returnedHandle, "pointerdown", 420);
    assert.ok(view.container.querySelector('[data-swapy-dragging]'), "returning to Questions reconnects the drag handles");
    await pointer(document.body, "pointermove", 150);
    await pointer(document.body, "pointerup", 150);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
    assert.deepEqual(questions().map((input) => input.value), ["Your experience", "Your availability", "Ready to join?"]);
    await type(questions()[0], "Edited experience");
    const removed = questions()[1].closest('[data-swapy-item]')!.querySelector<HTMLButtonElement>('[aria-label="Remove question"]')!;
    await act(async () => removed.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 750)));
    assert.deepEqual(view.saved().Applications.applications[0].questions.map((question: any) => [question.id, question.question]), [["experience", "Edited experience"], ["ready", "Ready to join?"]]);
    assert.deepEqual(runtimeErrors, [], "moving different question types must not break the animation or card tree");
  } finally { await view.close(); win.HTMLElement.prototype.getBoundingClientRect = oldRect; win.removeEventListener("error", onError); }
});
