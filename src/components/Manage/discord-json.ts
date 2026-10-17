/**
 * Reads and writes Discord's own message JSON for the editor's import/export
 * box.
 *
 * Discord's shape (what Discohook emits and webhooks take) nests `thumbnail: {
 * url }`, stores `color` as an integer and always uses `embeds`; the dashboard
 * stores `thumbnail` as a string, `color` as hex digits without a hash, and
 * `embed` beside an optional `embeds`. Both shapes are read; Discord's is
 * written. What the bot stores is unchanged: this only translates at the
 * boundary.
 */

import type { CustomMessage, MessageEmbed } from "./types";

/**
 * Discord stores embed colours as a 24-bit integer; the dashboard stores the
 * hex digits without a hash. Both directions accept either form.
 */
function colorToHex(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(0xffffff, Math.trunc(value)))
      .toString(16)
      .padStart(6, "0");
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/^#/, "").trim().toLowerCase();
    if (/^[0-9a-f]{6}$/.test(cleaned)) return cleaned;
    // A decimal integer that arrived as a string.
    if (/^\d+$/.test(cleaned)) return colorToHex(Number(cleaned));
  }
  return undefined;
}

function hexToColor(value: unknown): number | undefined {
  const hex = colorToHex(value);
  return hex === undefined ? undefined : parseInt(hex, 16);
}

/** `{ url }` or a bare string — Discord uses the first, older payloads and our
 *  own storage use the second. */
function mediaUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object") {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string") return url.trim() || undefined;
  }
  return undefined;
}

function text(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

/** One embed, from either shape, into ours. */
export function embedFromDiscord(raw: unknown): MessageEmbed | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, any>;
  const embed: MessageEmbed = {};

  const title = text(source.title, 256);
  if (title) embed.title = title;
  const description = text(source.description, 4096);
  if (description) embed.description = description;
  const url = text(source.url, 2048);
  if (url && title) embed.url = url;

  const color = colorToHex(source.color ?? source.colour);
  if (color) embed.color = color;

  const thumbnail = mediaUrl(source.thumbnail);
  if (thumbnail) embed.thumbnail = thumbnail;
  const image = mediaUrl(source.image);
  if (image) embed.image = image;

  if (typeof source.timestamp === "string" && source.timestamp.trim()) {
    embed.timestamp = source.timestamp.trim();
  }

  const author = source.author;
  if (author && typeof author === "object") {
    const name = text(author.name, 256);
    if (name) {
      embed.author = { name };
      const icon = mediaUrl(author.icon_url ?? author.iconURL ?? author.icon);
      if (icon) embed.author.icon_url = icon;
      const authorUrl = text(author.url, 2048);
      if (authorUrl) embed.author.url = authorUrl;
    }
  }

  const footer = source.footer;
  if (footer && typeof footer === "object") {
    const footerText = text(footer.text, 2048);
    if (footerText) {
      embed.footer = { text: footerText };
      const icon = mediaUrl(footer.icon_url ?? footer.iconURL ?? footer.icon);
      if (icon) embed.footer.icon_url = icon;
    }
  }

  if (Array.isArray(source.fields)) {
    const fields = source.fields
      .filter((field: unknown) => field && typeof field === "object")
      .map((field: Record<string, any>) => ({
        name: String(field.name ?? "").slice(0, 256),
        value: String(field.value ?? "").slice(0, 1024),
        inline: Boolean(field.inline),
      }))
      .filter((field) => field.name && field.value)
      .slice(0, 25);
    if (fields.length) embed.fields = fields;
  }

  return Object.keys(embed).length ? embed : undefined;
}

/**
 * A whole message from either shape. Keys the dashboard does not model
 * (`attachments`, `allowed_mentions`, `flags`) are dropped, so the round trip
 * does not pretend to be lossless.
 */
export function messageFromDiscord(raw: unknown): CustomMessage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, any>;

  const embeds = Array.isArray(source.embeds)
    ? source.embeds.map(embedFromDiscord).filter(Boolean)
    : [];
  const single = embedFromDiscord(source.embed);
  if (!embeds.length && single) embeds.push(single);

  const message: CustomMessage & { embeds?: MessageEmbed[] } = {};
  if (typeof source.content === "string" && source.content.trim()) {
    message.content = source.content.slice(0, 2000);
  }
  if (embeds.length) {
    message.embed = embeds[0];
    if (embeds.length > 1) message.embeds = embeds.slice(0, 10) as MessageEmbed[];
  }
  // Our own extras, kept when the paste came from us — a round trip through
  // this box must not silently drop a container layout or a set of buttons.
  if (typeof source.render_mode === "string") message.render_mode = source.render_mode;
  if (Array.isArray(source.v2_layout)) {
    (message as any).v2_layout = source.v2_layout;
    // A pasted layout is read exactly as pasted; otherwise it would inherit the
    // legacy "no container means wrap it all" default.
    (message as any).v2_explicit_layout = true;
  }
  if (typeof source.v2_color === "string") (message as any).v2_color = source.v2_color;

  // Discord's numbered component tree (what webhooks carry). Read after
  // `v2_layout`, so a paste holding both (our own round trip) keeps ours
  // verbatim.
  if (!Array.isArray(source.v2_layout) && isContainerPayload(source)) {
    const layout = layoutFromDiscord(source.components || []);
    if (layout.length) {
      (message as any).v2_layout = layout;
      (message as any).v2_explicit_layout = true;
      message.render_mode = "v2";
      // A single container around everything is the editor's implicit shape, so
      // its accent goes on the message, where the colour control reads it.
      if (layout.length === 1 && layout[0]?.type === "container") {
        (message as any).v2_color = layout[0].color ?? "none";
      }
    }
  } else if (Array.isArray(source.components)) {
    // Only for a non-container message: on a V2 payload `components` *is* the
    // layout, and storing it here as well would send the tree twice.
    message.components = source.components;
  }

  return Object.keys(message).length ? message : null;
}

/** Our shape out to Discord's, for anyone taking the JSON elsewhere. */
export function embedToDiscord(embed: MessageEmbed): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  if (embed.title) output.title = embed.title;
  if (embed.description) output.description = embed.description;
  if (embed.url && embed.title) output.url = embed.url;
  const color = hexToColor(embed.color);
  if (color !== undefined) output.color = color;
  if (embed.thumbnail) output.thumbnail = { url: embed.thumbnail };
  if (embed.image) output.image = { url: embed.image };
  if (embed.timestamp) {
    // `"now"` is an instruction to the bot, not a value Discord understands.
    // Exported as the moment of export, which is the closest true statement.
    output.timestamp =
      embed.timestamp === "now" ? new Date().toISOString() : embed.timestamp;
  }
  if (embed.author?.name) {
    const author: Record<string, unknown> = { name: embed.author.name };
    if (embed.author.icon_url) author.icon_url = embed.author.icon_url;
    if (embed.author.url) author.url = embed.author.url;
    output.author = author;
  }
  if (embed.footer?.text) {
    const footer: Record<string, unknown> = { text: embed.footer.text };
    if (embed.footer.icon_url) footer.icon_url = embed.footer.icon_url;
    output.footer = footer;
  }
  if (embed.fields?.length) {
    output.fields = embed.fields.map((field) => ({
      name: field.name,
      value: field.value,
      inline: Boolean(field.inline),
    }));
  }
  return output;
}

export function messageToDiscord(
  message: CustomMessage & { embeds?: MessageEmbed[] },
): Record<string, unknown> {
  const source = message as Record<string, any>;

  // Container messages first: they have no `embeds` and usually no `content`,
  // so the embed path would export `{}`.
  if (isContainerPayload(source)) {
    const output: Record<string, unknown> = {
      ...layoutToDiscord(source.v2_layout || [], source.v2_color),
    };
    if (message.content) output.content = message.content;
    // The editor's own layout, alongside the Discord tree. `components` cannot
    // hold a module-button placeholder, so copying a message between editors
    // through Discord's shape alone would lose it. `messageFromDiscord` prefers
    // this key when present, so our own round trip is exact; Discord and
    // Discohook ignore unknown keys.
    output.v2_layout = source.v2_layout || [];
    output.v2_color = source.v2_color || "none";
    output.render_mode = "v2";
    if (source.v2_explicit_layout) output.v2_explicit_layout = true;
    return output;
  }

  const embeds = (
    message.embeds?.length ? message.embeds : message.embed ? [message.embed] : []
  ).map(embedToDiscord);
  const output: Record<string, unknown> = {};
  if (message.content) output.content = message.content;
  if (embeds.length) output.embeds = embeds;
  if (message.components?.length) output.components = message.components;
  return output;
}

/* ── Components V2 ──

   Containers are stored as `v2_layout` (the dashboard's own block shapes) and
   exported as Discord's numbered tree under `components` with the
   `IS_COMPONENTS_V2` flag: 17 container, 10 text display, 9 section, 14
   separator, 12 media gallery, 1 action row.

   The block vocabulary is what the bot's `container_runtime._render_into`
   renders. Unknown blocks are left untouched rather than guessed at or dropped. */

/** Discord's component type numbers, by the name we store. */
const V2_TYPE = {
  actionRow: 1,
  button: 2,
  stringSelect: 3,
  section: 9,
  textDisplay: 10,
  thumbnail: 11,
  mediaGallery: 12,
  separator: 14,
  container: 17,
} as const;

/** `flags: 1 << 15` — the bit that tells Discord to read `components` as a V2
 *  tree rather than as rows of buttons under an ordinary message. */
export const IS_COMPONENTS_V2 = 32768;

function accentInt(color: unknown): number | null {
  const text = String(color ?? "").trim().toLowerCase();
  if (!text || text === "none") return null;
  // Named colours resolve through the same table the preview uses, so the
  // exported rail is the colour that was on screen.
  const hex = V2_COLOR_HEX_FOR_JSON[text] ?? text;
  const raw = hex.replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((character) => character + character)
          .join("")
      : raw;
  return /^[0-9a-f]{6}$/.test(full) ? parseInt(full, 16) : null;
}

/**
 * The named container accents and their hex values. Defined here rather than in
 * message-design (which imports this module) to avoid an import cycle;
 * message-design re-exports it as `V2_COLOR_HEX`.
 */
export const V2_COLOR_HEX_FOR_JSON: Record<string, string> = {
  blurple: "#5865f2",
  red: "#ed4245",
  green: "#57f287",
  yellow: "#fee75c",
  blue: "#3498db",
  orange: "#e67e22",
  purple: "#9b59b6",
  pink: "#eb459e",
  white: "#ffffff",
  black: "#000000",
  dark_grey: "#607d8b",
  dark_gray: "#607d8b",
  grey: "#95a5a6",
  gray: "#95a5a6",
};

function buttonToDiscord(button: Record<string, any>): Record<string, unknown> {
  const styles: Record<string, number> = {
    blurple: 1, primary: 1,
    grey: 2, gray: 2, secondary: 2,
    green: 3, success: 3,
    red: 4, danger: 4,
  };
  const isLink = (button.type || "link") === "link";
  const output: Record<string, unknown> = {
    type: V2_TYPE.button,
    label: String(button.label ?? "").slice(0, 80) || undefined,
    // A link button carries a url and no custom_id; every other kind is the
    // reverse, and Discord rejects a button carrying both.
    style: isLink ? 5 : styles[String(button.style ?? "grey").toLowerCase()] ?? 2,
  };
  if (isLink) output.url = String(button.url || button.link || "");
  else output.custom_id = String(button.custom_id || button.command || "");
  if (button.emoji) output.emoji = { name: String(button.emoji) };
  if (button.disabled) output.disabled = true;
  return output;
}

function blockToDiscord(block: Record<string, any>): Record<string, unknown> | null {
  switch (block.type) {
    case "text":
      return { type: V2_TYPE.textDisplay, content: String(block.content ?? "") };
    case "separator":
      return {
        type: V2_TYPE.separator,
        divider: block.divider !== false,
        spacing: block.spacing === "large" ? 2 : 1,
      };
    case "section": {
      const section: Record<string, unknown> = {
        type: V2_TYPE.section,
        components: [
          { type: V2_TYPE.textDisplay, content: String(block.content ?? "") },
        ],
      };
      if (block.thumbnail_url) {
        section.accessory = {
          type: V2_TYPE.thumbnail,
          media: { url: String(block.thumbnail_url) },
        };
      }
      return section;
    }
    case "text_button":
      return {
        type: V2_TYPE.section,
        components: [
          { type: V2_TYPE.textDisplay, content: String(block.content ?? "") },
        ],
        accessory: buttonToDiscord(block.button || {}),
      };
    case "media_gallery":
      return {
        type: V2_TYPE.mediaGallery,
        items: (block.urls || [])
          .filter(Boolean)
          .map((url: unknown) => ({ media: { url: String(url) } })),
      };
    case "button_row":
      return {
        type: V2_TYPE.actionRow,
        components: (block.buttons || []).slice(0, 5).map(buttonToDiscord),
      };
    case "container":
      return {
        type: V2_TYPE.container,
        ...(accentInt(block.color) === null
          ? {}
          : { accent_color: accentInt(block.color) }),
        components: (block.blocks || [])
          .map(blockToDiscord)
          .filter(Boolean) as Record<string, unknown>[],
      };
    default:
      // `message_dropdown`, `system_button` and anything added later are
      // resolved at send time and have no Discord component, so they are left
      // out of `components` (a string `type` is not valid Discord JSON). The
      // editor's own layout is carried alongside so nothing is lost between our
      // editors.
      return null;
  }
}

function buttonFromDiscord(raw: Record<string, any>): Record<string, unknown> {
  const styles: Record<number, string> = { 1: "blurple", 2: "grey", 3: "green", 4: "red" };
  const isLink = raw.style === 5 || Boolean(raw.url);
  return {
    type: isLink ? "link" : "button",
    label: String(raw.label ?? ""),
    ...(isLink ? { url: String(raw.url ?? "") } : { custom_id: String(raw.custom_id ?? "") }),
    ...(raw.style && !isLink ? { style: styles[raw.style] ?? "grey" } : {}),
    ...(raw.emoji?.name ? { emoji: String(raw.emoji.name) } : {}),
    ...(raw.disabled ? { disabled: true } : {}),
  };
}

function blockFromDiscord(raw: Record<string, any>): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  // A block we exported as itself, pasted straight back.
  if (typeof raw.type === "string") return { ...raw };

  switch (raw.type) {
    case V2_TYPE.textDisplay:
      return { type: "text", content: String(raw.content ?? "") };
    case V2_TYPE.separator:
      return {
        type: "separator",
        divider: raw.divider !== false,
        spacing: raw.spacing === 2 ? "large" : "small",
      };
    case V2_TYPE.section: {
      const content = (raw.components || [])
        .filter((item: any) => item?.type === V2_TYPE.textDisplay)
        .map((item: any) => String(item.content ?? ""))
        .join("\n");
      const accessory = raw.accessory;
      if (accessory?.type === V2_TYPE.button) {
        return { type: "text_button", content, button: buttonFromDiscord(accessory) };
      }
      return {
        type: "section",
        content,
        thumbnail_url: String(accessory?.media?.url ?? ""),
      };
    }
    case V2_TYPE.mediaGallery:
      return {
        type: "media_gallery",
        urls: (raw.items || [])
          .map((item: any) => String(item?.media?.url ?? ""))
          .filter(Boolean),
      };
    case V2_TYPE.actionRow: {
      const buttons = (raw.components || []).filter(
        (item: any) => item?.type === V2_TYPE.button,
      );
      if (!buttons.length) return null;
      return { type: "button_row", buttons: buttons.map(buttonFromDiscord) };
    }
    case V2_TYPE.container:
      return {
        type: "container",
        color: hexFromAccent(raw.accent_color),
        blocks: (raw.components || []).map(blockFromDiscord).filter(Boolean),
      };
    default:
      return null;
  }
}

function hexFromAccent(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "none";
  const hex = Math.max(0, Math.min(0xffffff, Math.trunc(value)))
    .toString(16)
    .padStart(6, "0");
  // Back to the name when it is one we know, so a round trip through the box
  // leaves the swatch selected rather than an equivalent raw hex.
  for (const [name, candidate] of Object.entries(V2_COLOR_HEX_FOR_JSON)) {
    if (candidate.replace(/^#/, "").toLowerCase() === hex) return name;
  }
  return `#${hex}`;
}

/**
 * Every key that describes the message, as opposed to the record it sits on.
 * Applying JSON clears the ones the new payload does not define (a merge would
 * keep old keys, e.g. an embed pasted over a container would keep the
 * container's blocks and `render_mode`).
 */
export const MESSAGE_SHAPE_KEYS = [
  "content",
  "embed",
  "embeds",
  "components",
  "render_mode",
  "v2_layout",
  "v2_explicit_layout",
  "v2_color",
] as const;

/**
 * `record` with the pasted message replacing the old one, not merged.
 * Everything that is not part of the message (a name, an id, a channel, module
 * flags) is kept.
 */
export function applyMessageShape<T extends Record<string, any>>(
  record: T,
  next: Record<string, any>,
): T {
  const output: Record<string, any> = { ...record };
  for (const key of MESSAGE_SHAPE_KEYS) delete output[key];
  return { ...output, ...next } as T;
}

/** Does this payload describe a container message rather than an embed one? */
export function isContainerPayload(source: Record<string, any>): boolean {
  if (source.render_mode === "v2") return true;
  if (Array.isArray(source.v2_layout) && source.v2_layout.length) return true;
  if (Number(source.flags) & IS_COMPONENTS_V2) return true;
  // A `components` array with any V2-only type. Ordinary messages also use
  // action rows, so a row alone does not count.
  return (
    Array.isArray(source.components) &&
    source.components.some((item: any) =>
      [
        V2_TYPE.container,
        V2_TYPE.textDisplay,
        V2_TYPE.section,
        V2_TYPE.mediaGallery,
        V2_TYPE.separator,
      ].includes(item?.type),
    )
  );
}

/** A container message's `v2_layout` as Discord's numbered component tree. */
export function layoutToDiscord(
  layout: any[],
  color: string | undefined,
): Record<string, unknown> {
  const blocks = (layout || []).map(blockToDiscord).filter(Boolean);
  // Wrapped in a container unless the layout already places its own.
  const wrapped = blocks.some((block: any) => block?.type === V2_TYPE.container)
    ? blocks
    : [
        {
          type: V2_TYPE.container,
          ...(accentInt(color) === null ? {} : { accent_color: accentInt(color) }),
          components: blocks,
        },
      ];
  return { flags: IS_COMPONENTS_V2, components: wrapped };
}

/** Discord's tree back into the blocks the editor holds. */
export function layoutFromDiscord(components: any[]): any[] {
  return (components || []).map(blockFromDiscord).filter(Boolean);
}
