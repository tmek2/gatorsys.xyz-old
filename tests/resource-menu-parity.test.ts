import assert from "node:assert/strict";
import test from "node:test";
import { source } from "./read-source.ts";

/**
 * One "New" menu for the server resources page and a department's resources
 * tab. The department renders the shared component with a filtered list, so a
 * kind missing from a surface is a deliberate line of code.
 */

const MENU = "src/components/Manage/new-resource-menu.tsx";
const DEPARTMENT = "src/components/Manage/department-workspace.tsx";
const SERVER = "src/components/Manage/sections/resources.tsx";

test("both surfaces render the shared menu", async () => {
  for (const file of [DEPARTMENT, SERVER]) {
    const text = await source(file);
    assert.match(
      text,
      /<NewResourceMenu/,
      `${file} does not use the shared menu, so it will drift again`,
    );
  }
});

test("the department page has no hand-rolled copy of the options", async () => {
  const text = await source(DEPARTMENT);
  // The old block built its own array of {kind,label,description,icon} objects
  // and its own PortalMenu. Either coming back means the copy is back.
  assert.doesNotMatch(
    text,
    /kind: "document" as const/,
    "the hardcoded option list is back in department-workspace",
  );
  assert.doesNotMatch(
    text,
    /setCreateOpen/,
    "the hand-rolled popover is back; NewResourceMenu owns its own",
  );
});

test("every kind the shared list offers is handled by both surfaces", async () => {
  const menu = await source(MENU);
  const kinds = [...menu.matchAll(/^\s+kind: "([a-z]+)",$/gm)].map((m) => m[1]);
  assert.ok(kinds.length >= 5, `expected the full option list, found ${kinds}`);

  const department = await source(DEPARTMENT);
  const server = await source(SERVER);
  const departmentOffers = kinds.filter((kind) => kind !== "workspace");

  for (const kind of departmentOffers) {
    // Either the create path names it, or the option is disabled so it cannot
    // be clicked. A kind that is neither is a menu entry that does nothing.
    const named = department.includes(`"${kind}"`);
    const disabled = new RegExp(
      `kind: "${kind}"[\\s\\S]{0,220}?disabled: true`,
    ).test(menu);
    assert.ok(
      named || disabled,
      `department resources offer "${kind}" and neither handle nor disable it`,
    );
  }
  for (const kind of kinds) {
    const named = server.includes(`"${kind}"`);
    const disabled = new RegExp(
      `kind: "${kind}"[\\s\\S]{0,220}?disabled: true`,
    ).test(menu);
    assert.ok(
      named || disabled,
      `server resources offer "${kind}" and neither handle nor disable it`,
    );
  }
});

test("options that are not built are disabled rather than clickable", async () => {
  const menu = await source(MENU);
  // Both of these answered "Folders are coming" *after* being clicked, which
  // is a menu that looks like it does six things and does four.
  for (const kind of ["folder", "workspace"]) {
    assert.match(
      menu,
      new RegExp(`kind: "${kind}"[\\s\\S]{0,220}?disabled: true`),
      `"${kind}" is offered as though it works`,
    );
  }
  assert.doesNotMatch(
    menu,
    /kind: "workflow"/,
    "the removed automation builder is still offered in the New menu",
  );
});

test("a department does not offer to contain another workspace", async () => {
  // "A separate area with its own resources and access" is what a department
  // already is, so the option is filtered out rather than shown disabled.
  const menu = await source(MENU);
  assert.match(
    menu,
    /DEPARTMENT_RESOURCE_OPTIONS[\s\S]{0,220}?option\.kind !== "workspace"/,
  );
});

test("the department create path routes each kind somewhere real", async () => {
  const text = await source(DEPARTMENT);
  // Applications are their own record and the two document kinds are rows in
  // the resource list.
  assert.match(text, /if \(kind === "application"\)[\s\S]{0,600}onCreateApplication/);
  assert.doesNotMatch(text, /kind === "workflow"|workflows\/new/);
  assert.match(text, /if \(kind !== "document" && kind !== "spreadsheet"\) return;/);
});

/* ── The module button ──

   A giveaway's "Enter", a ticket panel's "Close" and "Claim": the button the
   module owns, placed by a `system_button` placeholder. It can go inside a
   container (`_strip_system_button` walks into containers on the bot), and it
   cannot be duplicated: there is one module button, and the bot uses the last
   placeholder it finds. */

const DESIGN = "src/components/Manage/message-design.tsx";

test("a layout carrying the module button can be wrapped in a container", async () => {
  const text = await source(DESIGN);
  assert.doesNotMatch(
    text,
    /if \(list\.some\(\(block\) => block\.type === "system_button"\)\) return list;/,
    "the implicit wrapper is being refused again",
  );
});

test("the placement control is offered inside containers too", async () => {
  const text = await source(DESIGN);
  assert.doesNotMatch(
    text,
    /\{!nested && systemButtons && systemButtons\.length && !hasSystemButton/,
    "the control is top-level only again",
  );
  assert.match(text, /\{systemButtons && systemButtons\.length && !hasSystemButton/);
});

test("whether the button is placed is asked of the whole message", async () => {
  const text = await source(DESIGN);
  // A nested editor sees only its own blocks, so deriving this locally offers
  // a second placeholder inside every container.
  assert.match(text, /export function layoutHasSystemButton/);
  assert.match(
    text,
    /const hasSystemButton = systemButtonPlaced \?\? layoutHasSystemButton\(blocks\)/,
  );
  assert.match(text, /systemButtonPlaced=\{systemButtonPlaced\}/);
});

test("the module button placeholder cannot be duplicated", async () => {
  const text = await source(DESIGN);
  assert.match(
    text,
    /disabled=\{\s*block\.type === "system_button" \|\|/,
    "duplicate is still offered for the placeholder",
  );
  assert.match(text, /There is one module button, so there is one place for it\./);
});
