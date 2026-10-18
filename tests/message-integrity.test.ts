import assert from "node:assert/strict";
import test from "node:test";
import {
  layoutFromDiscord,
  layoutToDiscord,
  messageFromDiscord,
  messageToDiscord,
} from "../src/components/Manage/discord-json.ts";
import {
  CONTAINER_LIMITS,
  containerValidationError,
  copyContainerTemplate,
  injectLegacyModuleButton,
  messageTemplateValue,
  rowButtonColor,
  type ContainerBlock,
} from "../src/components/Manage/message-design/model.ts";
import { validateProfileImage } from "../src/components/Manage/message-media.ts";

test("imported button styles share the authored color choices", () => {
  for (const [style, color] of [["green", "Green"], ["danger", "Red"], ["blurple", "Blue"], [2, "Grey"]] as const)
    assert.equal(rowButtonColor({ style }), color);
  assert.equal(rowButtonColor({ style: "red", color: "Green" }), "Green");
});

test("profile uploads accept supported images up to 8 MB and reject SVG or oversized files", () => {
  for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"])
    assert.doesNotThrow(() => validateProfileImage({ type, size: 8 * 1024 * 1024 }));
  assert.throws(() => validateProfileImage({ type: "image/svg+xml", size: 100 }), /PNG, JPEG, GIF or WebP/);
  assert.throws(() => validateProfileImage({ type: "image/png", size: 8 * 1024 * 1024 + 1 }), /over 8 MB/);
});

test("loading a container template keeps its outside text and does not edit the library", () => {
  const saved = {
    content: "Please read this first.",
    color: "green",
    layout: [{ type: "container", blocks: [{ type: "text", content: "Welcome" }] }],
  };
  const draft = copyContainerTemplate(saved);
  assert.deepEqual(draft, saved);
  draft.layout[0].blocks![0].content = "Changed in the editor";
  assert.equal(saved.layout[0].blocks[0].content, "Welcome");
});

test("older container templates clear a previous message's outside text", () => {
  assert.equal(copyContainerTemplate({ layout: [{ type: "text", content: "Hello" }] }).content, "");
});

test("message templates retain every embed when opened, edited, saved and reopened", () => {
  const saved = { message: { embeds: [{ title: "First" }, { title: "Second" }], content: "Hi" } };
  const draft = messageTemplateValue(saved);
  draft.embed.title = "Edited first";
  const reopened = messageTemplateValue({ message: draft });
  assert.deepEqual(reopened.embeds, [{ title: "Edited first" }, { title: "Second" }]);
  assert.equal(reopened.content, "Hi");
  assert.equal(saved.message.embeds[0].title, "First");
});

test("message templates retain explicit, unwrapped layouts through another save", () => {
  const layout = [{ type: "text", content: "Outside a box" }];
  const draft = messageTemplateValue({ message: {
    render_mode: "v2", v2_explicit_layout: true, v2_layout: layout, v2_color: "none",
  } });
  const reopened = messageTemplateValue({ message: draft });
  assert.equal(reopened.v2_explicit_layout, true);
  assert.deepEqual((messageToDiscord(reopened) as any).components, [{ type: 10, content: "Outside a box" }]);
});

test("legacy content-only message templates still open", () => {
  const value = messageTemplateValue({ content: "An older template" });
  assert.equal(value.content, "An older template");
  assert.equal(value.render_mode, "legacy");
  assert.equal(value.v2_explicit_layout, false);
});

test("each authored action-button color exports the same Discord style", () => {
  for (const [color, style] of [["Blue", 1], ["Grey", 2], ["Green", 3], ["Red", 4]] as const) {
    const output = layoutToDiscord([{ type: "button_row", buttons: [
      { type: "button", label: "Continue", custom_id: "continue", color },
    ] }], "none", true) as any;
    assert.equal(output.components[0].components[0].style, style, color);
  }
});

test("authored colors take precedence after editing an imported button", () => {
  const output = layoutToDiscord([{ type: "button_row", buttons: [
    { type: "button", label: "Continue", custom_id: "continue", style: "red", color: "Green" },
  ] }], "none", true) as any;
  assert.equal(output.components[0].components[0].style, 3);
});

test("static and animated custom button emojis survive Discord import and export", () => {
  for (const emoji of ["<:approved:123456789012345678>", "<a:approved:123456789012345678>"]) {
    const layout = [{ type: "button_row", buttons: [
      { type: "button", label: "Approve", custom_id: "approve", emoji },
    ] }];
    const output = layoutToDiscord(layout, "none", true) as any;
    const exportedEmoji = output.components[0].components[0].emoji;
    assert.equal(exportedEmoji.id, "123456789012345678");
    assert.equal(exportedEmoji.name, "approved");
    assert.equal(Boolean(exportedEmoji.animated), emoji.startsWith("<a:"));
    assert.equal((layoutFromDiscord(output.components)[0] as any).buttons[0].emoji, emoji);
  }
});

test("export keeps explicit layouts unwrapped and preserves legacy implicit containers", () => {
  const layout = [{ type: "text", content: "Hello" }];
  assert.equal((layoutToDiscord(layout, "green") as any).components[0].type, 17);
  assert.equal((layoutToDiscord(layout, "green", true) as any).components[0].type, 10);
  const exported = messageToDiscord({ render_mode: "v2", v2_layout: layout, v2_explicit_layout: true } as never);
  const imported = messageFromDiscord(exported) as any;
  assert.deepEqual(imported.v2_layout, layout);
  assert.equal(imported.v2_explicit_layout, true);
});

test("empty containers are rejected without rejecting a filled container", () => {
  assert.match(containerValidationError([{ type: "container", blocks: [] }])!, /at least one block/);
  assert.equal(containerValidationError([{ type: "container", blocks: [{ type: "text", content: "Hello" }] }]), null);
});

test("gallery validation accepts the limit, rejects overflow and rejects empty URLs", () => {
  const urls = Array.from({ length: CONTAINER_LIMITS.galleryItems }, (_, index) => `https://example.com/${index}.png`);
  assert.equal(containerValidationError([{ type: "media_gallery", urls }]), null);
  assert.match(containerValidationError([{ type: "media_gallery", urls: [...urls, "https://example.com/extra.png"] }])!, /image URLs/);
  assert.match(containerValidationError([{ type: "media_gallery", urls: [""] }])!, /image URLs/);
});

test("button rows enforce both ends of their allowed width", () => {
  const buttons = Array.from({ length: CONTAINER_LIMITS.rowWidth }, () => ({ type: "link", label: "Open", url: "https://example.com" }));
  assert.equal(containerValidationError([{ type: "button_row", buttons }]), null);
  assert.match(containerValidationError([{ type: "button_row", buttons: [...buttons, buttons[0]] }])!, /between 1 and 5/);
  assert.match(containerValidationError([{ type: "button_row", buttons: [] }])!, /between 1 and 5/);
});

test("dropdowns reject excess options even when nested inside a container", () => {
  const blocks: ContainerBlock[] = [{ type: "container", blocks: [{
    type: "message_dropdown", templates: Array.from({ length: CONTAINER_LIMITS.selectOptions + 1 }, (_, index) => ({ name: `Template ${index}` })),
  }] }];
  assert.match(containerValidationError(blocks)!, /more than 25 options/);
});

test("a nested feature button prevents a second legacy placeholder from being inserted", () => {
  const blocks: ContainerBlock[] = [{ type: "container", blocks: [
    { type: "text", content: "Hello" }, { type: "system_button" },
  ] }];
  assert.equal(injectLegacyModuleButton(blocks, [{ label: "Open" }], 0), blocks);
});

test("legacy button placement still appears when no placeholder exists", () => {
  const blocks: ContainerBlock[] = [{ type: "text", content: "Hello" }];
  const inserted = injectLegacyModuleButton(blocks, [{ label: "Open" }], 0, true);
  assert.deepEqual(inserted, [...blocks, { type: "system_button", inline: true }]);
  assert.equal(blocks.length, 1);
});
