import assert from "node:assert/strict";
import test from "node:test";
import { source as readSource } from "./read-source.ts";

import {
  IS_COMPONENTS_V2,
  isContainerPayload,
  layoutFromDiscord,
  layoutToDiscord,
  messageFromDiscord,
  messageToDiscord,
} from "../src/components/Manage/discord-json.ts";

/**
 * The JSON box for container messages.
 *
 * A container message stores a `v2_layout` (our own block shapes) and no
 * `content`, `embeds` or `components`, so it has to be exported as Discord's
 * Components V2 tree: numbered components under `components` with the
 * `IS_COMPONENTS_V2` flag (17 container, 10 text display, 9 section, 14
 * separator, 12 media gallery, 1 action row). That is what a webhook takes and
 * what Discohook shows.
 *
 * The block vocabulary is the one `container_runtime._render_into` renders on
 * the bot. Most tests here check the round trip: what goes out comes back as
 * the same thing.
 */

const CONTAINER_MESSAGE = {
  render_mode: "v2",
  v2_color: "blurple",
  v2_layout: [
    {
      type: "container",
      color: "blurple",
      blocks: [
        { type: "text", content: "Welcome to the server" },
        { type: "separator", divider: true, spacing: "large" },
        { type: "section", content: "Read the rules", thumbnail_url: "https://x/i.png" },
        {
          type: "text_button",
          content: "Need help?",
          button: { type: "link", label: "Support", url: "https://x/support" },
        },
        { type: "media_gallery", urls: ["https://x/a.png", "https://x/b.png"] },
        {
          type: "button_row",
          buttons: [
            { type: "link", label: "Docs", url: "https://x/docs" },
            { type: "button", label: "Claim", custom_id: "claim", style: "green" },
          ],
        },
      ],
    },
  ],
};

test("a container message no longer serialises to an empty object", () => {
  const json = messageToDiscord(CONTAINER_MESSAGE as never);
  assert.notDeepEqual(json, {}, "this is the bug: the box opened on {}");
  assert.equal(json.flags, IS_COMPONENTS_V2);
  assert.ok(Array.isArray(json.components));
});

test("containers and embeds are told apart", () => {
  assert.equal(isContainerPayload(CONTAINER_MESSAGE), true);
  assert.equal(isContainerPayload({ embeds: [{ title: "hi" }] }), false);
  assert.equal(isContainerPayload({ content: "hello" }), false);
  // A flag alone is enough, and so is a V2-only component type.
  assert.equal(isContainerPayload({ flags: IS_COMPONENTS_V2, components: [] }), true);
  assert.equal(isContainerPayload({ components: [{ type: 17, components: [] }] }), true);
  // An action row of buttons is *not* enough — an ordinary message has those.
  assert.equal(
    isContainerPayload({ components: [{ type: 1, components: [{ type: 2 }] }] }),
    false,
  );
});

test("every block kind the bot renders survives the round trip", () => {
  const json = layoutToDiscord(CONTAINER_MESSAGE.v2_layout, "blurple");
  const back = layoutFromDiscord(json.components as any[]);
  assert.deepEqual(back, CONTAINER_MESSAGE.v2_layout);
});

test("each block becomes the component type Discord expects", () => {
  const json = layoutToDiscord(CONTAINER_MESSAGE.v2_layout, "blurple");
  const container = (json.components as any[])[0];
  assert.equal(container.type, 17, "container");
  assert.equal(container.accent_color, 0x5865f2, "blurple as an integer");
  assert.deepEqual(
    container.components.map((block: any) => block.type),
    [10, 14, 9, 9, 12, 1],
    "text, separator, section, section+button, gallery, action row",
  );
  // A section's text is a nested text display, and its accessory says which
  // of the two section kinds it is.
  assert.equal(container.components[2].accessory.type, 11, "thumbnail");
  assert.equal(container.components[3].accessory.type, 2, "button");
});

test("a link button and an action button are not given each other's fields", () => {
  // Discord rejects a button carrying both `url` and `custom_id`.
  const json = layoutToDiscord(CONTAINER_MESSAGE.v2_layout, "none");
  const row = (json.components as any[])[0].components[5];
  const [link, action] = row.components;
  assert.equal(link.style, 5);
  assert.equal(link.url, "https://x/docs");
  assert.ok(!("custom_id" in link));
  assert.equal(action.style, 3, "green");
  assert.equal(action.custom_id, "claim");
  assert.ok(!("url" in action));
});

test("a pasted Discord payload becomes an editable layout", () => {
  const pasted = {
    flags: IS_COMPONENTS_V2,
    components: [
      {
        type: 17,
        accent_color: 0xed4245,
        components: [{ type: 10, content: "Pasted from a webhook" }],
      },
    ],
  };
  const message = messageFromDiscord(pasted) as Record<string, any>;
  assert.equal(message.render_mode, "v2");
  assert.equal(message.v2_color, "red", "a known colour comes back by name");
  assert.equal(message.v2_explicit_layout, true, "read as pasted, not re-wrapped");
  assert.deepEqual(message.v2_layout, [
    {
      type: "container",
      color: "red",
      blocks: [{ type: "text", content: "Pasted from a webhook" }],
    },
  ]);
  // On a V2 payload `components` *is* the layout; storing it as well would
  // send the tree twice.
  assert.equal(message.components, undefined);
});

test("an unknown accent comes back as hex rather than being lost", () => {
  const message = messageFromDiscord({
    flags: IS_COMPONENTS_V2,
    components: [{ type: 17, accent_color: 0x123456, components: [] }],
  }) as Record<string, any>;
  assert.equal(message.v2_layout[0].color, "#123456");
});

test("an embed message still round trips as an embed message", () => {
  const message = messageFromDiscord({
    content: "hello",
    embeds: [{ title: "Title", color: 0x5865f2, thumbnail: { url: "https://x/t.png" } }],
  }) as Record<string, any>;
  assert.equal(message.content, "hello");
  assert.equal(message.embed.color, "5865f2");
  assert.equal(message.embed.thumbnail, "https://x/t.png");
  assert.equal(message.v2_layout, undefined, "an embed is not a container");

  const json = messageToDiscord(message as never);
  assert.equal(json.flags, undefined, "and it must not gain the V2 flag");
  assert.ok(Array.isArray(json.embeds));
});

test("a block with no Discord component is left out of components", () => {
  // `message_dropdown` and `system_button` are resolved at send time, so they
  // are exported as valid numbered components, not as string types Discord
  // would reject.
  const layout = [
    {
      type: "container",
      color: "none",
      blocks: [
        { type: "text", content: "hi" },
        { type: "message_dropdown", templates: ["a"] },
      ],
    },
  ];
  const json = layoutToDiscord(layout, "none");
  const container = (json.components as any[])[0];
  assert.deepEqual(container.components, [{ type: 10, content: "hi" }]);
  for (const block of container.components) {
    assert.equal(typeof block.type, "number", "a string type is not Discord JSON");
  }
});

test("a placeholder does not stop the layout being wrapped", () => {
  // A layout with a module-button placeholder is still wrapped in its
  // container, not exported loose at the top level.
  const layout = [
    { type: "media_gallery", urls: ["https://x/a.png"] },
    { type: "text", content: "Describe what you need help with" },
    { type: "system_button" },
    { type: "separator", divider: true, spacing: "small" },
  ];
  const json = layoutToDiscord(layout, "none");
  const top = json.components as any[];
  assert.equal(top.length, 1, "the components came out loose instead of wrapped");
  assert.equal(top[0].type, 17, "no container");
  assert.deepEqual(
    top[0].components.map((block: any) => block.type),
    [12, 10, 14],
    "the placeholder is dropped, everything else keeps its order",
  );
});

test("copying a message between editors keeps it exactly", () => {
  // `components` must be valid Discord, so it cannot carry placeholders. The
  // editor's own layout travels beside it and is preferred on import, so
  // nothing moves.
  const message = {
    render_mode: "v2",
    v2_color: "none",
    v2_explicit_layout: true,
    v2_layout: [
      { type: "media_gallery", urls: ["https://x/a.png"] },
      { type: "text", content: "hello" },
      { type: "system_button" },
    ],
  };
  const json = messageToDiscord(message as never);
  assert.deepEqual(json.v2_layout, message.v2_layout, "the layout must travel too");

  const back = messageFromDiscord(json) as Record<string, any>;
  assert.deepEqual(back.v2_layout, message.v2_layout, "the paste changed the message");
  assert.equal(back.v2_explicit_layout, true);
});

test("a layout with no container of its own gets the implicit one", () => {
  // The editor draws an implicit wrapper; the export has to carry the accent
  // that wrapper is showing or the colour is lost on the way out.
  const json = layoutToDiscord([{ type: "text", content: "bare" }], "green");
  const container = (json.components as any[])[0];
  assert.equal(container.type, 17);
  assert.equal(container.accent_color, 0x57f287);
  assert.deepEqual(container.components, [{ type: 10, content: "bare" }]);
});

/* ── Applying, and what Apply must not keep ───────────────────────────────── */

test("applying a payload replaces the message rather than merging onto it", async () => {
  const { applyMessageShape } = await import(
    "../src/components/Manage/discord-json.ts"
  );
  // A container message, being replaced by an embed one.
  const draft = {
    name: "General Support",
    channel_id: "123",
    render_mode: "v2",
    v2_color: "blurple",
    v2_layout: [{ type: "container", color: "blurple", blocks: [] }],
    v2_explicit_layout: true,
  };
  const next = messageFromDiscord({
    content: "hello",
    embeds: [{ title: "Now an embed" }],
  }) as Record<string, any>;

  const result = applyMessageShape(draft, next) as Record<string, any>;

  // Merging replaces the old container; leaving it would keep `render_mode`
  // "v2" and the preview drawing the old blocks.
  assert.equal(result.v2_layout, undefined);
  assert.equal(result.render_mode, undefined);
  assert.equal(result.v2_color, undefined);
  assert.equal(result.v2_explicit_layout, undefined);
  assert.equal(result.content, "hello");
  assert.equal(result.embed.title, "Now an embed");

  // And everything that is not the message survives untouched.
  assert.equal(result.name, "General Support");
  assert.equal(result.channel_id, "123");
});

test("applying a container payload switches an embed message over", async () => {
  const { applyMessageShape } = await import(
    "../src/components/Manage/discord-json.ts"
  );
  const draft = { name: "Panel", content: "old", embed: { title: "old" } };
  const next = messageFromDiscord({
    flags: IS_COMPONENTS_V2,
    components: [
      { type: 17, components: [{ type: 10, content: "now a container" }] },
    ],
  }) as Record<string, any>;

  const result = applyMessageShape(draft, next) as Record<string, any>;
  assert.equal(result.embed, undefined, "the old embed has to go");
  assert.equal(result.render_mode, "v2");
  assert.equal(result.v2_layout[0].blocks[0].content, "now a container");
  assert.equal(result.name, "Panel");
});

test("the box re-derives its text from the message it is given", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../src/components/Manage/discord-json-box.tsx", import.meta.url),
      "utf8",
    ),
  );
  // The box re-syncs whenever the draft changes while it is untouched, so it
  // never shows (or applies back) a stale message.
  assert.match(source, /React\.useEffect\(\(\) => \{\s*if \(!open \|\| edited\) return;\s*setText\(current\)/);
  // Typing wins over syncing: the box never overwrites what is being typed.
  assert.match(source, /setEdited\(event\.target\.value !== current\)/);
  // And Apply is refused when there is nothing to apply, rather than silently
  // reapplying the message that is already on screen.
  assert.match(source, /disabled=\{!edited\}/);
});

/* ── Preview fidelity and the avatar variable ─────────────────────────────── */

test("the preview does not invent a container around top-level blocks", async () => {
  const source = await readSource("src/components/Manage/message-design.tsx");
  // A layout whose blocks are top-level is drawn without a box.
  assert.doesNotMatch(
    source,
    /\) : layoutHasContainers\(blocks\) \? \(/,
    "the preview is boxing blocks again when none is a container",
  );
  // Text inside a container is drawn a size smaller, as Discord does (0.875rem
  // against 1rem; Discohook's `group-data-[type='17']/parent:text-sm`): the
  // text display takes `data-size="small"` and nested blocks are drawn with
  // `inContainer`. Removing the box therefore changes what you see.
  assert.match(source, /const size = inContainer \? "small" : undefined;/);
  assert.match(source, /className="dc-text-display" data-size=\{size\}/);
  assert.match(source, /fallbackColor=\{fallbackColor\}\s*\r?\n\s*inContainer\s*\r?\n/);
  assert.doesNotMatch(
    source,
    /className="text-sm leading-relaxed text-\[#dbdee1\]"/,
    "a block is back to one fixed size regardless of where it sits",
  );
});

test("the roblox avatar previews as an image, not a hundred-character URL", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../src/components/Manage/embed-editor.tsx", import.meta.url),
      "utf8",
    ),
  );
  // The bot uploads the headshot as a guild emoji and substitutes the emoji
  // token, so the preview shows a small round avatar inside the sentence, not
  // the URL.
  assert.match(source, /"\{rbx\.avatar\}": `<preview-image:\$\{ROBLOX_HEADSHOT\}>`/);
  // The URL variables keep the URL — they are the ones that mean it.
  assert.match(source, /"\{rbx\.avatar\.url\}": ROBLOX_HEADSHOT/);
  assert.match(source, /const previewImage = token\.match\(/);
  assert.match(source, /<preview-image:\[\^>\]\+>/, "the sentinel must survive tokenising");
});

test("a block can be dragged into a container", async () => {
  const fs = await import("node:fs/promises");
  const source = await readSource("src/components/Manage/message-design.tsx");
  const resolve = await fs.readFile(
    new URL("../src/components/Manage/block-tree.ts", import.meta.url),
    "utf8",
  );
  // Dropping onto a container moves the block inside it.
  assert.match(source, /return \{ path: deepest\.path, mode: "inside" \};/);
  assert.match(source, /deepest\.type === "container"/);
  // And the gaps either side stay reorder targets, or a container swallows
  // every drop near it.
  assert.match(source, /clientY > deepest\.box\.top \+ inset && clientY < deepest\.box\.bottom - inset/);
  // Appended to that container's own blocks, resolved as a path against the
  // layout the block was already lifted out of, so the container's shifted
  // index is handled in one place.
  assert.match(
    resolve,
    /const to = \[\.\.\.shifted, \(container\.blocks \|\| \[\]\)\.length\];/,
  );
});

/* ── One JSON box on every message editor ──

   Five surfaces render the message editor: the Message Designer, module config
   cards, sessions, custom commands and the workflow node. Every one has the
   JSON box, so any message can be copied out or pasted in. This is a list, not
   a rule, so a sixth surface without the box fails here. */

const MESSAGE_EDITOR_SURFACES = [
  "src/components/Manage/message-design.tsx",
  "src/components/Manage/config-message.tsx",
  "src/components/Manage/sections/sessions.tsx",
  "src/components/Manage/sections/custom-commands.tsx",
  "src/components/Manage/workflow/message-value-editor.tsx",
];

test("every message editor offers the same JSON box", async () => {
  const fs = await import("node:fs/promises");
  for (const file of MESSAGE_EDITOR_SURFACES) {
    const text = await fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(text, /<DiscordJsonBox/, `${file} has no JSON box`);
    // Replaced, not merged: `{...draft, ...next}` would keep the old
    // `v2_layout` and `render_mode: "v2"` beside a pasted embed, and the
    // preview would not change.
    assert.match(
      text,
      /applyMessageShape\(/,
      `${file} merges a pasted message onto the old one`,
    );
  }
});

test("every surface that edits a container renders the same editor", async () => {
  // Every surface uses the shared editor, so the message underneath is always
  // the shape the JSON describes.
  const fs = await import("node:fs/promises");
  for (const file of MESSAGE_EDITOR_SURFACES.slice(1)) {
    const text = await fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
    // The block editor, or the canvas built on the same body editors and the
    // same tree functions -- either way, one vocabulary for the blocks.
    assert.match(text, /<ContainerBlocksEditor|<ContainerCanvas/, `${file} builds its own block list`);
  }
});

test("a session message is translated on both edges of the JSON box", async () => {
  // A session stores its embed flat (`author` and `footer` as strings, a
  // separate `author_icon`, a `#` colour), so the box goes through
  // `toFormEmbed`/`fromFormEmbed`. Passing the stored document straight through
  // would export no author or footer, and applying would write Discord's nested
  // shape into a document the bot reads flat.
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(
    new URL("../src/components/Manage/sections/sessions.tsx", import.meta.url),
    "utf8",
  );
  assert.match(text, /embed: current\.embed \? toFormEmbed\(current\.embed\) : undefined/);
  assert.match(text, /if \(next\.embed\) message\.embed = fromFormEmbed\(next\.embed\)/);
  // And a session renders one embed, so a paste carrying several must not
  // leave a list behind that nothing reads.
  assert.match(text, /delete message\.embeds;/);
});
