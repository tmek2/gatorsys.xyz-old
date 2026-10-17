import assert from "node:assert/strict";
import test from "node:test";
import { source } from "./read-source.ts";

/**
 * The small things nobody is told about. Each is pinned to the moment it is
 * for, so a refactor cannot turn one into something that fires all the time.
 *
 * - Pressing empty background on the landing drops a pebble in the dot field.
 * - Typing "gator" anywhere sends one swimming along the foot of the screen.
 * - Turning on the last module bursts confetti from what was pressed, the
 *   counter pops to "All on", and the toast says it was the last one.
 * - Ctrl+S with nothing to save says so.
 * - Changing the appearance lets stars out of the button on the way to dark,
 *   and rays on the way to light.
 */

test("a pebble only lands on the background", async () => {
  const field = await source("src/components/site/dot-field.tsx");

  // Not on a control or anything with a role, and not on a panel painted
  // over the field.
  assert.match(field, /function onGround\(/);
  assert.match(field, /\[role\]/);
  assert.match(field, /window\.addEventListener\("pointerdown", onDown, \{ passive: true \}\)/);
  assert.match(field, /window\.removeEventListener\("pointerdown", onDown\)/);
});

test("the gator swims when its name is typed, not while somebody writes", async () => {
  const swim = await source("src/components/gator-swim.tsx");
  const layout = await source("src/app/layout.tsx");

  assert.match(swim, /const WORD = "gator";/);
  // Typing the word into a field is writing, not asking.
  assert.match(swim, /isContentEditable \|\| \/\^\(INPUT\|TEXTAREA\|SELECT\)\$\//);
  assert.match(swim, /event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/);
  assert.match(swim, /reduced\.matches/);
  // One at a time.
  assert.match(swim, /setSwim\(\(current\) => current \|\| Date\.now\(\)\)/);
  assert.match(layout, /<GatorSwim \/>/);
});

test("confetti is for turning the last module on, not for loading", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const burst = await source("src/components/site/burst.ts");

  // Only a change seen here counts: a server that arrives with everything on
  // has no previous count, so nothing fires.
  assert.match(shell, /if \(loading\) return;/);
  assert.match(
    shell,
    /if \(before === null \|\| before >= MODULE_TOGGLES\.length \|\| modulesOn !== MODULE_TOGGLES\.length\) return;/,
  );
  /* From where the eyes are (the card that was pressed), not the counter in
     the strip, which a toast used to sit over. */
  assert.match(shell, /const from = pressed instanceof HTMLElement && pressed !== document\.body \? pressed : countRef\.current;/);
  assert.match(shell, /void burstFrom\(from, \{ big: true \}\);/);
  assert.match(shell, /data-cheer=\{cheer \? "true" : undefined\}/);
  const modules = await source("src/components/Manage/sections/modules.tsx");
  assert.match(modules, /`\$\{label\} is on\. That's all \$\{MODULE_TOGGLES\.length\}\.`/);
  // Toasts sit above the status strip, so "All on" is never covered.
  const bar = await source("src/components/Manage/save-bar.tsx");
  assert.match(bar, /offset=\{\{ bottom: lifted \? 100 : 64, right: 20 \}\}/);

  // Lazily loaded, above the page, deaf to the pointer, never under reduced
  // motion.
  assert.match(burst, /await import\("canvas-confetti"\)/);
  assert.match(burst, /pointerEvents: "none"/);
  assert.match(burst, /prefers-reduced-motion: reduce/);
  // A phone hides the counter; the burst then comes from the foot of the
  // window, not from the top-left corner a hidden element reports.
  assert.match(burst, /const shown = box\.width > 0 && box\.height > 0;/);
  assert.match(burst, /: \{ x: 0\.5, y: 1 \};/);
});

test("saving with nothing to save is answered", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(
    shell,
    /else if \(!dirty && !saving\) setNotice\(\{ kind: "saved", text: "Already saved\. The gator checked twice\.", id: "already-saved" \}\);/,
  );
});

test("the appearance leaves the button with stars or rays", async () => {
  const toggle = await source("src/components/site/theme-toggle.tsx");
  const css = await source("src/components/site/theme-toggle.css");
  // Stars for dark, rays for light, nothing for auto, never under reduced
  // motion, and drawn where no header can clip them.
  assert.match(toggle, /kind: next === "dark" \? "stars" : "rays"/);
  assert.match(toggle, /next === "auto" \|\| !box \|\| window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(toggle, /createPortal\(\s*<span\s+key=\{flourish\.id\}\s+className="g-theme-burst"/);
  assert.match(css, /\.g-theme-burst \{[^}]*position: fixed;[^}]*pointer-events: none;/);
  // The old tease is gone: the wipe's pace made six presses in four seconds
  // something nobody would find.
  assert.doesNotMatch(toggle, /Pick one\.|FLIPS|teased/);
});
