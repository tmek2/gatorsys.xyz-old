import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { applicationDraftKey, useApplicationDraft } from "../src/components/use-application-draft.ts";
import { createIntegrityTracker, verdictFor } from "../src/components/application-integrity.ts";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://website.example" });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
});

async function mountDraft(user = "user-a", guild = "guild-a", application = "form-a") {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let control: ReturnType<typeof useApplicationDraft>;
  const rendered: Array<{ key: string; answers: Record<string, unknown> }> = [];
  function Draft({ user, guild, application }: { user: string; guild: string; application: string }) {
    control = useApplicationDraft(user, guild, application);
    rendered.push({ key: control.key, answers: control.answers });
    return React.createElement("output", null, JSON.stringify(control.answers));
  }
  async function show(nextUser: string, nextGuild: string, nextApplication: string) {
    await act(async () => root.render(React.createElement(Draft, { user: nextUser, guild: nextGuild, application: nextApplication })));
  }
  await show(user, guild, application);
  return {
    get control() { return control!; },
    rendered,
    show,
    async close() { await act(async () => root.unmount()); container.remove(); },
  };
}

test("draft answers are isolated by account, server and application without overwriting another draft", async () => {
  localStorage.clear();
  const firstKey = applicationDraftKey("user-a", "guild-a", "form-a");
  const otherKey = applicationDraftKey("user-b", "guild-a", "form-a");
  localStorage.setItem(otherKey, JSON.stringify({ answer: "Second account draft" }));
  const mounted = await mountDraft();
  try {
    await act(async () => mounted.control.setAnswers({ answer: "First account private answer" }));
    const start = mounted.rendered.length;
    await mounted.show("user-b", "guild-a", "form-a");
    assert.deepEqual(mounted.control.answers, { answer: "Second account draft" });
    assert.ok(mounted.rendered.slice(start).every((render) => render.answers.answer !== "First account private answer"));
    assert.deepEqual(JSON.parse(localStorage.getItem(otherKey)!), { answer: "Second account draft" });
    assert.deepEqual(JSON.parse(localStorage.getItem(firstKey)!), { answer: "First account private answer" });

    await mounted.show("user-b", "guild-b", "form-a");
    assert.deepEqual(mounted.control.answers, {});
    assert.equal(localStorage.getItem(applicationDraftKey("user-b", "guild-b", "form-a")), null);
    await mounted.show("user-b", "guild-a", "form-b");
    assert.deepEqual(mounted.control.answers, {});
    await mounted.show("user-a", "guild-a", "form-a");
    assert.deepEqual(mounted.control.answers, { answer: "First account private answer" });
  } finally { await mounted.close(); }
});

test("unscoped legacy answers and malformed stored data do not leak into an account", async () => {
  for (const stored of ["{", "null", "[]", '"answer"']) {
    localStorage.clear();
    localStorage.setItem("gator-app-draft-guild-a-form-a", JSON.stringify({ secret: "Legacy account answer" }));
    localStorage.setItem(applicationDraftKey("user-a", "guild-a", "form-a"), stored);
    const mounted = await mountDraft();
    try { assert.deepEqual(mounted.control.answers, {}); }
    finally { await mounted.close(); }
  }
});

test("clearing a draft resets the form and removes only that account's stored answers", async () => {
  localStorage.clear();
  const otherKey = applicationDraftKey("user-b", "guild-a", "form-a");
  localStorage.setItem(otherKey, JSON.stringify({ answer: "Keep me" }));
  const mounted = await mountDraft();
  try {
    await act(async () => mounted.control.setAnswers({ answer: "Discard me" }));
    await act(async () => mounted.control.clearDraft());
    assert.deepEqual(mounted.control.answers, {});
    assert.equal(localStorage.getItem(applicationDraftKey("user-a", "guild-a", "form-a")), null);
    assert.deepEqual(JSON.parse(localStorage.getItem(otherKey)!), { answer: "Keep me" });
  } finally { await mounted.close(); }
});

test("a loading or signed-out session never reads or writes an unowned draft", async () => {
  localStorage.clear();
  const unownedKey = applicationDraftKey("", "guild-a", "form-a");
  localStorage.setItem(unownedKey, JSON.stringify({ answer: "Unowned data" }));
  const mounted = await mountDraft("");
  try {
    assert.equal(mounted.control.key, "");
    assert.deepEqual(mounted.control.answers, {});
    await act(async () => mounted.control.setAnswers({ answer: "Temporary answer" }));
    assert.deepEqual(JSON.parse(localStorage.getItem(unownedKey)!), { answer: "Unowned data" });
    await mounted.show("user-a", "guild-a", "form-a");
    assert.deepEqual(mounted.control.answers, {});
    assert.equal(localStorage.getItem(applicationDraftKey("user-a", "guild-a", "form-a")), null);
  } finally { await mounted.close(); }
});

test("pasted input is counted once while later typing and deletions keep correct totals", () => {
  const tracker = createIntegrityTracker();
  tracker.input("answer", 50);
  tracker.paste("answer", 200);
  tracker.input("answer", 200);
  tracker.input("answer", 10);
  tracker.input("answer", -20);
  const result = tracker.snapshot().answer;
  assert.deepEqual(result, { typed: 60, pasted: 200, pastes: 1, seconds: 0 });
  assert.equal(verdictFor(result, 240), "mixed");

  const pasted = createIntegrityTracker();
  pasted.paste("answer", 200);
  pasted.input("answer", 200);
  assert.equal(pasted.snapshot().answer.typed, 0);
  assert.equal(verdictFor(pasted.snapshot().answer, 200), "pasted");
});

test("paste replacement and the department keyboard tracker do not discard typed characters", () => {
  const tracker = createIntegrityTracker();
  tracker.input("public", 50);
  tracker.paste("public", 100);
  tracker.input("public", 60);
  assert.deepEqual(tracker.snapshot().public, { typed: 50, pasted: 100, pastes: 1, seconds: 0 });
  tracker.paste("department", 100);
  tracker.typed("department", 1);
  assert.equal(tracker.snapshot().department.typed, 1);
});
