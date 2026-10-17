import assert from "node:assert/strict";
import test from "node:test";
import { source } from "./read-source.ts";

test("welcome and daily questions live in Community", async () => {
  const nav = await source("src/components/Manage/nav-groups.tsx");
  const community = nav.slice(nav.indexOf('title: "Community"'), nav.indexOf('title: "Integrations"'));
  const content = nav.slice(nav.indexOf('title: "Content"'));
  assert.match(community, /id: "welcome"/);
  assert.match(community, /id: "daily-questions"/);
  assert.doesNotMatch(content, /id: "welcome"/);
  assert.doesNotMatch(content, /id: "daily-questions"/);
});

test("welcome uses the shared rich message editor path", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  const welcome = schema.slice(schema.indexOf('id: "welcome"'), schema.indexOf('id: "reminders"'));
  assert.match(welcome, /configMessages:/);
  assert.match(welcome, /path: "Welcome\.message"/);
  assert.match(welcome, /components: \[\]/);
  assert.doesNotMatch(welcome, /type: "textarea"/);
  assert.doesNotMatch(welcome, /path: "Welcome\.buttons"/);
});

test("ticket module controls preview the real button or dropdown", async () => {
  const tickets = await source("src/components/Manage/sections/tickets.tsx");
  const designer = await source("src/components/Manage/message-design.tsx");
  assert.match(tickets, /kind: "select" as const/);
  assert.match(tickets, /description: subject\.description/);
  assert.match(tickets, /systemButtons=\{\s*panelControls\.length/);
  assert.match(designer, /SystemControlsPreview/);
  assert.match(designer, /control\.kind === "select"/);
  assert.doesNotMatch(tickets, /systemButtons=\{\[\{ label: "Ticket buttons" \}\]\}/);
});

test("shared messages support components, multiple embeds, and JSON", async () => {
  const editor = await source("src/components/Manage/config-message.tsx");
  const designer = await source("src/components/Manage/message-design.tsx");
  const box = await source("src/components/Manage/discord-json-box.tsx");
  assert.match(editor, /LegacyButtonRowsEditor/);
  // Every embed is on the canvas, added from the foot of the message and
  // copied from the bar over the one you are in; ten is Discord's ceiling.
  const canvas = await source("src/components/Manage/embed-canvas.tsx");
  assert.match(editor, /<EmbedCanvas\s+embeds=\{embeds\}\s+onEmbeds=\{\(next\) => writeEmbeds\(next\)\}/);
  assert.match(canvas, /const MAX_EMBEDS = 10;/);
  assert.match(canvas, /aria-label="Copy embed"/);
  assert.match(canvas, /next\.splice\(index \+ 1, 0, JSON\.parse\(JSON\.stringify\(embeds\[index\]\)\)\);/);
  // The module messages keep a second embed too: they save `embeds`.
  assert.match(designer, /embeds: draftEmbeds\.length > 1 \? draftEmbeds\.map\(\(embed\) => cleanEmbed\(embed\)\) : undefined,/);
  // The JSON box is one component used by both editors, so a message is
  // portable from either.
  assert.match(box, /<span>Message JSON<\/span>/);
  assert.match(box, /Import from Discohook, or copy it out/);
  assert.match(box, /Apply JSON/);
  assert.match(editor, /<DiscordJsonBox/);
  assert.match(designer, /<DiscordJsonBox/);
});

test("the message editors speak Discord's JSON, not our storage shape", async () => {
  const json = await source("src/components/Manage/discord-json.ts");

  // A payload from Discohook or a webhook nests its media, stores the colour as
  // an integer and always uses `embeds`; parsing it keeps the images and the
  // colour.
  assert.match(json, /export function messageFromDiscord/);
  assert.match(json, /export function messageToDiscord/);
  assert.match(json, /output\.thumbnail = \{ url: embed\.thumbnail \}/);
  assert.match(json, /parseInt\(hex, 16\)/);
  // Both media shapes are accepted on the way in.
  assert.match(json, /if \(typeof value === "string"\) return value\.trim\(\) \|\| undefined/);
});

test("Discord's markdown is reachable without knowing Discord's markdown", async () => {
  const toolbar = await source("src/components/Manage/markdown-toolbar.tsx");
  const editor = await source("src/components/Manage/config-message.tsx");
  const designer = await source("src/components/Manage/message-design.tsx");

  // The preview always rendered spoilers, subtext and headings; nothing in the
  // editor said they existed.
  assert.match(toolbar, /before: "\|\|", after: "\|\|"/);
  // Line prefixes cover every line the selection touches, and toggle off.
  assert.match(toolbar, /allPrefixed \? line\.slice\(prefix\.marker\.length\)/);
  // Clicking a button must not blur the field it is about to format.
  assert.match(toolbar, /onMouseDown=\{\(event\) => \{[\s\S]{0,80}event\.preventDefault\(\)/);
  // Both editors reach it through the one bar over the editor.
  const chrome = await source("src/components/Manage/message-chrome.tsx");
  assert.match(chrome, /<MarkdownToolbar containerRef=\{containerRef\}/);
  assert.match(editor, /<MessageEditorBar/);
  assert.match(designer, /<MessageEditorBar/);
});

test("an embed editor states Discord's limits instead of discovering them", async () => {
  const types = await source("src/components/Manage/types.ts");
  const embed = await source("src/components/Manage/embed-editor.tsx");

  // Discord's embed limits, enforced in the editor: per field and the
  // 6000-character whole-embed budget, so an over-long embed is caught before
  // the send fails.
  assert.match(types, /export const EMBED_LIMITS/);
  assert.match(types, /total: 6000/);
  assert.match(types, /export function embedCharacterCount/);
  assert.match(embed, /<CharacterCount/);
  assert.match(embed, /EMBED_LIMITS\.total/);
  // Quiet until it matters.
  assert.match(embed, /if \(used < limit \* 0\.6\) return null/);

  // Parts Discord supports that the form could not reach.
  assert.match(embed, /label="Title link"/);
  assert.match(embed, /label="Author link"/);
  assert.match(embed, /<TimestampField/);
  // And fields can be reordered and duplicated rather than retyped.
  assert.match(embed, /const moveField =/);
  assert.match(embed, /aria-label=\{`Duplicate field \$\{index \+ 1\}`\}/);
});

test("punishments and richer game log settings are exposed", async () => {
  const schema = await source("src/components/Manage/schema.ts");
  assert.match(schema, /id: "punishments"/);
  assert.match(schema, /Punishments\.auto_log_commands/);
  assert.match(schema, /Punishments\.rejoin_enforcement/);
  assert.match(schema, /Punishments\.roleplay_language/);
  assert.match(schema, /Game Logs\.leave_channel_id/);
  assert.match(schema, /Game Logs\.hide_private_messages/);
});

test("workflows use the existing canvas through the managed dashboard", async () => {
  const shell = await source("src/components/Manage/manage-shell.tsx");
  const nav = await source("src/components/Manage/nav-groups.tsx");
  const workspace = await source("src/components/Manage/workflow/workflow-workspace.tsx");
  assert.match(nav, /id: "workflows"/);
  assert.match(shell, /case "workflows"/);
  assert.match(workspace, /<WorkflowCanvas/);
  assert.match(workspace, /<WorkflowShell/);
  const api = await source("src/app/api/manage/[id]/automations/route.ts");
  assert.match(api, /withAuth/);
});
