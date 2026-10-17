import assert from "node:assert/strict";
import test from "node:test";
import { source } from "./read-source.ts";
import {
  configValuesEqual,
  matchesSaved,
  messagesEqual,
} from "../src/components/Manage/config-compare.ts";

/* ── Undoing your own edit clears the save prompt ──

   "Same as saved" compares what the field shows, not the stored value, so an
   edit undone by hand clears the prompt. */

test("a switch that defaults to on can be turned off, and back on is no change", () => {
  const field = { type: "toggle", defaultValue: true };
  // Nothing saved: the switch shows on.
  assert.equal(matchesSaved(false, undefined, field), false, "turning it off is a change");
  assert.equal(matchesSaved(true, undefined, field), true, "on again is not");
  assert.equal(matchesSaved(undefined, undefined, field), true);
  // Saved explicitly off, and left off.
  assert.equal(matchesSaved(false, false, field), true);
});

test("typing a field's default back in is no change, and neither is clearing it", () => {
  const field = { type: "number", defaultValue: 7 };
  assert.equal(matchesSaved(7, undefined, field), true);
  assert.equal(matchesSaved("7", undefined, field), true, "a number field hands back text");
  assert.equal(matchesSaved(null, undefined, field), true, "cleared means unset");
  assert.equal(matchesSaved(8, undefined, field), false);
});

test("a list of roles is a set, and a ladder is a list", () => {
  const a = "600000000000000001";
  const b = "600000000000000002";
  assert.equal(matchesSaved([b, a], [a, b], { type: "roles" }), true);
  assert.equal(matchesSaved([b, a], [a, b]), true, "no schema field: ids are still a set");
  assert.equal(matchesSaved([b, a], [a, b], { type: "ladder" }), false);
  assert.equal(matchesSaved([a], [a, b], { type: "roles" }), false);
});

test("an object of empties says the same as nothing", () => {
  assert.equal(configValuesEqual({ ask_feedback: false }, undefined), true);
  assert.equal(configValuesEqual({ a: { b: "" } }, {}), true);
  assert.equal(configValuesEqual({ ask_feedback: true }, undefined), false);
});

test("editors with drafts of their own compare by value, not by JSON text", async () => {
  for (const file of [
    "src/components/Manage/sections/gator-ai.tsx",
    "src/components/Manage/ticket-ai-behaviour.tsx",
    "src/components/Manage/sections/infraction-hierarchy.tsx",
    "src/components/Manage/sections/daily-questions.tsx",
  ]) {
    const text = await source(file);
    assert.match(text, /configValuesEqual\(/, file);
    assert.doesNotMatch(text, /JSON\.stringify\([^)]*\) !==/, file);
  }
  const context = await source("src/components/Manage/manage-context.tsx");
  assert.match(context, /const spec = shown === undefined \? field : \{ \.\.\.\(field \|\| \{\}\), defaultValue: shown \}/);
  assert.match(context, /matchesSaved\(nextValue, saved, spec\)/);
  // A message edited and put back is no change, whatever shape the editor
  // turned the saved one into.
  const message = await source("src/components/Manage/config-message.tsx");
  assert.match(message, /stage\(path, messagesEqual\(next, asDraft\(saved\)\) \? saved : next\)/);
  const compare = await source("src/components/Manage/config-compare.ts");
  assert.match(compare, /export function messagesEqual/);
});

/* ── Tickets ────────────────────────────────────────────────────────────── */

test("tickets is three views, and a subject is five short pages", async () => {
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  assert.match(tickets, /<Segments<TicketsView>/);
  for (const view of ['value: "subjects"', 'value: "panels"', 'value: "ai"']) {
    assert.match(tickets, new RegExp(view));
  }
  for (const page of ["setup", "access", "closing", "form", "messages"]) {
    assert.match(tickets, new RegExp(`value: "${page}", label:`), page);
  }
  // Every view stays mounted; a subject with unsaved edits is a draft the
  // save prompt is holding.
  assert.match(tickets, /className="gw-tk-view" hidden=\{view !== "subjects"\}/);
  // One subject open at a time.
  assert.match(tickets, /open=\{openItem === `single:\$\{panel\.name\}`\}/);
});

test("a ticket subject saves through the dashboard's one save prompt", async () => {
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  assert.match(tickets, /registerExternalDraft\(key, \{/);
  assert.match(tickets, /setExternalDraftDirty\(key, dirty\)/);
  // No second save bar of its own.
  assert.doesNotMatch(tickets, /createPortal/);
  assert.doesNotMatch(tickets, /Unsaved changes to \{panelName\}/);
  // Its own edits, compared the way the subject shows them.
  assert.match(tickets, /function sameTicketField\(/);
  assert.match(tickets, /if \(field === "rename"\) return String\(staged \?\? ""\)\.trim\(\) === panel\.name/);
});

/* ── The phone ──────────────────────────────────────────────────────────── */

test("on a phone the navigation is a dock that grows into its lists", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const dock = await source("src/components/Manage/phone-dock.tsx");
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(shell, /<PhoneDock/);
  for (const label of ['label: "Overview"', 'label: "Browse"', '"To fix" : "Set up"', 'label: "Search"']) {
    assert.match(dock, new RegExp(label));
  }
  // "Tabs" named the mechanism, and the module wall already has a home on
  // Overview: the fourth place is search.
  assert.doesNotMatch(dock, /label: "(Tabs|Modules)"/);
  // It steps aside for typing and for the save prompt, which takes its place --
  // but not for the search, which it tucks under instead.
  assert.match(dock, /data-away=\{\(typing \|\| dirty\) && !open && !tucked \? "true" : undefined\}/);
  assert.match(dock, /data-tucked=\{tucked \? "true" : undefined\}/);
  assert.match(win, /\.gw-dock\[data-tucked="true"\] \{\s*transform: translate3d\(0, 10px, 0\) scale\(0\.94\);/);
  // And it cannot be left down by a field that vanished while focused: every
  // press checks again what has focus.
  assert.match(dock, /document\.addEventListener\("pointerdown", recheck, true\);/);
  assert.match(dock, /if \(node\.closest\("\.g-cmd"\)\) return false;/);
  assert.match(win, /\[aria-label="Unsaved changes"\] \{\s*--safe-bottom-gap: 12px !important;/);
  // The height is measured, so it animates both ways and between lists.
  assert.match(dock, /setHeight\(open \? node\.scrollHeight : 0\)/);
  assert.match(win, /\.gw-dock-panel \{[^}]*transition: height 420ms/);
  // The pressed mark stretches into a labelled pill.
  assert.match(win, /\.gw-dock-item\[data-on="true"\] \.gw-dock-label \{[^}]*max-width: 7em;/);
  // The strip at the foot is gone on a phone.
  const phone = win.slice(win.search(/@media \(max-width: 760px\) \{\s*\.gw-bar \{/));
  assert.match(phone, /--gw-foot: 0px;[\s\S]{0,40}\.gw-foot \{\s*display: none;/);
  // And the desktop sheet still opens at the tab you are on.
  assert.match(shell, /querySelector<HTMLElement>\('\[data-current="true"\]'\) \?\?/);
});

test("sheets and toasts go away when pulled down", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const fields = await source("src/components/Manage/fields.tsx");
  const dock = await source("src/components/Manage/phone-dock.tsx");
  for (const text of [shell, fields, dock]) {
    assert.match(text, /useDragDismiss/);
  }
  // Toasts are swiped by Sonner, down or to the side.
  const saveBar = await source("src/components/Manage/save-bar.tsx");
  assert.match(saveBar, /swipeDirections=\{\["bottom", "right"\]\}/);
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(win, /\.gw-sheet-pull \{[^}]*touch-action: none/);
});

test("a dropdown on a phone is a sheet that scrolls, over the keyboard", async () => {
  const fields = await source("src/components/Manage/fields.tsx");
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(fields, /sheet=\{phone\}/);
  // The search does not raise the keyboard over the list as it opens.
  assert.match(fields, /autoFocus=\{!phone\}/);
  assert.doesNotMatch(
    fields.slice(fields.indexOf("function PickerShell("), fields.indexOf("/* Channel / role pickers")),
    /\n\s*autoFocus\r?\n/,
  );
  // The list scrolling is not the field moving.
  assert.match(fields, /menuRef\.current\?\.contains\(event\.target as Node\)\) return;/);
  assert.match(win, /margin-bottom: calc\(var\(--kb, 0px\)/);
});

test("the controls inside a dropdown's field keep their size under a finger", async () => {
  const fields = await source("src/components/Manage/fields.tsx");
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(fields, /className="gw-picker-clear /);
  assert.match(win, /\.manage-root \.gw-picker-refresh,\s*\.manage-root \.gw-picker-clear \{[^}]*min-height: 0 !important/);
  assert.match(fields, /data-tap="inline"/);
});

test("the warning pill is drawn at its own size and says what was deleted", async () => {
  const win = await source("src/components/Manage/manage-window.css");
  const health = await source("src/components/Manage/config-health.ts");
  assert.match(win, /\.gw-health-chip \{[^}]*min-height: 0 !important/);
  assert.match(health, /"Deleted channel"/);
  assert.match(health, /"Deleted role"/);
  assert.doesNotMatch(health, /"Channel deleted"|"Role deleted"/);
});

test("toasts are Sonner's, in the window's own parts", async () => {
  const saveBar = await source("src/components/Manage/save-bar.tsx");
  const context = await source("src/components/Manage/manage-context.tsx");
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(context, /import \{ toast \} from "sonner";/);
  assert.match(context, /value\.kind === "saved" \? toast\.success : toast\.error/);
  assert.match(saveBar, /<Toaster/);
  assert.match(saveBar, /unstyled: true/);
  // Its motion is left alone: the toast's own class sets no transform,
  // transition, position or animation.
  const toastRule = win.slice(win.indexOf(".gw-toast {"), win.indexOf("}", win.indexOf(".gw-toast {")));
  assert.doesNotMatch(toastRule, /transform|transition|position|animation/);
  // Clear of the dock on a phone -- and of the save prompt, which stands where
  // the dock was, so one height clears either.
  assert.match(saveBar, /mobileOffset=\{\{ bottom: 86, left: 8, right: 8 \}\}/);
  // A second tap on an open stack folds it: a finger never "leaves".
  assert.match(saveBar, /function useTapToCollapse\(\)/);
  assert.match(saveBar, /new MouseEvent\("mouseout", \{ bubbles: true, relatedTarget: document\.body \}\)/);
});

test("the save prompt is set in the window's face", async () => {
  const saveBar = await source("src/components/Manage/save-bar.tsx");
  const win = await source("src/components/Manage/manage-window.css");
  // `btn-pop` puts its label in the display serif.
  assert.doesNotMatch(saveBar, /className="[^"]*btn-pop/);
  assert.doesNotMatch(saveBar, /text-\[#f5f2f2\]/);
  assert.match(win, /\.gw-save \{[^}]*font-family: var\(--gw-chrome\)/);
});

/* ── Motion and edges ───────────────────────────────────────────────────── */

test("ER:LC's sections change with a highlight that travels and a panel that arrives", async () => {
  const section = await source("src/components/Manage/schema-section.tsx");
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(section, /<span className="prc-rail-blob" aria-hidden="true" \/>/);
  assert.match(section, /key=\{current\.id\}/);
  assert.match(win, /\.prc-rail-blob \{[^}]*transform: translate\(var\(--blob-x, 0\), var\(--blob-y, 0\)\)/);
});

test("a group's corners stay round while it opens and shuts", async () => {
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(win, /\.gw-set-panel \{[^}]*clip-path: inset\(0 round var\(--r-card\)\)/);
});

test("the bar keeps clear of the window's corners", async () => {
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(win, /\.gw-bar \{[^}]*padding-inline: calc\(var\(--r-window\) \+ var\(--u1\)\)/);
});

test("the audit log is grouped by day, in the window's parts", async () => {
  const audit = await source("src/components/Manage/sections/audit.tsx");
  assert.match(audit, /function dayLabel\(/);
  assert.match(audit, /<Segments<AuditKind>/);
  assert.match(audit, /className="gw-set-roll"/);
  assert.doesNotMatch(audit, /bg-\[#f5f2f2\]/);
});

/* ── Sample people ──────────────────────────────────────────────────────── */

test("previews only ever name .tmek, Alternative or offser", async () => {
  const allowed = new Set([".tmek", "Alternative", "offser"]);
  const people = [
    "{author.name}",
    "{author.mention}",
    "{author.display}",
    "{user.name}",
    "{user.mention}",
    "{staff.name}",
    "{staff.mention}",
    "{manager.display_name}",
    "{host}",
  ];
  const registry = await source("src/config/variable-registry.ts");
  const examples = registry.slice(
    registry.indexOf("VARIABLE_EXAMPLES"),
    registry.indexOf("\n};", registry.indexOf("VARIABLE_EXAMPLES")),
  );
  const editor = await source("src/components/Manage/embed-editor.tsx");
  const substitutions = editor.slice(
    editor.indexOf("PREVIEW_SUBSTITUTIONS"),
    editor.indexOf("\n};", editor.indexOf("PREVIEW_SUBSTITUTIONS")),
  );
  const schema = await source("src/components/Manage/schema.ts");
  // The sample values only, not the descriptions keyed the same way.
  for (const [where, text] of [
    ["variable examples", examples],
    ["preview substitutions", substitutions],
    ["schema preview overrides", schema],
  ] as const) {
    for (const key of people) {
      const escaped = key.replace(/[{}.]/g, (character) => `\\${character}`);
      for (const match of text.matchAll(new RegExp(`"${escaped}": "([^"]+)"`, "g"))) {
        const name = match[1].replace(/^@/, "");
        assert.ok(allowed.has(name), `${where}: ${key} previews as "${match[1]}"`);
      }
    }
  }
});

/* ── Round two: undoing by hand, lag, and the last of the old parts ─────── */

test("a message typed into and put back is not a change, whatever its shape", () => {
  // Saved as a plain string; the editor reports its own object shape.
  const shown = {
    content: "Welcome {member.mention}!",
    embed: {},
    components: [],
    render_mode: "legacy",
    v2_layout: [],
    v2_color: "none",
  };
  assert.equal(messagesEqual(shown, "Welcome {member.mention}!"), true);
  // Nothing saved, and the editor's defaults sent back untouched.
  assert.equal(messagesEqual({ content: "", embed: {}, render_mode: "legacy" }, undefined), true);
  // One embed, stored singly or as a list, is one message.
  assert.equal(messagesEqual({ embeds: [{ title: "Hi" }] }, { embed: { title: "Hi" } }), true);
  // A real edit is still an edit.
  assert.equal(messagesEqual({ content: "Welcome!" }, "Welcome {member.mention}!"), false);
  assert.equal(messagesEqual({ embed: { title: "Hi" }, render_mode: "v2" }, { embed: { title: "Hi" } }), false);
});

test("scrolling a phone moves nothing that takes up space", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  // The capsule and the ground are layers that fade and settle; the bar keeps
  // its size, so no frame of a scroll re-lays-out the page.
  const capsule = css.slice(css.indexOf("@keyframes gw-capsule-in"), css.indexOf("}", css.indexOf("to {", css.indexOf("@keyframes gw-capsule-in"))));
  assert.doesNotMatch(capsule, /\b(top|height|margin|padding|width|border-radius):/);
  assert.match(css, /\.manage-root \.gw-bar::before \{\s*animation: gw-capsule-in/);
  assert.match(css, /\.manage-root \.gw-bar,\s*\.manage-root \.gw-bar \.gw-zone,\s*\.manage-root \.gw-bar \.gw-tab \{\s*animation: none;/);
  // The site's header holds its own height while its bar floats.
  const landing = await source("src/components/site/landing.css");
  assert.match(landing, /\.g-nav\[data-float="true"\] \{[^}]*height: 72px;[^}]*contain: layout style;/);
});

test("nothing measures the page on every keystroke", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  // The rail's row is scrolled to when the tab changes, not from a ref
  // callback React calls on every render.
  assert.doesNotMatch(shell, /ref=\{\(node\) => \{\s*if \(node && current\) node\.scrollIntoView/);
  assert.match(shell, /\?\.scrollIntoView\(\{ block: "nearest" \}\);\s*\}, \[section\]\);/);
  // The rail's highlight is placed when the tab changes, not per edit.
  assert.match(shell, /return \(\) => watch\.disconnect\(\);[\s\S]{0,400}\}, \[section\]\);/);
  // The toaster is told its direction and kept out of the save prompt's renders.
  const bar = await source("src/components/Manage/save-bar.tsx");
  assert.match(bar, /const Toasts = React\.memo\(/);
  assert.match(bar, /<Toaster\s*\n\s*dir="ltr"/);
});

test("the server picker's blur starts on the press itself", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  // The blur layer is on the page already; the press starts it directly and
  // the panel renders as a transition, after the first frame has painted.
  assert.match(shell, /querySelector<HTMLElement>\("\.gw-pick-layer"\)\?\.setAttribute\("data-open", "true"\)/);
  assert.match(shell, /React\.startTransition\(\(\) => setOpen\(\(current\) => !current\)\)/);
  const picker = await source("src/components/Manage/server-picker.tsx");
  assert.match(picker, /data-open=\{open \? "true" : showing \? "false" : "idle"\}/);
});

test("the intro's logo is the header's lockup, scaled", async () => {
  const css = await source("src/components/site/intro.css");
  const intro = await source("src/components/site/site-intro.tsx");
  assert.match(intro, /<span className="g-intro-letters">/);
  assert.match(css, /\.g-intro-word \{[^}]*align-items: center;[^}]*gap: 0\.47em;/);
  assert.match(css, /\.g-intro-mark svg \{[^}]*height: 1\.72em;/);
});

test("each tab's mark has a gesture of its own", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(shell, /data-tab=\{item\.id\}/);
  assert.match(css, /\.gw-row\[data-current="true"\] \.gw-row-icon svg \{[^}]*animation: var\(--gw-fx, gw-fx-bounce\)/);
  for (const [tab, fx] of [["reminders", "gw-fx-ring"], ["audit", "gw-fx-rewind"], ["infractions", "gw-fx-gavel"], ["roblox", "gw-fx-globe"]]) {
    assert.match(css, new RegExp(`\\.gw-row\\[data-tab="${tab}"\\][^{]*\\{ --gw-fx: ${fx};`), tab);
  }
});

test("a picture develops in when it has arrived, wherever one is set", async () => {
  const motion = await source("src/components/motion.tsx");
  assert.match(motion, /export function DevelopingImage/);
  for (const file of [
    "src/components/Manage/embed-editor.tsx",
    "src/components/Manage/application-editor.tsx",
    "src/components/Manage/department-workspace.tsx",
    "src/components/Manage/sections/resources.tsx",
  ]) {
    assert.match(await source(file), /<DevelopingImage/, file);
  }
  const globals = await source("src/app/globals.css");
  assert.match(globals, /\.g-develop-load\[data-ready="false"\] \{/);
});

test("the message editors are drawn in the window's parts", async () => {
  const design = await source("src/components/Manage/message-design.tsx");
  // No native checkboxes and no bare switches with a word beside them.
  assert.doesNotMatch(design, /type="checkbox"/);
  assert.doesNotMatch(design, /<Toggle/);
  // No pink dots on blocks; an empty one says so.
  assert.doesNotMatch(design, /h-1\.5 w-1\.5 shrink-0 rounded-full bg-\[var\(--accent-peach\)\]/);
  assert.match(design, /className="gw-md-block-empty"/);
  // One add button.
  assert.ok((design.match(/className="gw-btn"/g) || []).length >= 8);
  // All-caps captions are set back to sentence case site-wide, not only here.
  const globals = await source("src/app/globals.css");
  assert.match(globals, /^\.uppercase:not\(\.font-mono\)/m);
});

/* ── Round three: the editor, lists, transitions, the phone ─────────────── */

test("an embed is edited on its own preview", async () => {
  const canvas = await source("src/components/Manage/embed-canvas.tsx");
  const configMessage = await source("src/components/Manage/config-message.tsx");
  const designer = await source("src/components/Manage/message-design.tsx");
  // Both editors draw the canvas in embed mode rather than a form beside a preview.
  assert.match(configMessage, /<EmbedCanvas/);
  assert.match(designer, /<EmbedCanvas/);
  assert.doesNotMatch(configMessage, /<EmbedForm/);
  assert.doesNotMatch(designer, /<EmbedForm/);
  // Every part is pressed where it is, and an empty one says what goes there,
  // faintly, in its own size and weight.
  for (const placeholder of ['placeholder: "Author"', 'placeholder: "Title"', 'placeholder: "Footer"', "Field\\s*</button>"]) {
    assert.match(canvas, new RegExp(placeholder));
  }
  // On the mockup builder's Discord surface, signed as the bot in this server.
  assert.match(canvas, /<DiscordFrame className="gw-cv-chat">/);
  assert.match(canvas, /className="dc-embed gw-cv-embed"/);
  // Edited in place: a field with no box of its own, not a dark text box.
  const message = await source("src/components/Manage/discord-message.tsx");
  assert.match(message, /className="dc-inline-field"/);
  assert.doesNotMatch(canvas, /gw-canvas-input/);
  // Pictures are dropped, chosen or pasted, and uploaded.
  assert.match(message, /onChange\(await uploadMessageImage\(manage\.guildId, file\)\)/);
  // `{` is the editor's, not the canvas's own: one list for every field.
  assert.doesNotMatch(canvas, /gw-canvas-suggest/);
  // Pressing another part switches straight to it (closing first moved the
  // message under the finger), and a press inside the phone's sheet belongs to
  // the part it holds.
  assert.match(canvas, /if \(target\.closest\("\[data-part\], \.gw-cv-tools, \.gw-psheet-layer, \.gw-cv-embed-bar"\)\) return;/);
});

test("rows in lists arrive and leave, however they change", async () => {
  const motion = await source("src/components/motion.tsx");
  assert.match(motion, /export function PresenceList/);
  assert.match(motion, /export function useListKeys/);
  for (const file of [
    "src/components/Manage/special-fields.tsx",
    "src/components/Manage/embed-editor.tsx",
    "src/components/Manage/sections/tickets.tsx",
    "src/components/Manage/sections/connection-roles.tsx",
    "src/components/Manage/sections/infraction-hierarchy.tsx",
    "src/components/Manage/sections/permissions.tsx",
    "src/components/Manage/sections/auto-response.tsx",
    "src/components/Manage/message-design.tsx",
  ]) {
    assert.match(await source(file), /<PresenceList/, file);
  }
  // Container blocks keep their own keys for dragging: they unroll in and
  // fold away instead.
  const designer = await source("src/components/Manage/message-design.tsx");
  assert.match(designer, /foldAway\(event\.currentTarget\.closest\("\[data-block-path\]"\)/);
  const globals = await source("src/app/globals.css");
  assert.match(globals, /@keyframes g-li-out \{\s*to \{\s*grid-template-rows: 0fr;/);
});

test("a tab change moves the page, from the side of the rail it came from", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(shell, /const NAV_ORDER: string\[\] = NAV_GROUPS\.flatMap/);
  assert.match(shell, /"data-nav-dir",\s*\n\s*NAV_ORDER\.indexOf\(to\) >= NAV_ORDER\.indexOf\(from\) \? "down" : "up"/);
  // Back to the top inside the change, so the new tab is captured where it is seen.
  assert.match(shell, /flushSync\(\(\) => setSectionPath\(next\)\);\s*\n\s*top\(\);/);
  // Only the page moves: the window is held still, not cross-faded.
  assert.match(css, /:root\[data-nav="tab"\]::view-transition-old\(root\),\s*\n:root\[data-nav="tab"\]::view-transition-new\(root\) \{\s*animation: none;/);
  assert.match(css, /:root\[data-nav-dir="up"\] \{/);
});

test("the phone's capsule holds its contents and every tab reaches it", async () => {
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(css, /\.manage-root \.gw-bar::before \{\s*inset: 4px 6px;/);
  assert.match(css, /\.manage-root \.gw-bar \.gw-zone,\s*\n\s*\.manage-root \.gw-bar \.gw-tab-coach,[\s\S]{0,160}align-self: center;/);
  assert.match(css, /animation: gw-capsule-in var\(--gw-ease\) both;\s*\n\s*animation-timeline: scroll\(root block\);\s*\n\s*animation-range: 0 60px;/);
  assert.match(css, /\.manage-root \.gw-pane \{\s*min-height: calc\(100dvh \+ 64px\);/);
});

test("the server picker's blur is on the page before it is asked for", async () => {
  const picker = await source("src/components/Manage/server-picker.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(picker, /const ready = useMounted\(\);/);
  assert.match(css, /\.gw-pick-layer\[data-open="idle"\] \.gw-pick-scrim \{\s*visibility: hidden;/);
  assert.match(css, /\.gw-pick-scrim \{\s*transform-origin: 50% 0;/);
});

test("the phone's search fades on its own bottom edge", async () => {
  const css = await source("src/components/site/command-palette.css");
  assert.doesNotMatch(css, /\.g-cmd-list::after \{/);
  assert.match(css, /\.g-cmd-list \{\s*padding-bottom: 44px;\s*-webkit-mask-image: linear-gradient\(to bottom, #000 calc\(100% - 44px\), transparent\);/);
});

test("small things a phone made hard", async () => {
  const audit = await source("src/components/Manage/sections/audit.tsx");
  assert.match(audit, /toLocaleDateString\("en-US", \{\s*\n\s*weekday: "long"/);
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  assert.match(tickets, /title="Close when quiet"\s*\n\s*description="[^"]*"\s*\n\s*>/);
  const css = await source("src/components/Manage/manage-window.css");
  assert.match(css, /\.manage-root \.prc-rail \{\s*padding-right: 40px;\s*scroll-snap-type: x proximity;/);
  const editor = await source("src/components/Manage/embed-editor.tsx");
  assert.match(editor, /describeVariable\(key\)\.example \?\? token/);
});

test("`{` opens the module's variables on the bracket, and completes inline", async () => {
  const vac = await source("src/components/Manage/variable-autocomplete.tsx");
  const css = await source("src/components/Manage/manage-window.css");
  // One per editor, listening to every field in it.
  for (const file of ["src/components/Manage/config-message.tsx", "src/components/Manage/message-design.tsx"]) {
    assert.match(await source(file), /<VariableAutocomplete containerRef=\{(containerRef|cardRef)\} variables=\{variables\} module=\{module\} \/>/, file);
  }
  // Found at the caret by a laid-out copy of the field, and placed on the bracket.
  assert.match(vac, /function pointAt\(field: Field, index: number\)/);
  assert.match(vac, /const above = place\.bracket\.top > 240;/);
  // The module's own variables first, then shared, then global.
  assert.match(vac, /const scopeOrder = \{ module: 0, shared: 1, global: 2 \} as const;/);
  // The rest of the best match in grey ahead of the caret; Tab or → takes it.
  assert.match(vac, /className="gw-vac-ghost"/);
  assert.match(vac, /event\.key === "Enter" \|\| event\.key === "Tab"/);
  assert.match(vac, /event\.key === "ArrowRight"/);
  // A screen reader is told it is a completing list.
  assert.match(vac, /setAttribute\("aria-autocomplete", "both"\)/);
  assert.match(css, /\.gw-vac\[data-side="above"\] \{\s*translate: 0 -100%;/);
  // A focused field lands clear of the floating bars.
  assert.match(css, /html:has\(\.manage-root\) \{\s*scroll-padding-top: 132px;/);
});

test("a module's variables are tagged with the module being edited", async () => {
  const vac = await source("src/components/Manage/variable-autocomplete.tsx");
  // Smart variables that resolve in several modules are grouped under the
  // module they are used in: `{newrank}` under Promotions reads "Promotions".
  // Said once, as the group heading.
  assert.match(vac, /item\.scope === "module"\s*\r?\n\s*\? module \|\| item\.group/);
  assert.match(vac, /<p className="gw-vac-group">\{title\}<\/p>/);
  assert.doesNotMatch(vac, /className="gw-vac-tag"/);
  const schema = await source("src/components/Manage/schema-section.tsx");
  assert.equal((schema.match(/module=\{section\.label\}/g) || []).length, 2);
  for (const [file, name] of [
    ["src/components/Manage/sections/tickets.tsx", "Tickets"],
    ["src/components/Manage/sections/auto-response.tsx", "Auto Response"],
  ]) {
    assert.match(await source(file), new RegExp(`<MessageObjectEditor\\s*\\n\\s*module="${name}"`), file);
  }
});

test("a segmented control's selection jumps, on the compositor", async () => {
  const motion = await source("src/components/motion.tsx");
  // Two edges on two springs -- the leading one quicker -- so it stretches as
  // it travels, and three slices so its corners stay round while it does.
  assert.match(motion, /export function useJellyThumb/);
  assert.match(motion, /const lead = spring\(t, 0\.34, 0\.74\);/);
  assert.match(motion, /const tail = spring\(t, 0\.46, 0\.92\);/);
  assert.match(motion, /<i data-p="l" \/>\s*<i data-p="m" \/>\s*<i data-p="r" \/>/);
  // Transforms only.
  assert.match(motion, /slice\.animate\(\s*frames\[index\]\.map\(\(transform, k\) => \(\{ transform, offset: offsets\[k\] \}\)\)/);
  for (const file of [
    "src/components/Manage/segments.tsx",
    "src/components/Manage/message-chrome.tsx",
    "src/components/Manage/sections/modules.tsx",
  ]) {
    assert.match(await source(file), /<JellyThumb \/>/, `${file} has no jumping thumb`);
  }
});

test("the server is a tab on the bar, in a grey window rather than a black one", async () => {
  const win = await source("src/components/Manage/manage-window.css");
  /* The window keeps its own grey rather than the landing's #030303, and the
     tab stands on the bar beside the mark. */
  assert.doesNotMatch(win, /--gw-ground: #030303;/);
  assert.doesNotMatch(win, /--gw-tab-shift/);
  assert.doesNotMatch(win, /background: #030303;/);
  assert.match(win, /--gw-ground: var\(--mac-bar\);/);
  // Raised, outlined on three sides, standing on the bar's floor.
  assert.match(win, /\.gw-tab \{[\s\S]{0,200}align-self: flex-end;[\s\S]{0,400}background: var\(--mac-raise\);/);
  assert.match(win, /inset 0 1px 0 var\(--mac-tab-rim\),\s*inset 1px 0 0 var\(--mac-tab-rim\),\s*inset -1px 0 0 var\(--mac-tab-rim\);/);
  // And the tab is not the title in the bar.
  assert.doesNotMatch(win, /\.manage-root \.gw-bar \.gw-tab \{\s*align-self: center;\s*height: 36px;/);
});

test("the invite is the one that works, everywhere", async () => {
  for (const file of ["src/components/Manage/server-picker.tsx", "src/components/site/landing.tsx"]) {
    const text = await source(file);
    assert.doesNotMatch(text, /redirectUri: `\$\{window\.location\.origin\}\/servers`/, `${file} asks Discord for an unregistered redirect`);
    assert.match(text, /window\.open\(getDiscordBotInviteUrl\(\), "_blank", "noopener,noreferrer"\)/);
  }
});

test("a page is never wider than the screen, so view transitions are not abandoned", async () => {
  const globals = await source("src/app/globals.css");
  assert.match(globals, /html,\s*\r?\nbody \{\s*overflow-x: clip;\s*\}/);
  const intro = await source("src/components/site/intro.css");
  assert.match(intro, /\.g-intro-field \{\s*inset: 7%;\s*\}/);
});

test("a tab brought in by a transition does not enter a second time", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(shell, /arrivedByTransition = next;\s*\r?\n\s*flushSync\(\(\) => setSectionPath\(next\)\);/);
  assert.match(shell, /data-still=\{arrivedByTransition === sectionPath \? "true" : undefined\}/);
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(win, /\.gw-place\[data-still="true"\] \{\s*animation: none;/);
});

test("the save prompt is a card that shows what changed and says when it is saved", async () => {
  const bar = await source("src/components/Manage/save-bar.tsx");
  const context = await source("src/components/Manage/manage-context.tsx");
  // What changed, each with its own way back.
  assert.match(bar, /className="gw-save-peek" role="list"/);
  assert.match(bar, /onClick=\{\(\) => revert\(path\)\}/);
  assert.match(context, /revert: \(path: string\) => void;/);
  // The shortcut it answers to, in this keyboard's words.
  assert.match(bar, /\? "⌘S"\s*\r?\n\s*: "Ctrl S"/);
  // Confirmed in place, not by a toast in the other corner.
  assert.match(bar, /<svg className="gw-save-tick"/);
  assert.doesNotMatch(context, /showNotice\(\{ kind: "saved", text: "Changes saved" \}\)/);
  // Discard can be undone.
  assert.match(context, /action: \{ label: "Undo", run: \(\) => setPending\(\(current\) => \(\{ \.\.\.thrown, \.\.\.current \}\)\) \}/);
  const win = await source("src/components/Manage/manage-window.css");
  // One rule for the card, in one place.
  assert.match(win, /\.gw-save \{\s*position: relative;\s*display: block;\s*width: auto;\s*max-width: min\(100%, 31rem\);\s*padding: 6px;/);
  assert.equal(win.match(/^\.gw-save \{/gm)?.length, 1);
  /* Saved, the card holds only the tick and the word and shrinks around
     them, rather than keeping its width with one word at the left. It keeps
     saying "Saved" while it leaves. */
  assert.match(bar, /\{done \? null : \(/);
  assert.match(bar, /node\.animate\(\[\{ width: `\$\{before\.current\}px` \}, \{ width: `\$\{after\}px` \}\]/);
  assert.match(bar, /const done = saved \|\| \(leftSaved\.current && !dirty && bar\.mounted\);/);
});

test("a module that is off has corners on a phone too, and thaws when turned on", async () => {
  const gate = await source("src/components/Manage/module-gate.tsx");
  const win = await source("src/components/Manage/manage-window.css");
  assert.match(win, /\.manage-root \.gw-pane \.gw-gate \{\s*max-width: 400px;\s*padding: 24px;\s*border: 1px solid var\(--g-line\);\s*border-radius: 20px;/);
  assert.match(gate, /<div className="gw-gate-thaw">\{children\}<\/div>/);
});

test("the session is refreshed where it can be written back", async () => {
  const middleware = await source("src/middleware.ts");
  assert.match(middleware, /const withSession = auth\(\(request\) => hostGuard\(request\)\);/);
  assert.match(middleware, /if \(request\.nextUrl\.pathname\.startsWith\("\/api\/auth"\)\) return hostGuard\(request\);/);
});

test("messages are signed by the bot as it is in this server", async () => {
  const identity = await source("src/components/Manage/bot-identity.tsx");
  const frame = await source("src/components/Manage/discord-message.tsx");
  const custom = await source("src/components/Manage/sections/customization.tsx");
  assert.match(identity, /name: profile\?\.display_name \|\| profile\?\.global_name \|\| FALLBACK\.name/);
  assert.match(frame, /const identity = useBotIdentity\(manage\?\.guildId\);/);
  // Customization's edits show everywhere before they are saved.
  assert.match(custom, /publishBotIdentity\(guildId, \{/);
  assert.match(custom, /settleBotIdentity\(guildId, identityFromProfile\(refreshed\.profile\)\)/);
});

test("the search on a phone floats, and names each tab with its own mark", async () => {
  const css = await source("src/components/site/command-palette.css");
  assert.match(css, /\.g-cmd \{\s*width: 100%;\s*max-height: min\(62dvh, 540px\);\s*border: 1px solid var\(--g-line-strong\);\s*border-radius: 24px;/);
  assert.match(css, /\.g-cmd-heading \{[^}]*text-transform: none;/);
  const shell = await source("src/components/Manage/manage-shell.tsx");
  assert.match(shell, /icon: SECTION_ICONS\[id\],/);
});
