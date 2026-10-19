import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React, { act, useState } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { pretendToBeVisual: true, url: "http://localhost" });
const win = dom.window;
// Browser computed styles are live; Radix retains this object across the
// open/closed state change. JSDOM returns a snapshot, so read its current CSS.
function liveComputedStyle(element: Element) {
  return new Proxy(win.getComputedStyle(element), { get(_target, property) {
    const current = win.getComputedStyle(element);
    const value = Reflect.get(current, property);
    return typeof value === "function" ? value.bind(current) : value;
  } });
}
Object.assign(globalThis, {
  window: win, document: win.document, Node: win.Node, NodeFilter: win.NodeFilter,
  HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement,
  Element: win.Element, DocumentFragment: win.DocumentFragment,
  MutationObserver: win.MutationObserver, CustomEvent: win.CustomEvent,
  getComputedStyle: liveComputedStyle,
  CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) },
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  IS_REACT_ACT_ENVIRONMENT: true,
});
let reducedMotion = false;
let phone = false;
win.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion") ? reducedMotion : query.includes("pointer: coarse") && phone, addEventListener() {}, removeEventListener() {} }) as any;
win.HTMLElement.prototype.scrollIntoView = () => undefined;
win.HTMLElement.prototype.hasPointerCapture = () => false;
win.HTMLElement.prototype.setPointerCapture = () => undefined;
win.HTMLElement.prototype.releasePointerCapture = () => undefined;

type AnimationCall = { node: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions; onfinish?: () => void; oncancel?: () => void };
const animations: AnimationCall[] = [];
win.HTMLElement.prototype.animate = function (frames, options) {
  const call = { node: this, frames, options } as AnimationCall;
  animations.push(call);
  return call as unknown as Animation;
};

const style = document.createElement("style");
style.textContent = readFileSync(new URL("../src/app/globals/12-popovers.css", import.meta.url), "utf8");
document.head.append(style);

async function mount(node: React.ReactNode) {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  animations.length = 0;
  await act(async () => root.render(node));
  return { container, async close() {
    await act(async () => root.unmount());
    for (const animation of animations) animation.onfinish?.();
    container.remove();
    reducedMotion = false;
    phone = false;
  } };
}

function place(container: HTMLElement, up: boolean) {
  (container.firstElementChild as HTMLElement).getBoundingClientRect = () => ({ top: up ? 700 : 100, bottom: up ? 740 : 140, left: 80, right: 380, width: 300, height: 40, x: 80, y: 100, toJSON() {} });
}

async function finishCssAnimation(element: HTMLElement, name: string) {
  await act(async () => {
    const event = new win.Event("animationend", { bubbles: true });
    Object.defineProperty(event, "animationName", { value: name });
    element.dispatchEvent(event);
  });
}

test("select, channel and role choices close from the visible frame without replaying their rows", async () => {
  const { SelectField, ChannelPicker, RolePicker } = await import("../src/components/Manage/fields/pickers");
  for (const [index, kind] of ["select", "channel", "role"].entries()) {
    function Field() {
      const [value, setValue] = useState<any>("one");
      if (kind === "channel") return <ChannelPicker value={value} onChange={setValue} channels={[{ id: "one", name: "Alpha", type: "text", parentId: null, position: 0 }, { id: "two", name: "Beta", type: "text", parentId: null, position: 1 }]} />;
      if (kind === "role") return <RolePicker value={value} onChange={setValue} roles={[{ id: "one", name: "Alpha", color: null, position: 0, managed: false }, { id: "two", name: "Beta", color: null, position: 1, managed: false }]} />;
      return <SelectField value={value} onChange={setValue} options={[{ value: "one", label: "Alpha" }, { value: "two", label: "Beta" }]} />;
    }
    const mounted = await mount(<Field />);
    try {
      const up = index === 1;
      place(mounted.container, up);
      const trigger = mounted.container.querySelector<HTMLButtonElement>(".gw-picker-trigger")!;
      await act(async () => { trigger.focus(); trigger.click(); });
      const menu = document.querySelector<HTMLElement>(".gw-menu:not([inert])")!;
      assert.equal(menu.dataset.dir, up ? "up" : "down");
      // Simulate a quick choice while the opening animation is still halfway.
      menu.style.opacity = "0.65";
      menu.style.transform = "matrix(0.99, 0, 0, 0.99, 0, -2)";
      menu.style.clipPath = "inset(0 0 22% 0 round 14px)";
      menu.style.animationName = "gw-menu-in";
      const list = menu.querySelector<HTMLElement>(".gw-menu-list")!;
      list.scrollTop = 64;
      list.scrollLeft = 5;
      const rows = menu.querySelectorAll<HTMLButtonElement>('[role="option"]');
      rows[1].style.animationName = "gw-menu-row-in";
      rows[1].style.opacity = "0.8";
      rows[1].style.transform = "translateY(-1px)";
      await act(async () => rows[1].click());
      const ghost = document.querySelector<HTMLElement>(".gw-menu[inert]")!;
      assert.ok(ghost, `${kind} retains a visual exit`);
      assert.equal(ghost.style.animation, "none", `${kind} must not replay its entrance`);
      assert.equal(ghost.querySelectorAll('[role="option"]')[1].getAttribute("style")?.includes("animation: none"), true);
      assert.equal((ghost.querySelector(".gw-menu-list") as HTMLElement).scrollTop, 64);
      assert.equal((ghost.querySelector(".gw-menu-list") as HTMLElement).scrollLeft, 5);
      const animation = animations.find((entry) => entry.node === ghost)!;
      assert.equal(animation.frames[0].opacity, "0.65");
      assert.equal(animation.frames[0].transform, "matrix(0.99, 0, 0, 0.99, 0, -2)");
      assert.equal(animation.frames[0].clipPath, "inset(0 0 22% 0 round 14px)");
      assert.equal(animation.frames.at(-1)!.clipPath, up ? "inset(65% 0 0 0 round 14px)" : "inset(0 0 65% 0 round 14px)");
      assert.equal(trigger.getAttribute("aria-expanded"), "false");
      assert.match(trigger.textContent!, /Beta/);
      assert.equal(document.activeElement, trigger);
      animation.onfinish?.();
      assert.equal(ghost.isConnected, false);
    } finally { await mounted.close(); }
  }
});

test("multiple choice stays open, Escape returns focus, and outside dismissal respects the next control", async () => {
  const { MultiSelectField } = await import("../src/components/Manage/fields/pickers");
  function Field() {
    const [value, setValue] = useState<string[]>([]);
    return <><MultiSelectField value={value} onChange={setValue} options={[{ value: "one", label: "Alpha" }, { value: "two", label: "Beta" }]} /><button id="outside">Outside</button></>;
  }
  const mounted = await mount(<Field />);
  try {
    const trigger = mounted.container.querySelector<HTMLButtonElement>(".gw-picker-trigger")!;
    await act(async () => { trigger.focus(); trigger.click(); });
    await act(async () => document.querySelector<HTMLButtonElement>('[role="option"]')!.click());
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
    assert.match(trigger.textContent!, /Alpha/);
    await act(async () => document.querySelector(".gw-menu input")!.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    assert.equal(document.activeElement, trigger);
    animations.forEach((entry) => entry.onfinish?.());
    await act(async () => trigger.click());
    const outside = mounted.container.querySelector<HTMLButtonElement>("#outside")!;
    await act(async () => { outside.focus(); outside.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true })); });
    assert.equal(document.activeElement, outside);
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
  } finally { await mounted.close(); }
});

test("phone picker copies keep sheet/row entrance animations off, while reduced motion closes immediately", async () => {
  const { SelectField } = await import("../src/components/Manage/fields/pickers");
  phone = true;
  const mounted = await mount(<SelectField value="one" onChange={() => {}} options={[{ value: "one", label: "Alpha" }]} />);
  try {
    const trigger = mounted.container.querySelector<HTMLButtonElement>(".gw-picker-trigger")!;
    await act(async () => trigger.click());
    await act(async () => document.querySelector<HTMLButtonElement>(".gw-menu-scrim")!.click());
    const ghost = document.querySelector<HTMLElement>(".gw-menu-sheet[inert]")!;
    assert.ok(ghost);
    assert.equal(ghost.querySelector<HTMLElement>(".gw-menu-sheet-body")!.style.animation, "none");
    assert.equal(ghost.querySelector<HTMLElement>('[role="option"]')!.style.animation, "none");
    animations.forEach((entry) => entry.onfinish?.());
    reducedMotion = true;
    await act(async () => trigger.click());
    const count = animations.length;
    await act(async () => document.querySelector<HTMLButtonElement>(".gw-menu-scrim")!.click());
    assert.equal(animations.length, count);
    assert.equal(document.querySelector(".gw-menu-sheet"), null);
  } finally { await mounted.close(); }
});

test("searchable popovers keep their filtered contents until closing finishes and clear only when reopened", async () => {
  const { PickerPopover } = await import("../src/components/Manage/picker-popover");
  const picked: string[] = [];
  const mounted = await mount(<PickerPopover trigger={<button>Add block</button>} title="Add a block" searchThreshold={1} options={[{ value: "one", label: "Alpha" }, { value: "two", label: "Beta" }]} onPick={(value) => picked.push(value)} />);
  try {
    const trigger = mounted.container.querySelector<HTMLButtonElement>("button")!;
    await act(async () => trigger.click());
    const popup = document.querySelector<HTMLElement>(".gator-picker")!;
    const input = popup.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, "Beta");
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
    });
    assert.equal(popup.querySelectorAll(".gator-picker-option").length, 1);
    await act(async () => popup.querySelector<HTMLButtonElement>(".gator-picker-option")!.click());
    assert.deepEqual(picked, ["two"]);
    assert.equal(popup.isConnected, true, "the closing phase stays mounted");
    assert.equal(popup.getAttribute("data-state"), "closed");
    assert.equal(getComputedStyle(popup).animationName, "gw-pop-out");
    assert.equal(input.value, "Beta", "closing must not expand the filtered list again");
    assert.equal(popup.querySelectorAll(".gator-picker-option").length, 1);
    await finishCssAnimation(popup, "gw-pop-out");
    assert.equal(popup.isConnected, false);
    await act(async () => trigger.click());
    assert.equal(document.querySelector<HTMLInputElement>(".gator-picker input")!.value, "");
    assert.equal(document.querySelectorAll(".gator-picker-option").length, 2);
  } finally { await mounted.close(); }
});

test("dropdown menus use a distinct closing animation and preserve selection and trigger focus", async () => {
  const { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } = await import("../src/components/ui/dropdown-menu");
  let selected = false;
  const mounted = await mount(<DropdownMenu><DropdownMenuTrigger>Actions</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => { selected = true; }}>Choose this</DropdownMenuItem></DropdownMenuContent></DropdownMenu>);
  try {
    const trigger = mounted.container.querySelector<HTMLButtonElement>("button")!;
    await act(async () => trigger.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    assert.ok(menu);
    await act(async () => menu.querySelector<HTMLElement>('[role="menuitem"]')!.click());
    assert.equal(selected, true);
    assert.equal(menu.isConnected, true);
    assert.equal(getComputedStyle(menu).animationName, "gw-pop-out");
    await finishCssAnimation(menu, "gw-pop-out");
    assert.equal(menu.isConnected, false);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(document.activeElement, trigger);
  } finally { await mounted.close(); }
});
