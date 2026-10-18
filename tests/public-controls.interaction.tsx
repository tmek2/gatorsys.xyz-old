import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import React, { act } from "react";

const require = createRequire(import.meta.url);
require.extensions[".css"] = () => undefined;
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost" });
const win = dom.window;
Object.assign(globalThis, {
  window: win, document: win.document, HTMLElement: win.HTMLElement, Element: win.Element,
  CustomEvent: win.CustomEvent, localStorage: win.localStorage,
  getComputedStyle: win.getComputedStyle,
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  IS_REACT_ACT_ENVIRONMENT: true,
});
win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as any;
win.HTMLElement.prototype.scrollIntoView = () => undefined;

async function mount(node: React.ReactNode) {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, async close() { await act(async () => root.unmount()); container.remove(); } };
}

test("search follows its focused result, contains focus, and restores the opener", async () => {
  // Only routing is replaced; the actual palette, presence, and scroll lock run.
  const filename = new URL("../src/components/site/command-palette.tsx", import.meta.url);
  const localRequire = createRequire(filename);
  const ts = require("typescript");
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as any };
  const navigated: string[] = [];
  new Function("require", "module", "exports", compiled)((name: string) =>
    name === "next/navigation" ? { useRouter: () => ({ push: (path: string) => navigated.push(path) }) } : localRequire(name), loaded, loaded.exports);
  const Palette = loaded.exports.CommandPalette;
  const m = await mount(<><button id="outside">Outside control</button><Palette signedIn extra={[
    { id: "first", title: "First result", note: "First", href: "/first", external: false, section: "Local", terms: "", Icon: () => null },
    { id: "second", title: "Second result", note: "Second", href: "/second", external: false, section: "Local", terms: "", Icon: () => null },
  ]} /></>);
  try {
    const opener = m.container.querySelector<HTMLButtonElement>('[aria-label^="Search ("]')!;
    await act(async () => { opener.focus(); opener.click(); });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Search"]')!;
    const field = dialog.querySelector<HTMLInputElement>("input")!;
    const results = [...dialog.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    assert.equal(document.activeElement, field);
    await act(async () => field.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, results.at(-1), "reverse Tab wraps to the final result");
    await act(async () => results.at(-1)!.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, field);
    await act(async () => m.container.querySelector<HTMLButtonElement>("#outside")!.focus());
    assert.equal(document.activeElement, field, "focus cannot escape into the page");
    await act(async () => results[1].focus());
    assert.equal(results[1].getAttribute("aria-selected"), "true");
    await act(async () => results[1].dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, opener);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 220)); });
    assert.deepEqual(navigated, ["/second"]);
    assert.equal(document.querySelector('[role="dialog"][aria-label="Search"]'), null);
    await act(async () => opener.click());
    const close = document.querySelector<HTMLButtonElement>('[aria-label="Close search"]')!;
    await act(async () => close.focus());
    assert.equal(close.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })), true, "the close button keeps its native keyboard action");
    await act(async () => close.click());
    assert.equal(document.activeElement, opener);
    assert.deepEqual(navigated, ["/second"]);
  } finally { await m.close(); }
});

test("comparison slider arrows stay inside the slider instead of reaching feature navigation", async () => {
  const { Compare } = await import("../src/components/site/mac/compare");
  const navigated: string[] = [];
  const navigate = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") navigated.push(event.key);
  };
  window.addEventListener("keydown", navigate);
  const m = await mount(<Compare before={<span>Before</span>} after={<span>After</span>} autoplay={false} />);
  try {
    const slider = m.container.querySelector<HTMLElement>('[role="slider"]')!;
    await act(async () => {
      slider.focus();
      slider.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });
    assert.equal(slider.getAttribute("aria-valuenow"), "59");
    await act(async () => slider.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true, cancelable: true })));
    assert.equal(slider.getAttribute("aria-valuenow"), "49");
    assert.deepEqual(navigated, []);
  } finally {
    window.removeEventListener("keydown", navigate);
    await m.close();
  }
});
