import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { source as readSource } from "./read-source.ts";

/**
 * The container model, matched against Discohook's: a message is a list of
 * top-level components, and a container is one member of that list (beside
 * text, action rows, sections, galleries and files), not a frame around all of
 * them. A button added next to a line of text therefore does not box the text.
 *
 * The module is a client component that pulls in the whole editor tree, so it
 * cannot be imported here: the pure helpers are re-derived from its source and
 * exercised, and the structural parts are asserted against the source.
 */
const source = await readSource("src/components/Manage/message-design.tsx");

/** The save boundary: where the explicit-layout flag is set and handed down. */
const configMessage = await readFile(
  new URL("../src/components/Manage/config-message.tsx", import.meta.url),
  "utf8",
);

async function read(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

/** The paste box, which is where a Discohook layout comes in. */
const discordJson = await read("src/components/Manage/discord-json.ts");
const customCommands = await read("src/components/Manage/sections/custom-commands.tsx");

/** Every editor that can drop a saved template into a message. */
const templateLoaders = [
  ["message-design", source],
  ["config-message", configMessage],
  ["sessions", await read("src/components/Manage/sections/sessions.tsx")],
  ["custom-commands", customCommands],
] as const;

type Block = { type: string; blocks?: Block[]; content?: string; color?: string };

/** Mirrors `countContainerComponents`. */
function countComponents(blocks: Block[]): number {
  return (blocks || []).reduce(
    (sum, block) =>
      block.type === "container"
        ? sum + 1 + countComponents(block.blocks || [])
        : sum + 1,
    0,
  );
}

/** Mirrors `containerCharacterCount`. */
function characterCount(blocks: Block[]): number {
  return (blocks || []).reduce((sum, block) => {
    if (block.type === "container") return sum + characterCount(block.blocks || []);
    return ["text", "section", "text_button"].includes(block.type)
      ? sum + String(block.content || "").length
      : sum;
  }, 0);
}

const nested: Block[] = [
  { type: "text", content: "outside" },
  { type: "button_row" },
  {
    type: "container",
    blocks: [
      { type: "text", content: "inside" },
      { type: "button_row" },
    ],
  },
  { type: "separator" },
];

test("a container counts as a component, and so does everything in it", () => {
  // 2 top-level + the container itself + 2 inside + 1 separator.
  assert.equal(countComponents(nested), 6);
});

test("boxing blocks does not make them free", () => {
  const flat: Block[] = [
    { type: "text", content: "a" },
    { type: "text", content: "b" },
    { type: "text", content: "c" },
  ];
  const boxed: Block[] = [{ type: "container", blocks: flat }];
  // The container adds one; spreading blocks across containers must never be a
  // way past the message ceiling.
  assert.equal(countComponents(flat), 3);
  assert.equal(countComponents(boxed), 4);
});

test("characters are counted through containers", () => {
  assert.equal(characterCount(nested), "outside".length + "inside".length);
});

test("an empty layout counts nothing", () => {
  assert.equal(countComponents([]), 0);
  assert.equal(characterCount([]), 0);
});

test("the ceiling is enforced against the message, not against one level", () => {
  // A nested editor is told the message's count rather than measuring its own,
  // or a layout could pass the limit by being spread across containers.
  assert.match(source, /totalCount\?: number;/);
  assert.match(source, /const componentCount = totalCount \?\? countContainerComponents\(blocks\)/);
  assert.match(source, /disabled=\{componentCount >= CONTAINER_LIMITS\.blocks\}/);
  assert.match(source, /totalCount=\{componentCount\}/);
});

test("a container holds blocks; it does not frame every block", () => {
  assert.match(source, /export function layoutHasContainers/);
  assert.match(source, /blocks\?: ContainerBlock\[\];/);
  // Its own accent, falling back to the message's.
  assert.match(source, /color\?: string;/);
});

test("Discord has no container inside a container, so the palette has none", () => {
  assert.match(source, /const NESTABLE_ADDERS = CONTAINER_ADDERS\.filter\(\(adder\) => adder\.type !== "container"\)/);
  assert.match(source, /const adders = nested \? NESTABLE_ADDERS : CONTAINER_ADDERS;/);
});

/** Mirrors `toEditorLayout`. */
function toEditorLayout(blocks: Block[]): Block[] {
  const list = blocks || [];
  if (!list.length) return list;
  if (list.some((b) => b.type === "container")) return list;
  if (list.some((b) => b.type === "system_button")) return list;
  return [{ type: "container", blocks: list }];
}

test("a layout with no container is shown as the container it actually means", () => {
  // A layout saved before containers were blocks means "one box around
  // everything", which is how Discord shows it.
  const stored: Block[] = [{ type: "text", content: "hi" }, { type: "button_row" }];
  const editing = toEditorLayout(stored);
  assert.equal(editing.length, 1);
  assert.equal(editing[0].type, "container");
  assert.deepEqual(editing[0].blocks, stored);
});

test("a block added to a fresh message is not boxed", () => {
  // The bug: there was no way to express "not in a container", because the
  // absence of one already meant its presence.
  const fresh = toEditorLayout([]);
  const afterAddingText: Block[] = [...fresh, { type: "text", content: "hi" }];
  assert.equal(afterAddingText.some((b) => b.type === "container"), false);
  assert.equal(countComponents(afterAddingText), 1);
});

test("a block added to a normalised legacy layout lands outside the box", () => {
  const editing = toEditorLayout([{ type: "text", content: "boxed" }]);
  const afterAddingButton: Block[] = [...editing, { type: "button_row" }];
  assert.deepEqual(
    afterAddingButton.map((b) => b.type),
    ["container", "button_row"],
  );
});

test("normalising is idempotent and leaves an explicit layout alone", () => {
  const explicit: Block[] = [
    { type: "text", content: "outside" },
    { type: "container", blocks: [{ type: "text", content: "inside" }] },
  ];
  assert.deepEqual(toEditorLayout(explicit), explicit);
  assert.deepEqual(toEditorLayout(toEditorLayout(explicit)), explicit);
});

test("the accent is not copied onto the new container", () => {
  // Both the bot and the preview fall back to the message's own `v2_color`, so
  // duplicating it into a second place only creates something to disagree.
  const editing = toEditorLayout([{ type: "text", content: "hi" }]);
  assert.equal(editing[0].color, undefined);
});

test("a layout carrying a module button placeholder is left implicit", () => {
  // The bot looks for the placeholder in the top-level list to position the
  // module's own button; wrapping would bury it a level down.
  const withSystemButton: Block[] = [
    { type: "text", content: "hi" },
    { type: "system_button" },
  ];
  assert.deepEqual(toEditorLayout(withSystemButton), withSystemButton);
});

test("both the editor and the preview normalise at the boundary", () => {
  assert.match(source, /export function toEditorLayout/);
  // Both pass the explicit flag through. A preview that normalised differently
  // from the editor would draw a box the editor cannot remove.
  assert.match(
    source,
    /nested \? storedBlocks : toEditorLayout\(storedBlocks, explicitLayout\)/,
  );
  assert.match(source, /const blocks = toEditorLayout\(storedBlocks, explicitLayout\)/);
});

test("opening an editor does not, by itself, count as a change", () => {
  // No adopt-on-mount effect: writing the implicit wrapper into the draft on
  // open made every editor dirty as its page loaded (a save prompt on an
  // untouched page, and a tab guard that would not let you leave). The box is
  // removed with the row's unwrap control instead, which is a real edit.
  assert.doesNotMatch(source, /onChangeRef\.current\(adopted\)/);
  assert.doesNotMatch(source, /const adopted = toEditorLayout\(storedBlocks, false\)/);
  assert.match(source, /next\.splice\(index, 1, \.\.\.\(block\.blocks \|\| \[\]\)\)/);
});

test("normalising returns the very same array when it changes nothing", () => {
  // The no-op path must return the same array: a copy would write to the draft
  // on every render and leave a clean form dirty.
  const explicit: Block[] = [{ type: "container", blocks: [] }];
  assert.equal(toEditorLayout(explicit), explicit);
  const empty: Block[] = [];
  assert.equal(toEditorLayout(empty), empty);
  const legacy: Block[] = [{ type: "text", content: "hi" }];
  assert.notEqual(toEditorLayout(legacy), legacy);
});

test("a layout is never handed to the editor without saying how to read it", () => {
  // Every path that assigns a layout marks it explicit (the Discohook paste,
  // the template loaders, the AI suggestion); otherwise it inherits the legacy
  // default and comes back boxed. Discohook's own JSON has no wrapper in it.
  assert.match(
    discordJson,
    /message as any\)\.v2_layout = source\.v2_layout;[\s\S]{0,400}v2_explicit_layout = true;/,
  );
  for (const [name, file] of templateLoaders) {
    assert.match(
      file,
      /v2_layout: template\.layout,[\s\S]{0,200}v2_explicit_layout: true,/,
      `${name} loads a template without marking the layout explicit`,
    );
  }
  assert.match(
    customCommands,
    /suggestion\.v2_layout[\s\S]{0,400}v2_explicit_layout: Array\.isArray\(suggestion\.v2_layout\)/,
  );
});

test("a saved layout is read exactly as written", () => {
  // An explicit-layout flag, like Discord's own message flag, so that "no
  // container" can be expressed. Without it the first block of a fresh message
  // came back boxed, and deleting the box boxed its blocks again.
  assert.match(source, /if \(explicit\) return list;/);
  // Set once, at the save boundary, so every later render agrees.
  assert.match(configMessage, /v2_explicit_layout: true/);
  // And handed to both halves, from the same source of truth.
  assert.match(configMessage, /explicitLayout=\{Boolean\(value\.v2_explicit_layout\)\}/);
});

test("validation names a block by where it is once there are two levels", () => {
  // "Block 2" is no help when the layout nests.
  assert.match(source, /`Container \$\{index \+ 1\}`/);
  assert.match(source, /\$\{position\} needs text before this message can be saved/);
});

test("the dragged block moves with the pointer", () => {
  // The dragged row moves with the pointer, so the gesture reads as working.
  assert.match(source, /translateY\(\$\{tree\.offset\}px\)/);
  assert.match(source, /setDragOffset\(event\.clientY - dragStartYRef\.current\)/);
  // Lifted above its neighbours, and transparent to hit-testing so the drop
  // target is measured against the row underneath.
  assert.match(source, /pointer-events-none relative z-20/);
});

test("the drop target is measured, and measured against the whole message", () => {
  // Rows are measured rather than read from pointerenter, which fires only on
  // boundary crossings and gives no answer while the list reflows under the
  // cursor.
  assert.match(source, /const middle = deepest\.box\.top \+ deepest\.box\.height \/ 2/);
  assert.doesNotMatch(source, /onPointerEnter=\{\(\) => \{\s*if \(dragIndex !== null\)/);
  // Measured across every list, not only the one the drag started in: which
  // list the block lands in is part of the answer.
  assert.match(source, /querySelectorAll<HTMLElement>\("\[data-block-path\]"\)/);
  assert.doesNotMatch(source, /:scope > \[data-block-row\]/);
  // The deepest row containing the pointer wins, so hovering a container's
  // child answers "in this container, between these two".
  assert.match(source, /path\.length > deepest\.path\.length/);
});

test("the insertion line is drawn for both directions", () => {
  // The target is a row and a side, and that row draws the line (it may be in
  // another list), so dragging downward shows a target too.
  assert.match(source, /showLineBefore = aimedHere && tree\.target\?\.mode === "before"/);
  assert.match(source, /showLineAfter = aimedHere && tree\.target\?\.mode === "after"/);
});

test("a block can be moved out of a container, not only into one", () => {
  // One tree for the whole message: every move is a path resolved against it,
  // so a block can move into, out of and between containers. (Discohook's drop
  // callback takes a path, but its drag that would produce one is unfinished.)
  assert.match(source, /const BlockTreeContext = React\.createContext<BlockTreeValue \| null>/);
  assert.match(source, /tree\.setLayout\(moveBlock\(tree\.layout, from, to\)\)/);
  // The arrows step through reading order rather than through one list, which
  // is what gives the last block of a container a "down" at all.
  assert.match(source, /const to = stepPath\(tree\.layout, from, direction\)/);
  assert.match(source, /disabled=\{!canStep\(tree\.layout, here, -1\)\}/);
  assert.match(source, /disabled=\{!canStep\(tree\.layout, here, 1\)\}/);
  // A nested list is told where it begins, so its rows can name a position
  // outside it.
  assert.match(source, /path=\{path\}/);
  assert.match(source, /const pathOf = useCallback\(\(index: number\) => \[\.\.\.path, index\]/);
});

test("a drag survives the pointer leaving the handle", () => {
  // The handle is 13px and the row moves out from under it immediately, so
  // without capture the gesture dies on the first frame.
  assert.match(source, /setPointerCapture\?\.\(event\.pointerId\)/);
  // And a cancelled gesture must not leave the list stuck mid-drag.
  assert.match(source, /addEventListener\("pointercancel", commit\)/);
});

test("duplicating a block does not duplicate its custom ids", () => {
  // Discord requires custom ids to be unique within a message, and the bot only
  // deduplicates a plain `button` with no stored id. A duplicated ticket or
  // package-claim button would repeat its stored id and Discord would reject
  // the message.
  assert.match(source, /export function duplicateBlock/);
  assert.match(source, /\.filter\(\(\[key\]\) => key !== "custom_id"\)/);
  // Used by the duplicate button, rather than the raw deep copy it replaced.
  assert.match(source, /const copy = duplicateBlock\(block\);/);
  assert.doesNotMatch(source, /const copy = JSON\.parse\(JSON\.stringify\(block\)\)/);
});

test("the duplicate is still a deep copy", () => {
  // A shallow copy would give both rows the same `buttons` array, so editing
  // one would silently edit the other.
  assert.match(source, /stripIds\(JSON\.parse\(JSON\.stringify\(block\)\)\)/);
});

test("a block carries an editor identity", () => {
  // React keys, collapsed state and drag need a stable identity for a block; an
  // index changes whenever the list is reordered.
  assert.match(source, /export function newBlockId/);
  assert.match(source, /^\s*id\?: string;/m);
  // Every adder mints one, so anything created from here on has identity.
  const adders = source.slice(
    source.indexOf("const CONTAINER_ADDERS"),
    source.indexOf("const NESTABLE_ADDERS"),
  );
  const makes = adders.match(/make: \(\) => \(\{/g) || [];
  const minted = adders.match(/id: newBlockId\(\)/g) || [];
  assert.equal(minted.length, makes.length, "every adder must mint an id");
});

test("the list is keyed by identity, and legacy blocks still work", () => {
  // One helper, used by the React key and the folded set alike.
  assert.match(source, /return block\.id \?\? `at-\$\{index\}`;/);
  assert.match(source, /key=\{blockKey\(block, index\)\}/);
});

test("ids are minted where the editor writes, never where it reads", () => {
  // Minting on read hands out a new key every render, which is worse than
  // having none: React rebuilds the row under the caret each time.
  assert.match(source, /export function ensureBlockIds/);
  assert.match(configMessage, /v2_layout: ensureBlockIds\(next\)/);
  // Idempotent, because it runs on every save.
  assert.match(source, /if \(block\.id && nested === block\.blocks\) return block;/);
});

test("a duplicate gets its own identity", () => {
  // Sharing the original's id would give React two siblings with the same
  // key, and the collapsed state one entry for what reads as two blocks.
  assert.match(source, /return \{ \.\.\.copy, id: newBlockId\(\) \};/);
});

test("a block is numbered within its own kind", () => {
  // "Text 2", not "Block 5": numbered within its own kind, so reordering
  // something unrelated does not rename it.
  assert.match(source, /const sameKind = blocks\.filter\(\(other\) => other\.type === block\.type\)/);
  assert.match(source, /sameKind\.length > 1 \? sameKind\.indexOf\(block\) \+ 1 : null/);
});

test("a block says on its own header that it cannot be saved", () => {
  // Errors are shown on the block they belong to, not as one sentence at the
  // foot of the editor naming a block number.
  assert.match(source, /export function containerBlockErrors/);
  assert.match(source, /const blockErrors = containerBlockErrors\(block\);/);
  assert.match(source, /blockErrors\.length \? \(\s*<IconAlertTriangle/);
  // Readable to a screen reader, not colour alone.
  assert.match(source, /aria-label=\{blockErrors\.join\("\. "\)\}/);
});

test("an embed is named by what is in it", async () => {
  const types = await readFile(
    new URL("../src/components/Manage/types.ts", import.meta.url),
    "utf8",
  );
  // The embeds are all on the canvas now, not behind named tabs; the bar
  // over the one you are in says which of how many it is.
  const canvas = await readFile(new URL("../src/components/Manage/embed-canvas.tsx", import.meta.url), "utf8");
  assert.match(canvas, /Embed \{index \+ 1\} of \{count\}/);
  // Discord's whole-embed budget: title + description + author name + footer
  // text + every field name and value. Matches Discohook's getEmbedLength.
  assert.match(types, /export function embedCharacterCount/);
  assert.match(types, /total \+= \(field\.name \|\| ""\)\.length \+ \(field\.value \|\| ""\)\.length;/);
});

test("duplicating cannot push a message past the component limit", () => {
  // Duplicate respects the component cap like the add menu does. Over the cap
  // Discord rejects the send with a component index the author cannot see.
  assert.match(
    source,
    /disabled=\{[\s\S]{0,80}?componentCount \+ countContainerComponents\(\[block\]\) >\s*CONTAINER_LIMITS\.blocks\s*\}/,
  );
  // A container brings its children, so the cost is counted rather than
  // assumed to be one.
  assert.match(source, /countContainerComponents\(\[block\]\)/);
  // Says why, rather than just going dim.
  assert.match(source, /past Discord's \$\{CONTAINER_LIMITS\.blocks\}-component limit/);
});

test("every block type's fields live in their own component", () => {
  // One editor per block type, chosen by a registry (like Discohook's
  // AutoTopLevelComponentEditor); the row around it (fold, drag, summary,
  // errors, actions) is shared. Adding a type does not mean editing the middle
  // of the row.
  assert.match(source, /export const BLOCK_BODY_EDITORS/);
  assert.match(source, /export interface BlockBodyProps/);
  assert.match(source, /const Body = BLOCK_BODY_EDITORS\[block\.type\];/);

  // `patch` arrives bound to this block's position, so a type editor never
  // sees an index and cannot write to the wrong block.
  assert.match(source, /patch=\{\(next\) => update\(index, next\)\}/);
  assert.doesNotMatch(source, /function SeparatorBody[\s\S]{0,900}update\(index/);

  // The registry's entries, and the types the picker can actually add.
  const registry = source.slice(
    source.indexOf("export const BLOCK_BODY_EDITORS"),
    source.indexOf("};", source.indexOf("export const BLOCK_BODY_EDITORS")),
  );
  const registered = new Set(
    [...registry.matchAll(/^\s{2}(\w+): \w+Body,$/gm)].map((match) => match[1]),
  );
  const offered = [
    ...source
      .slice(
        source.indexOf("const CONTAINER_ADDERS"),
        source.indexOf("const NESTABLE_ADDERS"),
      )
      .matchAll(/^\s{4}type: "(\w+)",$/gm),
  ].map((match) => match[1]);

  assert.ok(offered.length >= 8, "the picker should still offer every block kind");
  // A type you can add is a type you can edit: adding a new kind without an
  // editor fails here.
  for (const type of offered) {
    assert.ok(registered.has(type), `${type} can be added but has no editor`);
  }
  // The placeholder block is not on the picker -- the module owns it -- but it
  // still renders in the list, so it needs an editor too.
  assert.ok(registered.has("system_button"), "system_button has no editor");

  // No block's fields render from a type test. The one allowed `block.type`
  // test is the row's unwrap control: only containers have it, so it sits
  // beside Remove rather than inside a body.
  const typeTests = [...source.matchAll(/\{block\.type === "(\w+)" \? \(/g)];
  assert.equal(
    typeTests.length,
    1,
    `expected only the container unwrap control, found: ${typeTests.map((m) => m[1]).join(", ")}`,
  );
  assert.equal(typeTests[0][1], "container");
  // And it renders a button, not fields.
  const control = source.slice(typeTests[0].index, typeTests[0].index + 900);
  assert.match(control, /aria-label="Remove the container but keep its blocks"/);

  // A limit written down twice disagrees with itself eventually.
  assert.match(source, /galleryItems: 10,/);
  assert.match(source, /rowWidth: 5,/);
  assert.match(source, /selectOptions: 25,/);
  assert.doesNotMatch(source, /urls\.length < 10/);
  assert.doesNotMatch(source, /buttons\.length < 5/);
  assert.doesNotMatch(source, /templates \|\| \[\]\)\.length < 25/);
});

test("every container editor says whether its layout is explicit", async () => {
  // `explicitLayout` is required on every editor that renders a container, so
  // forgetting it is a build error rather than a silent box. (As an optional
  // prop, four of the five editors left it out.)
  assert.match(source, /explicitLayout: boolean;/);
  assert.doesNotMatch(source, /explicitLayout\?: boolean;/);
  assert.doesNotMatch(source, /explicitLayout = false/);

  const editors = [
    "src/components/Manage/config-message.tsx",
    "src/components/Manage/sections/sessions.tsx",
    "src/components/Manage/sections/custom-commands.tsx",
    "src/components/Manage/workflow/message-value-editor.tsx",
  ];
  for (const path of editors) {
    const text = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(text, /explicitLayout=\{Boolean\(/, `${path} must read the flag`);
    // Reading it is half of it. A layout saved without setting the flag comes
    // back implicit and gets wrapped again on the next open.
    assert.match(text, /v2_explicit_layout: true/, `${path} must write the flag`);
  }
});

test("a container message never offers a content field", async () => {
  const configMessage = await readFile(
    new URL("../src/components/Manage/config-message.tsx", import.meta.url),
    "utf8",
  );
  const sessions = await readFile(
    new URL("../src/components/Manage/sections/sessions.tsx", import.meta.url),
    "utf8",
  );

  // discord.py sets the components flag from the LayoutView and puts `content`
  // in the same payload, and Discord rejects the pair (silently, since callers
  // swallow the error). So the container branch offers no content field; the
  // text above the message belongs to the embed canvas only.
  assert.match(configMessage, /<EmbedCanvas[\s\S]{0,500}onContent=\{hideContent \? undefined/);
  assert.doesNotMatch(configMessage, /label="Text" description="Sits above the embed\."/);
  assert.doesNotMatch(configMessage, /Plain text above the container/);
  assert.doesNotMatch(sessions, /Plain text above the container/);
});

/* ── The inline form builder's question types ──

   "Checkboxes" is the multi-pick question, as in every other form product and
   in this product's applications builder. The single tick
   (`discord.ui.Checkbox`) has no options. Option-based types get labelled rows
   and an "Add option" control, not a bare one-per-line textarea. */

test("the builder offers a dropdown and checkboxes, named as such", () => {
  // `multiple_choice` renders a Discord Select, which is a dropdown, so that is
  // its name.
  assert.match(source, /\{ value: "dropdown", label: "Dropdown" \}/);
  assert.match(source, /\{ value: "checkboxes", label: "Checkboxes" \}/);
  assert.doesNotMatch(
    source,
    /\{ value: "multiple_choice", label: "Multiple choice" \}/,
    "the ambiguous name is back",
  );
});

test("both map to the one type the bot renders, told apart by max_values", () => {
  // Discord has no checkbox-list component: "Checkboxes" is a Select with
  // `max_values`, which `interactive_forms` passes through. A new type would
  // store questions the bot cannot render.
  assert.match(source, /next\.question_type = "multiple_choice";/);
  assert.match(
    source,
    /uiType === "checkboxes" \? Math\.max\(next\.options\.length, 1\) : 1/,
  );
  assert.match(source, /export function|function formQuestionUiType/);
  assert.match(
    source,
    /return Number\(question\.max_values \|\| 1\) > 1 \? "checkboxes" : "dropdown"/,
  );
});

test("the yes/no tick says it has no options rather than just having none", () => {
  assert.match(source, /\{ value: "checkbox", label: "Yes \/ no tick" \}/);
  assert.match(source, /A single checkbox\. It has no options\./);
});

test("options are a list with an Add control, not one per line", () => {
  assert.match(source, /function FormOptionsEditor/);
  assert.match(source, /placeholder="Add option"/);
  assert.doesNotMatch(
    source,
    /placeholder="One option per line"/,
    "the textarea is back",
  );
  // Same interaction as the applications builder: Enter makes the next option,
  // Backspace on an empty one removes it.
  assert.match(source, /event\.key === "Enter"/);
  assert.match(source, /event\.key === "Backspace" && option === ""/);
  // And a limit that is stated rather than silently truncating.
  assert.match(source, /Discord shows at most \{limit\} choices in a menu\./);
});

test("raising the option count raises how many can be ticked", () => {
  // `max_values` follows the option count; otherwise adding a seventh option to
  // a Checkboxes question would cap it at six.
  assert.match(
    source,
    /type === "checkboxes"\s*\n?\s*\? \{ max_values: Math\.max\(next\.length, 1\) \}/,
  );
});

test("a question's help text and its placeholder are two fields", () => {
  // Help text and placeholder are two fields, because they appear in two
  // places:
  //
  //     Ban Length *
  //     How long were you banned for?     <- under the label
  //     [ Select ban duration        v ]  <- inside the control
  //
  // With one shared field, a dropdown had nowhere to put the line under its
  // label.
  assert.match(source, /placeholder="Help text under the label"/);
  assert.match(source, /Text inside the menu, e\.g\. Select ban duration/);
  assert.doesNotMatch(
    source,
    /placeholder=\{?"Placeholder or help text"/,
    "the one conflated field is back",
  );
});

test("a component with no grey text of its own is not offered a placeholder", () => {
  // A tick and a file picker have none, so the field would write a value
  // nothing reads.
  assert.match(source, /const TYPES_WITH_PLACEHOLDER = new Set\(\[/);
  assert.match(source, /\{TYPES_WITH_PLACEHOLDER\.has\(type\) \? \(/);
  const set = source.slice(
    source.indexOf("const TYPES_WITH_PLACEHOLDER"),
    source.indexOf("]);", source.indexOf("const TYPES_WITH_PLACEHOLDER")),
  );
  for (const type of ["short_text", "paragraph_text", "dropdown", "checkboxes", "role_select"]) {
    assert.ok(set.includes(`"${type}"`), `${type} has a placeholder and must offer one`);
  }
  for (const type of ["checkbox", "file_upload", "text_display"]) {
    assert.ok(!set.includes(`"${type}"`), `${type} has no placeholder of its own`);
  }
});
