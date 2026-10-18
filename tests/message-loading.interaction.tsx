import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import React, { act } from "react";

// These checks exercise React state and requests; stylesheet rendering is
// covered by the browser checks.
const require = createRequire(import.meta.url);
require.extensions[".css"] = () => {};
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost",
});
const win = dom.window;
Object.assign(globalThis, {
  window: win, document: win.document, HTMLElement: win.HTMLElement,
  Element: win.Element, SVGElement: win.SVGElement,
  HTMLInputElement: win.HTMLInputElement, HTMLTextAreaElement: win.HTMLTextAreaElement,
  FileReader: win.FileReader, localStorage: win.localStorage,
  getComputedStyle: win.getComputedStyle,
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  IS_REACT_ACT_ENVIRONMENT: true,
});
win.matchMedia = () => ({
  matches: true, addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {},
}) as any;
win.HTMLElement.prototype.scrollIntoView = () => {};

const { createRoot } = require("react-dom/client") as typeof import("react-dom/client");
const { ManageProvider, useManage } = require("../src/components/Manage/manage-context") as typeof import("../src/components/Manage/manage-context");
const { MessageDesignCard } = require("../src/components/Manage/message-design") as typeof import("../src/components/Manage/message-design");
const { DailyQuestionsSection } = require("../src/components/Manage/sections/daily-questions") as typeof import("../src/components/Manage/sections/daily-questions");
const { CustomizationSection } = require("../src/components/Manage/sections/customization") as typeof import("../src/components/Manage/sections/customization");
const { DateField } = require("../src/components/Manage/fields/dates") as typeof import("../src/components/Manage/fields/dates");
const { PreviewButton } = require("../src/components/Manage/message-design/preview") as typeof import("../src/components/Manage/message-design/preview");
const { ValidationRulesEditor } = require("../src/components/Manage/validation-rules") as typeof import("../src/components/Manage/validation-rules");
const { inspectorSources } = require("../src/components/Manage/workflow/inspector-sources") as typeof import("../src/components/Manage/workflow/inspector-sources");
const { FormEditor } = require("../src/components/Manage/sections/tickets/form-editor") as typeof import("../src/components/Manage/sections/tickets/form-editor");
const { usePanelDraft } = require("../src/components/Manage/sections/tickets/shared") as typeof import("../src/components/Manage/sections/tickets/shared");
const { ResourcesSection } = require("../src/components/Manage/sections/resources") as typeof import("../src/components/Manage/sections/resources");
const { CustomCommandsSection } = require("../src/components/Manage/sections/custom-commands") as typeof import("../src/components/Manage/sections/custom-commands");
const { ApplicationResponses } = require("../src/components/Manage/sections/resources/application-responses") as typeof import("../src/components/Manage/sections/resources/application-responses");
const { GatorAiSection } = require("../src/components/Manage/sections/gator-ai") as typeof import("../src/components/Manage/sections/gator-ai");
const { InfractionHierarchyCard } = require("../src/components/Manage/sections/infraction-hierarchy") as typeof import("../src/components/Manage/sections/infraction-hierarchy");
const { useApplicationAutosave } = require("../src/components/Manage/use-application-autosave") as typeof import("../src/components/Manage/use-application-autosave");
const { serializeDraft } = require("../src/components/Manage/draft-storage") as typeof import("../src/components/Manage/draft-storage");
const { toast } = require("sonner") as typeof import("sonner");

type Context = ReturnType<typeof useManage>;
let sequence = 0;
async function mount(child: React.ReactNode, endpoint: (url: string, init?: RequestInit) => Response | Promise<Response>, config: Record<string, any> = { Modules: { QOTD: true } }) {
  const guildId = `editor-check-${++sequence}`;
  let context!: Context;
  function Probe() { context = useManage(); return null; }
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/config") && !init?.method) return Response.json({ config });
    if (url.endsWith("/meta")) return Response.json({
      guild: { id: guildId, name: "Test server", createdAt: "2020-01-01", memberCount: 5 },
      me: { id: "test-user", isAdmin: true, isOwner: true },
      channels: [], roles: [], modules: { QOTD: true },
    });
    return endpoint(url, init);
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(<ManageProvider guildId={guildId} viewerId="test-user">{child}<Probe /></ManageProvider>); });
  return {
    container, context: () => context,
    async close() { await act(async () => root.unmount()); container.remove(); },
  };
}
function click(element: Element) {
  element.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
}

test("application autosave stops after failure, retries on request and saves new edits", async () => {
  let autosave!: ReturnType<typeof useApplicationAutosave>;
  let writes = 0;
  let saved = { title: "Original" };
  function AutoSaveEditor() {
    const context = useManage();
    autosave = useApplicationAutosave({
      dirty: context.dirty,
      paused: context.loading || context.saving,
      revision: serializeDraft(context.pending),
      save: () => context.save("Applications"),
    });
    return null;
  }
  const view = await mount(<AutoSaveEditor />, (_url, init) => {
    if (init?.method !== "PATCH") return Response.json({});
    if (++writes === 1) return Response.json({ detail: "Offline" }, { status: 503 });
    saved = { ...saved, ...JSON.parse(String(init.body)).set };
    return Response.json({ config: saved });
  }, saved);
  const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 720)); });
  try {
    await act(async () => view.context().stage("title", "First edit"));
    await settle();
    assert.equal(writes, 1);
    assert.equal(autosave.failed, true);
    assert.equal(view.context().dirty, true);
    await settle();
    assert.equal(writes, 1, "failed draft must not start an endless retry loop");
    await act(async () => autosave.retry());
    await settle();
    assert.equal(writes, 2);
    assert.equal(saved.title, "First edit");
    assert.equal(autosave.failed, false);
    assert.equal(view.context().dirty, false);
    await act(async () => view.context().stage("title", "Second edit"));
    await settle();
    assert.equal(writes, 3);
    assert.equal(saved.title, "Second edit");
  } finally { await view.close(); }
});

for (const action of ["stage", "revert", "discard", "undo"] as const) test(`config ${action} keeps a return to the saved value during an earlier write`, async () => {
  let saved = { title: "Original" };
  let release!: () => void;
  let writes = 0;
  const view = await mount(null, async (_url, init) => {
    const submitted = JSON.parse(String(init?.body)).set;
    if (++writes === 1) await new Promise<void>((resolve) => { release = resolve; });
    saved = { ...saved, ...submitted };
    return Response.json({ config: saved });
  }, saved);
  try {
    await act(async () => view.context().stage("title", "Submitted"));
    let writing!: Promise<boolean>;
    await act(async () => { writing = view.context().save(); });
    await act(async () => {
      if (action === "stage") view.context().stage("title", "Original");
      else if (action === "revert") view.context().revert("title");
      else if (action === "discard") view.context().discard();
      else view.context().undo();
    });
    await act(async () => release());
    await act(async () => { assert.equal(await writing, false, "save-and-leave must keep the newer correction open"); });
    assert.equal(saved.title, "Submitted");
    assert.equal(view.context().value("title"), "Original");
    assert.equal(view.context().dirty, true, "the completed earlier request still needs a corrective write");
    await act(async () => { assert.equal(await view.context().save(), true); });
    assert.equal(saved.title, "Original");
    assert.equal(view.context().dirty, false);
  } finally { await view.close(); }
});

test("command choices retain typed newlines, save both options and pause editing during the write", async () => {
  const command = {
    name: "survey", description: "Survey", embed: {}, content: "Thanks", permissionroles: [],
    command_options: [{ ix: 1, name: "answer", description: "Pick one", type: "choice", required: false, choices: ["Yes"], channel_types: [], use_for_send: false }],
  };
  let payload: any;
  let release!: () => void;
  const view = await mount(<CustomCommandsSection />, async (url, init) => {
    if (url.endsWith("/customcommands")) {
      if (init?.method === "POST") {
        payload = JSON.parse(String(init.body));
        await new Promise<void>((resolve) => { release = resolve; });
      }
      return Response.json({ commands: [command] });
    }
    return Response.json({ messages: [], embeds: [], containers: [] });
  }, { Modules: { customcommands: true } });
  try {
    await act(async () => click(view.container.querySelector(".resource-item")!));
    await act(async () => click([...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Inputs") && button.textContent?.includes("Slash fields"))!));
    const field = [...view.container.querySelectorAll<HTMLTextAreaElement>("textarea")].find((element) => element.placeholder === "Yes\nNo\nMaybe")!;
    const setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!;
    const type = async (text: string) => act(async () => { setter.call(field, text); field.dispatchEvent(new win.Event("input", { bubbles: true })); });
    await type("Yes\n");
    assert.equal(field.value, "Yes\n");
    await type("Yes\nNo");
    let writing!: Promise<boolean>;
    await act(async () => { writing = view.context().save(); });
    assert.deepEqual(payload.command.command_options[0].choices, ["Yes", "No"]);
    assert.ok(field.closest("[inert]"), "the saved draft cannot be edited while it is closing");
    await act(async () => release());
    await act(async () => { assert.equal(await writing, true); });
    assert.equal(view.context().dirty, false);
  } finally { await view.close(); }
});

test("Assistant save acknowledgements preserve newer typing and keep it unsaved", async () => {
  let settings = {
    personality: "balanced", age: "everyday", filter: "standard", enabled: true,
    channels: [], blocked_users: [], cooldown_seconds: 30, known_issue: "Original",
  };
  let release!: () => void;
  let writes = 0;
  const view = await mount(<GatorAiSection />, async (url, init) => {
    if (url.includes("meta?members")) return Response.json({ members: [] });
    if (init?.method === "PATCH") {
      const submitted = JSON.parse(String(init.body)).settings;
      if (++writes === 1) await new Promise<void>((resolve) => { release = resolve; });
      settings = submitted;
    }
    return Response.json({ settings, channels: [], blocked: [] });
  }, { Modules: { GatorAI: true } });
  const input = view.container.querySelector<HTMLInputElement>('input[placeholder="e.g. Roblox verification is down"]')!;
  const type = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
  try {
    await type("Submitted");
    let writing!: Promise<boolean>;
    await act(async () => { writing = view.context().save(); });
    await type("Newer edit");
    await act(async () => release());
    await act(async () => { assert.equal(await writing, false); });
    assert.equal(settings.known_issue, "Submitted");
    assert.equal(input.value, "Newer edit");
    assert.equal(view.context().dirty, true);
    await act(async () => { assert.equal(await view.context().save(), true); });
    assert.equal(settings.known_issue, "Newer edit");
    assert.equal(view.context().dirty, false);
  } finally { await view.close(); }
});

test("infraction saves keep a newer automation edit in the global draft", async () => {
  let types = [{ name: "Warning", given_roles: [], removed_roles: [], change_group_role: false, group_role: "", staff_database_removal: false, channel: "", demote: false, demote_department: "", demote_skip_to: "" }];
  let release!: () => void;
  let writes = 0;
  const view = await mount(<InfractionHierarchyCard />, async (_url, init) => {
    if (init?.method === "POST") {
      const submitted = JSON.parse(String(init.body)).types;
      if (++writes === 1) await new Promise<void>((resolve) => { release = resolve; });
      types = submitted;
    }
    return Response.json({ types, hierarchy: [], departments: [], group_roles: [] });
  });
  try {
    const option = () => [...view.container.querySelectorAll('[role="switch"]')].find((element) => element.closest("label")?.textContent?.includes("Remove from the staff database")) || view.container.querySelectorAll('[role="switch"]')[1];
    await act(async () => click(option()!));
    let writing!: Promise<boolean>;
    await act(async () => { writing = view.context().save(); });
    await act(async () => click(option()!));
    await act(async () => release());
    await act(async () => { assert.equal(await writing, false); });
    assert.equal(types[0].staff_database_removal, true);
    assert.equal(option()!.getAttribute("aria-checked"), "false");
    assert.equal(view.context().dirty, true);
    await act(async () => { assert.equal(await view.context().save(), true); });
    assert.equal(types[0].staff_database_removal, false);
    assert.equal(view.context().dirty, false);
  } finally { await view.close(); }
});

test("submissions expose failed loads and decision errors, with a working retry", async () => {
  let failed = true;
  const response = { id: "response", applicationId: "form", status: "pending", answers: {}, userName: "Applicant" };
  const view = await mount(<ApplicationResponses guildId="server" appId="form" questions={[]} />, (_url, init) => {
    if (init?.method === "POST") { failed = true; return Response.json({ detail: "Decision rejected" }, { status: 503 }); }
    return failed ? Response.json({ detail: "Submissions offline" }, { status: 503 }) : Response.json({ responses: [response] });
  });
  try {
    assert.match(view.container.textContent!, /Submissions offline/);
    assert.equal(view.container.textContent!.includes("No submissions yet"), false);
    failed = false;
    await act(async () => click([...view.container.querySelectorAll("button")].find((button) => button.textContent === "Retry loading submissions")!));
    assert.match(view.container.textContent!, /Applicant/);
    await act(async () => click([...view.container.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Approve")!));
    assert.match(view.container.querySelector('[role="alert"]')!.textContent!, /Decision rejected/);
    assert.match(view.container.textContent!, /Applicant/);
    assert.ok([...view.container.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Approve"), "a failed write must restore the original status without relying on a second request");
  } finally { await view.close(); }
});

test("portal review offers only the decision action its scoped endpoint supports", async () => {
  const calls: string[] = [];
  const view = await mount(<ApplicationResponses guildId="server" appId="form" questions={[]} endpoint="/portal/responses" decisionEndpoint="/portal/decision" stagingEnabled />, (url, init) => {
    if (init?.method === "POST") { calls.push(url); return Response.json({}); }
    return Response.json({ responses: [
      { id: "pending", status: "pending", answers: {}, userName: "Applicant" },
      { id: "staged", status: "staged_approved", answers: {}, userName: "Held applicant" },
    ] });
  });
  try {
    assert.equal(view.container.querySelector('input[type="checkbox"]'), null);
    assert.equal(view.container.querySelector('[aria-label="Check for AI"]'), null);
    assert.equal(view.container.querySelector('button[title="Delete this response"]'), null);
    assert.equal(view.container.textContent!.includes("Publish 1 staged"), false);
    await act(async () => click([...view.container.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Approve")!));
    assert.deepEqual(calls, ["/portal/decision"]);
  } finally { await view.close(); }
});

test("account changes isolate saved permissions, local drafts and mounted editors for the same server", async () => {
  const guildId = `privacy-check-${++sequence}`;
  let viewerId = "account-a";
  let context!: Context;
  let changeLocal!: (value: string) => void;
  let localValue = "";
  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(`${viewerId}:${url}`);
    return Response.json(url.endsWith("/config")
      ? { config: { Private: { value: `${viewerId}-saved` } } }
      : { guild: { id: guildId }, me: { id: viewerId, isAdmin: viewerId === "account-a" }, roles: [], channels: [], modules: {} });
  };
  function Editor() {
    context = useManage();
    const [local, setLocal] = React.useState("");
    localValue = local;
    changeLocal = setLocal;
    return null;
  }
  const legacyKey = `gator-draft-${guildId}`;
  localStorage.setItem(legacyKey, JSON.stringify({ "Private.value": "unknown-owner-legacy-draft" }));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async () => { await act(async () => root.render(<ManageProvider guildId={guildId} viewerId={viewerId}><Editor /></ManageProvider>)); };
  try {
    await render();
    assert.equal(context.value("Private.value"), "account-a-saved", "legacy ownerless drafts must be ignored");
    await act(async () => {
      context.stage("Private.value", "account-a-unsaved");
      context.setExternalDraftDirty("message", true);
      changeLocal("account-a-editor");
    });
    viewerId = "account-b";
    await render();
    assert.equal(context.meta?.me.id, "account-b");
    assert.equal(context.meta?.me.isAdmin, false);
    assert.equal(context.value("Private.value"), "account-b-saved");
    assert.deepEqual(context.pending, {});
    assert.equal(context.dirty, false);
    assert.equal(localValue, "", "child editors must remount when the account changes");
    await act(async () => context.stage("Private.value", "account-b-unsaved"));
    viewerId = "account-a";
    await render();
    assert.equal(context.meta?.me.id, "account-a");
    assert.equal(context.value("Private.value"), "account-a-unsaved");
    assert.equal(context.unsavedCount, 1, "the previous account's external editor state must not return");
    viewerId = "account-b";
    await render();
    assert.equal(context.value("Private.value"), "account-b-unsaved");
    assert.equal(requests.length, 4, "each account gets its own first read and reuses only its own warm cache");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    localStorage.removeItem(legacyKey);
    for (const key of Object.keys(localStorage)) if (key.includes(guildId)) localStorage.removeItem(key);
    globalThis.fetch = originalFetch;
  }
});

test("a late load from the previous account cannot replace the new account's same-server data", async () => {
  const guildId = `privacy-inflight-${++sequence}`;
  let viewerId = "account-a";
  let context!: Context;
  let release!: () => void;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const actor = viewerId;
    const url = String(input);
    if (actor === "account-a" && url.endsWith("/config")) await new Promise<void>((resolve) => { release = resolve; });
    return Response.json(url.endsWith("/config")
      ? { config: { Private: { value: actor } } }
      : { guild: { id: guildId }, me: { id: actor }, channels: [], roles: [], modules: {} });
  };
  function Probe() { context = useManage(); return null; }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async () => { await act(async () => root.render(<ManageProvider guildId={guildId} viewerId={viewerId}><Probe /></ManageProvider>)); };
  try {
    await render();
    assert.equal(context.loading, true);
    viewerId = "account-b";
    await render();
    assert.equal(context.value("Private.value"), "account-b");
    await act(async () => release());
    assert.equal(context.meta?.me.id, "account-b");
    assert.equal(context.value("Private.value"), "account-b");
    assert.equal(context.dirty, false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  }
});

test("workflow source choices inspect only the open node and skip closed inspectors", () => {
  const graph = {
    nodes: [
      ...Array.from({ length: 100 }, (_, index) => ({ id: `text-${index}`, type: "text_value", x: 0, y: 0 })),
      { id: "target", type: "send", x: 0, y: 0 },
      { id: "channel", type: "channel_value", x: 0, y: 0 },
    ], edges: [],
  };
  let visits = 0;
  assert.deepEqual(inspectorSources(graph, null, () => { visits++; return true; }), {});
  assert.equal(visits, 0);
  const choices = inspectorSources(graph, "target", (edge) => {
    visits++;
    assert.equal(edge.to.node, "target");
    return edge.from.node !== "target" && edge.from.node !== "text-99";
  });
  assert.equal(choices.text.length, 99);
  assert.deepEqual(choices.channel.map((option) => option.value), ["channel:value"]);
  assert.ok(visits < 110, "hidden nodes must not repeat the source walk");
});

test("ticket questions can switch from checkboxes back to a single dropdown", async () => {
  let question: any;
  function TicketForm() {
    const [questions, setQuestions] = React.useState([{ label: "Choose", kind: "select" as const, max_values: 25, min_values: 1, options: [{ label: "A" }, { label: "B" }] }]);
    question = questions[0];
    return <FormEditor questions={questions} formTitle="" set={(field, next) => { if (field === "Questions") setQuestions(next); }} />;
  }
  const view = await mount(<TicketForm />, () => Response.json({}));
  const type = [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Checkboxes") && button.getAttribute("aria-haspopup") === "listbox")!;
  await act(async () => click(type));
  const dropdown = [...document.querySelectorAll('[role="option"]')].find((button) => button.textContent?.includes("Pick one from options you define"))!;
  await act(async () => click(dropdown));
  assert.equal(question.kind, "select");
  assert.equal(question.max_values, 1);
  assert.equal(question.min_values, 1);
  await view.close();
});

for (const newer of ["C", "A"]) test(`ticket writes preserve newer ${newer === "A" ? "reverted" : "typed"} edits without a failure notice`, async () => {
  let draft!: ReturnType<typeof usePanelDraft>;
  let release!: () => void;
  let writes = 0;
  function TicketDraft() {
    const [panel, setPanel] = React.useState({ guild: "test", type: "single", name: "Support", description: "A" });
    draft = usePanelDraft(panel, async (body) => {
      if (++writes === 1) await new Promise<void>((resolve) => { release = resolve; });
      setPanel((current) => ({ ...current, ...(body.set as Record<string, any>) }));
      return true;
    });
    return null;
  }
  const view = await mount(<TicketDraft />, () => Response.json({}));
  await act(async () => draft.set("description", "B"));
  const noticesBefore = toast.getHistory().length;
  let saving!: Promise<boolean>;
  await act(async () => { saving = view.context().save(); });
  await act(async () => draft.set("description", newer));
  await act(async () => release());
  let complete: boolean | undefined;
  await act(async () => { complete = await saving; });
  assert.equal(complete, false, "save-and-leave must wait for the newer draft");
  assert.equal(draft.current("description"), newer);
  assert.equal(view.context().dirty, true);
  assert.equal(toast.getHistory().slice(noticesBefore).some((notice) => "type" in notice && notice.type === "error"), false);
  await act(async () => { assert.equal(await view.context().save(), true); });
  assert.equal(writes, 2);
  assert.equal(view.context().dirty, false);
  assert.equal(draft.current("description"), newer);
  await view.close();
});

test("a failed resource list can be retried without presenting an empty workspace", async () => {
  let failed = true;
  const view = await mount(<ResourcesSection />, () => failed
    ? Response.json({ detail: "Temporarily offline" }, { status: 503 })
    : Response.json({ resources: [] }));
  assert.match(view.container.textContent!, /Temporarily offline/);
  assert.equal(view.container.textContent!.includes("Nothing built yet"), false);
  failed = false;
  await act(async () => click([...view.container.querySelectorAll("button")].find((button) => button.textContent === "Retry loading resources")!));
  assert.match(view.container.textContent!, /Nothing built yet/);
  await view.close();
});

test("a date shortcut cannot choose Today below a future minimum", async () => {
  const future = new Date();
  future.setDate(future.getDate() + 3);
  const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
  const changes: string[] = [];
  const view = await mount(<DateField value={iso} min={iso} onChange={(next) => changes.push(next)} />, () => Response.json({}));
  await act(async () => click(view.container.querySelector("button")!));
  const today = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Today")!;
  assert.equal(today.disabled, true);
  await act(async () => today.click());
  assert.equal(changes.length, 0);
  await view.close();
});

test("an imported green action button previews with its saved color", async () => {
  const view = await mount(<PreviewButton button={{ type: "button", label: "Approve", style: "green" }} />, () => Response.json({}));
  assert.equal(view.container.querySelector(".dc-btn")?.getAttribute("data-style"), "success");
  await view.close();
});

test("allowed-answer lists keep a typed newline and follow external discard", async () => {
  let values: string[] = [];
  let reset!: () => void;
  function RuleEditor() {
    const [rules, setRules] = React.useState([{ type: "custom_list" as const, values: ["Alpha"] }]);
    values = rules[0].values!;
    reset = () => setRules([{ type: "custom_list", values: ["Alpha"] }]);
    return <ValidationRulesEditor rules={rules} onChange={(next) => setRules(next as typeof rules)} />;
  }
  const view = await mount(<RuleEditor />, () => Response.json({}));
  const field = view.container.querySelector<HTMLTextAreaElement>('textarea[placeholder="One allowed answer per line"]')!;
  const setValue = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => { setValue.call(field, "Alpha\n"); field.dispatchEvent(new win.Event("input", { bubbles: true })); });
  assert.equal(field.value, "Alpha\n");
  assert.deepEqual(values, ["Alpha"]);
  await act(async () => { setValue.call(field, "Alpha\nBeta"); field.dispatchEvent(new win.Event("input", { bubbles: true })); });
  assert.deepEqual(values, ["Alpha", "Beta"]);
  await act(async () => reset());
  assert.equal(field.value, "Alpha");
  await view.close();
});

test("a failed message load blocks editing and retry reads the saved message", async () => {
  let failing = true;
  const writes: unknown[] = [];
  const view = await mount(<MessageDesignCard type="welcome" title="Welcome" hint="" variables={[]} defaults={{ content: "Default" }} />, (url, init) => {
    if (url.includes("/messages")) {
      if (init?.method) writes.push(init.body);
      return failing ? Response.json({ detail: "Offline" }, { status: 503 }) : Response.json({ message: { content: "Previously saved" } });
    }
    return Response.json({ profile: {}, embeds: [], containers: [], panels: [] });
  });
  assert.match(view.container.textContent!, /Retry loading message/);
  assert.equal(view.container.querySelector("textarea"), null);
  assert.equal(view.context().dirty, false);
  await act(async () => { assert.equal(await view.context().save(), true); });
  assert.equal(writes.length, 0);
  failing = false;
  await act(async () => click([...view.container.querySelectorAll("button")].find((button) => button.textContent === "Retry loading message")!));
  assert.match(view.container.textContent!, /Previously saved/);
  assert.equal(view.context().dirty, false);
  await view.close();
});

test("Daily Questions edits participate in the global discard and save actions", async () => {
  let settings = { channel_id: null, pingrole: null, qotdthread: true, nextdate: null };
  let writes = 0;
  let release!: () => void;
  const view = await mount(<DailyQuestionsSection />, async (_url, init) => {
    if (init?.method === "PATCH") {
      writes++;
      await new Promise<void>((resolve) => { release = resolve; });
      settings = { ...settings, ...JSON.parse(String(init.body)).set };
    }
    return Response.json({ qotd: settings });
  });
  const thread = () => view.container.querySelector('[role="switch"]')!;
  await act(async () => click(thread()));
  assert.equal(view.context().dirty, true);
  assert.ok(view.context().unsavedElsewhere.includes("Daily Questions"));
  await act(async () => view.context().discard());
  assert.equal(view.context().dirty, false);
  assert.equal(thread().getAttribute("aria-checked"), "true");
  await act(async () => click(thread()));
  let writing!: Promise<boolean>;
  await act(async () => { writing = view.context().save(); });
  assert.ok(thread().closest("[inert]"));
  await act(async () => release());
  await act(async () => { assert.equal(await writing, true); });
  assert.equal(writes, 1);
  assert.equal(settings.qotdthread, false);
  assert.equal(view.context().dirty, false);
  await view.close();
});

test("failed Daily Questions loads offer retry without exposing blank controls", async () => {
  const view = await mount(<DailyQuestionsSection />, () => Response.json({}, { status: 503 }));
  assert.match(view.container.textContent!, /Retry loading settings/);
  assert.equal(view.container.textContent!.includes("Create threads"), false);
  assert.equal(view.context().dirty, false);
  await view.close();
});

test("profile uploads settle to the saved image URL and clear the global draft", async () => {
  let profile = { display_name: "Helper", global_name: "Bot", avatar: null as string | null, banner: null };
  let uploads = 0;
  let release!: () => void;
  const view = await mount(<CustomizationSection />, async (_url, init) => {
    if (init?.method === "POST") {
      const payload = JSON.parse(String(init.body));
      if (payload.avatar) uploads++;
      await new Promise<void>((resolve) => { release = resolve; });
      profile = { ...profile, avatar: "https://example.com/saved-avatar.png" };
    }
    return Response.json({ profile });
  });
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [new win.File(["picture"], "avatar.png", { type: "image/png" })] });
  await act(async () => {
    input.dispatchEvent(new win.Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  assert.equal(view.context().dirty, true);
  let writing!: Promise<boolean>;
  await act(async () => { writing = view.context().save(); });
  assert.ok(input.closest("[inert]"));
  await act(async () => release());
  await act(async () => { assert.equal(await writing, true); });
  assert.equal(uploads, 1);
  assert.equal(view.context().dirty, false);
  assert.equal(view.container.querySelector<HTMLImageElement>(".gw-upload-img")?.src, profile.avatar);
  await act(async () => { assert.equal(await view.context().save(), true); });
  assert.equal(uploads, 1);
  await view.close();
});

test("a failed profile load offers retry without exposing blank profile controls", async () => {
  const view = await mount(<CustomizationSection />, () => Response.json({}, { status: 503 }));
  assert.match(view.container.textContent!, /Retry loading profile/);
  assert.equal(view.container.querySelector("input"), null);
  assert.equal(view.context().dirty, false);
  await view.close();
});
