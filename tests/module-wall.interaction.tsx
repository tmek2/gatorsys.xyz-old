import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost",
});
const win = dom.window;
Object.assign(globalThis, {
  window: win,
  document: win.document,
  HTMLElement: win.HTMLElement,
  Element: win.Element,
  SVGElement: win.SVGElement,
  getComputedStyle: win.getComputedStyle,
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  IS_REACT_ACT_ENVIRONMENT: true,
});
win.matchMedia = () =>
  ({
    matches: true,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }) as any;
win.HTMLElement.prototype.setPointerCapture = () => {};
win.HTMLElement.prototype.getBoundingClientRect = function () {
  const i = this.hasAttribute("data-module")
    ? Array.from(this.parentElement!.children).indexOf(this)
    : 0;
  const x = (i % 3) * 250,
    y = Math.floor(i / 3) * 170;
  const width =
    this.classList.contains("g-mac-pane") ||
    this.classList.contains("g-module-grid")
      ? 750
      : 240;
  return {
    x,
    y,
    left: x,
    top: y,
    right: x + width,
    bottom: y + 160,
    width,
    height: 160,
    toJSON() {},
  };
};
for (const [name, get] of Object.entries({
  offsetLeft: (i: number) => (i % 3) * 250,
  offsetTop: (i: number) => Math.floor(i / 3) * 170,
  offsetWidth: () => 240,
  offsetHeight: () => 160,
})) {
  Object.defineProperty(win.HTMLElement.prototype, name, {
    get() {
      return get(Array.from(this.parentElement?.children ?? []).indexOf(this));
    },
  });
}
function pointer(node: Element, type: string, x = 30, y = 30) {
  const e = new win.MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(e, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    pointerType: { value: "mouse" },
  });
  node.dispatchEvent(e);
}
async function mount() {
  const { createRoot } = await import("react-dom/client");
  const { ModuleWallGrid } =
    await import("../src/components/site/mac/wall-grid");
  const pane = document.createElement("div");
  pane.className = "g-mac-pane";
  document.body.append(pane);
  const root = createRoot(pane);
  const opened: string[] = [];
  await act(async () =>
    root.render(
      <ModuleWallGrid
        picked={null}
        onPick={() => {}}
        onOpen={(key) => opened.push(key)}
      />,
    ),
  );
  return {
    pane,
    opened,
    grid: pane.querySelector(".g-module-grid")!,
    button: pane.querySelector("button")!,
    close: async () => {
      await act(async () => root.unmount());
      pane.remove();
    },
  };
}
const hold = () => new Promise((resolve) => setTimeout(resolve, 280));
test("a short click opens exactly once and leaves no drag copy", async () => {
  const m = await mount();
  await act(async () => {
    pointer(m.button, "pointerdown");
    pointer(m.button, "pointerup");
    m.button.dispatchEvent(
      new win.MouseEvent("click", { bubbles: true, detail: 1 }),
    );
  });
  assert.equal(m.opened.length, 1);
  assert.equal(document.querySelector(".g-module-ghost"), null);
  await m.close();
});
test("holding picks up, movement reorders, and release does not open", async () => {
  const m = await mount();
  const key = m.button.dataset.key;
  await act(async () => {
    pointer(m.button, "pointerdown");
    await hold();
  });
  assert.ok(document.querySelector(".g-module-ghost"));
  await act(async () => {
    pointer(m.grid, "pointermove", 300, 30);
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  assert.equal(m.grid.children[1].getAttribute("data-module"), key);
  await act(async () => {
    pointer(m.grid, "pointerup", 300, 30);
    m.button.dispatchEvent(
      new win.MouseEvent("click", { bubbles: true, detail: 1 }),
    );
  });
  assert.equal(m.opened.length, 0);
  assert.equal(document.querySelector(".g-module-ghost"), null);
  // Keyboard activation must still work immediately after a pointer drag.
  await act(async () =>
    m.button.dispatchEvent(
      new win.MouseEvent("click", { bubbles: true, detail: 0 }),
    ),
  );
  assert.equal(m.opened.length, 1);
  await m.close();
});
test("Escape cancels an in-flight reorder and restores original order", async () => {
  const m = await mount();
  const before = Array.from(m.grid.children).map((el) =>
    el.getAttribute("data-module"),
  );
  await act(async () => {
    pointer(m.button, "pointerdown");
    await hold();
  });
  await act(async () => {
    pointer(m.grid, "pointermove", 300, 30);
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  await act(async () =>
    window.dispatchEvent(
      new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  assert.deepEqual(
    Array.from(m.grid.children).map((el) => el.getAttribute("data-module")),
    before,
  );
  assert.equal(m.opened.length, 0);
  assert.equal(document.querySelector(".g-module-ghost"), null);
  await m.close();
});
test("moving before the hold threshold cancels pickup, and releasing outside cleans up", async () => {
  const m = await mount();
  await act(async () => {
    pointer(m.button, "pointerdown");
    pointer(m.grid, "pointermove", 60, 30);
    await hold();
  });
  assert.equal(document.querySelector(".g-module-ghost"), null);
  await act(async () => {
    pointer(m.button, "pointerdown");
    pointer(document.body, "pointerup");
    await hold();
  });
  assert.equal(document.querySelector(".g-module-ghost"), null);
  await m.close();
});
test("Alt and arrow keys rearrange without opening a module", async () => {
  const m = await mount();
  const key = m.button.dataset.key;
  await act(async () =>
    m.button.dispatchEvent(
      new win.KeyboardEvent("keydown", {
        key: "ArrowRight",
        altKey: true,
        bubbles: true,
      }),
    ),
  );
  assert.equal(m.grid.children[1].getAttribute("data-module"), key);
  assert.equal(m.opened.length, 0);
  await m.close();
});
