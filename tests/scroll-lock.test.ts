import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { lockScroll } from "../src/components/site/scroll-lock.ts";

test("opening a sheet during another sheet's exit restores page scrolling", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  try {
    const first = lockScroll({ leaving: 20 });
    assert.equal(document.documentElement.style.overflow, "hidden");
    first();
    const second = lockScroll();
    second();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(document.documentElement.style.overflow, "");
    assert.equal(document.documentElement.dataset.scrollLocked, undefined);
  } finally {
    Object.assign(globalThis, { window: oldWindow, document: oldDocument });
    dom.window.close();
  }
});
