import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * The account menu on a phone.
 *
 * The trigger is a circle that widens into an identity pill on hover. On a
 * touch pointer it is capped back to a circle, and the grid has to fold too,
 * not only the width.
 */
const css = await readFile(
  new URL("../src/components/user-menu.css", import.meta.url),
  "utf8",
);
const tsx = await readFile(
  new URL("../src/components/user-menu.tsx", import.meta.url),
  "utf8",
);

const REM = 16;
const mobileBlock = css
  .split("@media (max-width: 640px), (pointer: coarse) {")[1]
  .split("\n}\n\n/*")[0];

test("the open trigger's tracks fit inside its cap on a touch pointer", () => {
  // A fixed caret column does not fold: face plus caret is 57px inside a 42px
  // cap, which would draw the chevron over the avatar.
  const columns = /grid-template-columns:\s*([^;]+);/.exec(mobileBlock);
  assert.ok(columns, "the mobile block must state the trigger's grid");
  const tracks = columns[1]
    .trim()
    .split(/\s+/)
    .map((track) => Number.parseFloat(track) * REM);
  const cap = Number.parseFloat(/max-width:\s*([\d.]+)rem/.exec(mobileBlock)![1]) * REM;

  assert.ok(
    tracks.reduce((sum, track) => sum + track, 0) <= cap,
    `tracks total ${tracks.reduce((a, b) => a + b, 0)}px inside a ${cap}px cap`,
  );
});

test("the open state does not re-expand the trigger on a touch pointer", () => {
  // Every selector that widens it has to be answered here, including the ones
  // on the surrounding nav — `:hover` still matches on a tap in mobile Safari.
  for (const selector of [
    '.user-menu-trigger[data-open="true"]',
    ".tg-nav-links:hover .user-menu-trigger",
    ".user-menu-trigger:focus-visible",
  ]) {
    assert.ok(mobileBlock.includes(selector), `not overridden on mobile: ${selector}`);
  }
});

test("the hover-only parts are not rendered rather than squeezed", () => {
  assert.match(mobileBlock, /\.user-menu-identity,\s*\n\s*\.user-menu-caret\s*\{\s*\n\s*display: none;/);
});

test("the panel is bounded by the room below the trigger and scrolls in itself", () => {
  // A phone in landscape has less height than this panel wants, and a menu
  // whose last item cannot be reached is the same as not having it.
  assert.match(css, /max-height: calc\(100dvh - var\(--user-menu-top, 4rem\) - 0\.75rem\)/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /overscroll-behavior: contain/);
  // The bound is only right if the panel is told where it actually is.
  assert.match(tsx, /\["--user-menu-top" as string\]: `\$\{anchor\.top\}px`/);
});

test("tapping away closes it", () => {
  // On iOS a tap on something non-interactive does not reliably fire a mouse
  // event, so outside presses are caught with pointerdown.
  assert.match(tsx, /document\.addEventListener\("pointerdown", onPointer\)/);
  assert.match(tsx, /document\.removeEventListener\("pointerdown", onPointer\)/);
});

test("the panel is clamped against the viewport actually being looked at", () => {
  // `innerWidth` counts the scrollbar and, on a pinch-zoomed phone, describes
  // the layout viewport rather than the visual one.
  assert.match(tsx, /document\.documentElement\.clientWidth \|\| window\.innerWidth/);
  assert.doesNotMatch(tsx, /Math\.max\(8, window\.innerWidth - box\.right\)/);
});

test("it is re-placed when the visual viewport moves", () => {
  // The keyboard and the URL bar both change the height a phone has, and
  // neither fires `resize` on every browser.
  assert.match(tsx, /visualViewport\?\.addEventListener\("resize", place\)/);
  assert.match(tsx, /visualViewport\?\.removeEventListener\("resize", place\)/);
});
