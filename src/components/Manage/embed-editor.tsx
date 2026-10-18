"use client";

import React from "react";
import "./discord-surface.css";
import { DiscordFrame } from "./discord-message";
import { DevelopingImage, PresenceList, useListKeys } from "@/components/motion";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconExternalLink,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import {
  ColorPicker,
  FieldRow,
  SelectField,
  TextAreaField,
  TextField,
  OptionCard,
} from "./fields";
import {
  EMBED_LIMITS,
  embedCharacterCount,
  type CustomMessage,
  type EmbedField,
  type MessageEmbed,
} from "./types";
import { describeVariable, groupVariables } from "@/config/variable-registry";
import { rowButtonColor } from "./message-design/model";

/**
 * Shared Discohook-style embed editing: a Discord-accurate live preview and the
 * embed form, used by the Message Designer and the Custom Command builder so
 * both write the embed shape the bot serialises.
 */

/** The headshot the preview uses as a stand-in, defined once. */
const ROBLOX_HEADSHOT =
  "https://www.roblox.com/headshot-thumbnail/image?userId=1&width=150&height=150&format=png";

export const PREVIEW_SUBSTITUTIONS: Record<string, string> = {
  "{staff.mention}": "@Sam",
  "{staff.name}": "Sam",
  "{author.name}": "Alex",
  "{author.mention}": "@Alex",
  "{user.mention}": "@Alex",
  "{user.name}": "Alex",
  "{action}": "Warning",
  "{reason}": "Being unprofessional on duty",
  "{notes}": "First offence",
  "{case}": "42",
  "{newrank}": "@Sergeant",
  "{newrank.name}": "Sergeant",
  // Preview samples for the rank variables.
  "{oldrank}": "@Corporal",
  "{oldrank.name}": "Corporal",
  "{previousrank}": "@Corporal",
  "{previousrank.name}": "Corporal",
  "{rating}": "★★★★★",
  "{feedback}": "Super helpful during the session!",
  "{suggestion}": "Add a weekly community game night.",
  "{end_time}": "in 7 days",
  "{expiration}": "in 30 days",
  "{guild.name}": "Your Server",
  "{server.name}": "Your Server",
  "{manager.display_name}": "Jordan",
  "{rbx.avatar.url}": ROBLOX_HEADSHOT,
  "{rbx.avatar_url}": ROBLOX_HEADSHOT,
  "{rbx_avatar_url}": ROBLOX_HEADSHOT,
  "{roblox_avatar_url}": ROBLOX_HEADSHOT,
  // The avatar emoji, not the URL (`{rbx.avatar.url}` is the URL). The bot
  // uploads the headshot as a guild emoji and substitutes its token, so the
  // preview renders it inline at emoji size with `<preview-image:…>`.
  "{rbx.avatar}": `<preview-image:${ROBLOX_HEADSHOT}>`,
  "{rbx_avatar}": `<preview-image:${ROBLOX_HEADSHOT}>`,
  "{roblox_avatar}": `<preview-image:${ROBLOX_HEADSHOT}>`,
  "{rbx.avatar_emoji}": `<preview-image:${ROBLOX_HEADSHOT}>`,
  "{staff.rbx.avatar}": `<preview-image:${ROBLOX_HEADSHOT}>`,
  "{staff.avatar}": `<preview-image:${ROBLOX_HEADSHOT}>`,
};

let ACTIVE_OVERRIDES: Record<string, string> = {};

/** Scope preview substitutions (e.g. a positive reason for promotions). */
export function setPreviewOverrides(overrides: Record<string, string>) {
  ACTIVE_OVERRIDES = overrides || {};
}

export function substitute(text: string | undefined): string {
  if (!text) return "";
  let output = text;
  const table = { ...PREVIEW_SUBSTITUTIONS, ...ACTIVE_OVERRIDES };
  for (const [token, replacement] of Object.entries(table)) {
    output = output.split(token).join(replacement);
  }
  // Variables without a sample here use the example the variable list shows.
  return output.replace(/\{([\w.]+)\}/g, (token, key: string) => describeVariable(key).example ?? token);
}

/** Render a Discord `<t:unix:style>` timestamp the way the client would. */
function formatTimestamp(unix: number, style: string): string {
  const date = new Date(unix * 1000);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  const opts: Record<string, Intl.DateTimeFormatOptions> = {
    t: { hour: "numeric", minute: "2-digit" },
    T: { hour: "numeric", minute: "2-digit", second: "2-digit" },
    d: { month: "2-digit", day: "2-digit", year: "numeric" },
    D: { month: "long", day: "numeric", year: "numeric" },
    f: { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
    F: { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
  };
  if (style === "R") {
    const seconds = Math.round(unix - Date.now() / 1000);
    const abs = Math.abs(seconds);
    const units: [number, Intl.RelativeTimeFormatUnit][] = [
      [31536000, "year"],
      [2592000, "month"],
      [86400, "day"],
      [3600, "hour"],
      [60, "minute"],
      [1, "second"],
    ];
    const [size, unit] = units.find(([s]) => abs >= s) || units[units.length - 1];
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      Math.trunc(seconds / size),
      unit
    );
  }
  return new Intl.DateTimeFormat(undefined, opts[style] || opts.f).format(date);
}

/** Inline markdown: bold, italic, underline, strike, code, links, mentions,
 *  timestamps, and custom Discord emojis (`<:name:id>` / `<a:name:id>`). */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const tokens = text.split(
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|<preview-image:[^>]+>|<a?:\w+:\d+>|<t:\d+(?::[tTdDfFR])?>|<@&?!?\d+>|<#\d+>|@\w+)/g
  );
  return tokens.map((token, index) => {
    const key = `${keyBase}-${index}`;
    if (!token) return null;
    // A preview-only stand-in for an emoji the bot uploads at send time —
    // a Roblox headshot, which has no id to fetch from Discord's CDN.
    const previewImage = token.match(/^<preview-image:(.+)>$/);
    if (previewImage)
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={previewImage[1]}
          alt=""
          className="dc-md-avatar"
        />
      );
    const emoji = token.match(/^<(a?):(\w+):(\d+)>$/);
    if (emoji)
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={`https://cdn.discordapp.com/emojis/${emoji[3]}.${emoji[1] ? "gif" : "png"}?size=44`}
          alt={`:${emoji[2]}:`}
          title={`:${emoji[2]}:`}
          className="dc-md-emoji"
        />
      );
    if (token.startsWith("**") && token.endsWith("**"))
      return <strong key={key} className="dc-md-strong">{renderInline(token.slice(2, -2), key)}</strong>;
    if (token.startsWith("__") && token.endsWith("__"))
      return <u key={key}>{renderInline(token.slice(2, -2), key)}</u>;
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_")))
      return <em key={key}>{renderInline(token.slice(1, -1), key)}</em>;
    if (token.startsWith("~~") && token.endsWith("~~"))
      return <s key={key}>{renderInline(token.slice(2, -2), key)}</s>;
    if (token.startsWith("`") && token.endsWith("`"))
      return <code key={key} className="dc-md-code">{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return <span key={key} className="dc-md-link">{link[1]}</span>;
    const timestamp = token.match(/^<t:(\d+)(?::([tTdDfFR]))?>$/);
    if (timestamp)
      return (
        <span key={key} className="dc-md-stamp">
          {formatTimestamp(Number(timestamp[1]), timestamp[2] || "f")}
        </span>
      );
    if (/^<@&?!?\d+>$/.test(token) || /^@\w+$/.test(token))
      return <span key={key} className="dc-md-mention">{token.startsWith("<") ? "@role" : token}</span>;
    if (/^<#\d+>$/.test(token))
      return <span key={key} className="dc-md-mention">#channel</span>;
    return <React.Fragment key={key}>{token}</React.Fragment>;
  });
}

/** Discord-flavoured markdown renderer for previews: headings, quotes,
 *  lists, code blocks, small text, and all inline styles. */
export function PreviewText({ text }: { text: string }) {
  const source = substitute(text);
  const blocks = source.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {blocks.map((block, blockIndex) => {
        if (block.startsWith("```") && block.endsWith("```")) {
          const code = block.slice(3, -3).replace(/^[a-z]*\n/, "");
          return (
            <pre key={blockIndex} className="dc-md-pre">
              {code}
            </pre>
          );
        }
        return block.split("\n").map((line, lineIndex) => {
          const key = `${blockIndex}-${lineIndex}`;
          const heading = line.match(/^(#{1,3})\s+(.*)$/);
          if (heading) {
            return (
              <span key={key} className={`dc-md-h${heading[1].length}`}>
                {renderInline(heading[2], key)}
              </span>
            );
          }
          if (line.startsWith("-# "))
            return (
              <span key={key} className="dc-md-sub">
                {renderInline(line.slice(3), key)}
              </span>
            );
          if (line.startsWith("> "))
            return (
              <span key={key} className="dc-md-quote">
                {renderInline(line.slice(2), key)}
              </span>
            );
          const bullet = line.match(/^\s*[-*]\s+(.*)$/);
          if (bullet)
            return (
              <span key={key} className="dc-md-li">
                {renderInline(bullet[1], key)}
              </span>
            );
          const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
          if (numbered)
            return (
              <span key={key} className="dc-md-oli">
                {numbered[1]}. {renderInline(numbered[2], key)}
              </span>
            );
          if (line === "") return <span key={key} className="dc-md-gap" />;
          return (
            <span key={key} className="dc-md-p">
              {renderInline(line, key)}
            </span>
          );
        });
      })}
    </>
  );
}

/** Inline-only markdown for short strings such as button labels. */
export function PreviewInline({ text }: { text: string }) {
  return <>{renderInline(substitute(text || ""), "inline")}</>;
}

/** Resolve a media field to a URL the preview can actually render:
 *  substitutes preview variables, trims, and validates http(s). */
export function renderableImageUrl(value: string | undefined): string | null {
  const resolved = substitute((value || "").trim());
  if (/^https?:\/\/\S+$/.test(resolved)) return resolved;
  return null;
}

/** An image that degrades to a neutral placeholder while the URL is being
 *  typed or when it fails to load, instead of a broken-image glyph. */
export function PreviewImage({
  src,
  className,
  placeholderClassName,
  label = "image",
}: {
  src: string | undefined;
  className: string;
  placeholderClassName: string;
  label?: string;
}) {
  const url = renderableImageUrl(src);
  const [failedAttempt, setFailedAttempt] = React.useState<"direct" | "proxy" | null>(null);
  React.useEffect(() => setFailedAttempt(null), [url]);
  const imageUrl =
    url && failedAttempt === "direct"
      ? `/api/image-preview?url=${encodeURIComponent(url)}`
      : url;
  if (!imageUrl || failedAttempt === "proxy") {
    return (
      <span
        className={`dc-img-token ${placeholderClassName}`}
      >
        {label}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <DevelopingImage
      key={imageUrl}
      src={imageUrl}
      alt=""
      className={className}
      loading="lazy"
      // Discord's CDN (cdn/media.discordapp.net) 403s hotlinked images when a
      // referrer is sent, which showed the placeholder instead of the image.
      referrerPolicy="no-referrer"
      onError={() => setFailedAttempt(failedAttempt === "direct" ? "proxy" : "direct")}
    />
  );
}

/**
 * Inserts a variable token into the input or textarea in `container` that was
 * focused last (or the first text field), at the caret. Used by the variable
 * chips.
 */
export function insertVariable(container: HTMLElement | null, token: string) {
  if (!container) return;
  const stored = (container as any).__lastFocused as
    | HTMLInputElement
    | HTMLTextAreaElement
    | undefined;
  const target =
    stored && container.contains(stored)
      ? stored
      : container.querySelector<HTMLTextAreaElement | HTMLInputElement>(
          "textarea, input[type='text']"
        );
  if (!target) return;
  const setter = Object.getOwnPropertyDescriptor(
    target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    "value"
  )?.set;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const next = target.value.slice(0, start) + token + target.value.slice(end);
  setter?.call(target, next);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.focus();
  const caret = start + token.length;
  try {
    target.setSelectionRange(caret, caret);
  } catch {}
}

/** Track the last-focused text field inside a container (for insertVariable). */
export function trackFocus(container: HTMLElement | null) {
  if (!container || (container as any).__focusTracked) return;
  (container as any).__focusTracked = true;
  container.addEventListener("focusin", (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      (container as any).__lastFocused = target;
    }
  });
}

/** A row of clickable variable chips that insert into the active field. */
export function VariableChips({
  variables,
  containerRef,
}: {
  variables: string[];
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const term = query.trim().toLowerCase();
  const groups = React.useMemo(() => {
    const sections = groupVariables(variables);
    if (!term) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.key.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [variables, term]);

  if (!variables.length) return null;

  return (
    <div className="gw-md-vars">
      <div className="gw-md-vars-find">
        <IconSearch size={14} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a variable"
          aria-label="Find a variable"
          // Set into the panel's edge: the panel shows focus, not a ring
          // drawn inside it.
          data-bare
        />
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="gw-md-vars-more"
        >
          {expanded ? "Show less" : "Show all"}
        </button>
      </div>
      <p className="gw-md-vars-say">Click one to add it where you&apos;re typing.</p>
      <div
        // overscroll-contain: without it, reaching either end of this list
        // hands the wheel to the page, which scrolls the editor away under you.
        className="gw-md-vars-list"
        data-expanded={expanded ? "true" : undefined}
      >
        {groups.length === 0 ? (
          <p className="gw-md-vars-none">Nothing called that.</p>
        ) : (
          groups.map((section) => (
            <div key={section.group}>
              {/* The group heading once, with its scope only where it adds
                 information. */}
              <p className="gw-md-vars-group">
                {section.group}
                {section.scope !== "global" &&
                section.group.toLowerCase() !== section.scope ? (
                  <span
                    className="gw-md-vars-scope"
                    title={
                      section.scope === "shared"
                        ? "Provided by more than one feature"
                        : "Only works in this message"
                    }
                  >
                    {section.scope === "shared" ? "Shared" : "Only here"}
                  </span>
                ) : null}
              </p>
              {/* One row per variable with its description visible (hover does
                 not exist on a phone). */}
              <div className="gw-md-vars-rows">
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => insertVariable(containerRef.current, item.key)}
                    className="gw-md-var"
                  >
                    <span className="gw-md-var-key">
                      {item.key}
                    </span>
                    {/* What it turns into, where knowable; otherwise the
                       description (an invented example would read as a promise
                       about format). */}
                    {item.example ? (
                      <span className="gw-md-var-say">→ {item.example}</span>
                    ) : item.description ? (
                      <span className="gw-md-var-say">{item.description}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function isImageToken(value?: string): boolean {
  return Boolean(value && value.startsWith("{"));
}

export function DiscordPreview({
  message,
  buttons,
}: {
  message: CustomMessage;
  /** Kept for callers that still pass it; the frame signs the message with
   *  the bot's own name in this server now. */
  botName?: string;
  /** Optional Discord controls rendered under the message. */
  buttons?: { label?: string; url?: string; emoji?: string; color?: string; style?: string; disabled?: boolean; row?: number; type?: string; options?: { label?: string; description?: string; emoji?: string }[]; placeholder?: string }[];
}) {
  const embed = message.embed || {};
  const hasEmbed = Object.keys(embed).some((key) => {
    const value = (embed as Record<string, unknown>)[key];
    return value != null && value !== "" && !(Array.isArray(value) && !value.length);
  });
  const color =
    typeof embed.color === "string" && embed.color ? `#${embed.color.replace(/^#/, "")}` : undefined;
  const fields = embed.fields || [];
  const span = (index: number) => {
    if (!fields[index]?.inline) return 12;
    let start = index;
    while (start > 0 && fields[start - 1].inline) start -= 1;
    let end = index;
    while (end + 1 < fields.length && fields[end + 1].inline) end += 1;
    const rowStart = start + Math.floor((index - start) / 3) * 3;
    return 12 / Math.min(3, end - rowStart + 1);
  };
  return (
    <DiscordFrame>
      {message.content ? (
        <div className="dc-content">
          <PreviewText text={message.content} />
        </div>
      ) : null}
      {hasEmbed ? (
        <div className="dc-embed" style={{ ["--embed-accent" as string]: color }}>
          <div className="dc-embed-grid">
            <div className="dc-embed-main">
              {embed.author?.name ? (
                <div className="dc-embed-author">
                  {embed.author.icon_url && !isImageToken(embed.author.icon_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={embed.author.icon_url} alt="" className="dc-embed-author-icon" referrerPolicy="no-referrer" />
                  ) : embed.author.icon_url ? (
                    <span className="dc-embed-author-icon dc-img-token" />
                  ) : null}
                  <span>{substitute(embed.author.name)}</span>
                </div>
              ) : null}
              {embed.title ? (
                <div className="dc-embed-title" data-link={embed.url ? "true" : undefined}>
                  <PreviewText text={embed.title} />
                </div>
              ) : null}
              {embed.description ? (
                <div className="dc-embed-description">
                  <PreviewText text={embed.description} />
                </div>
              ) : null}
              {fields.length ? (
                <div className="dc-embed-fields">
                  {fields.map((field, index) => (
                    <div key={index} className="dc-embed-field" style={{ gridColumn: `span ${span(index)}` }}>
                      <div className="dc-embed-field-name">
                        <PreviewText text={field.name} />
                      </div>
                      <div className="dc-embed-field-value">
                        <PreviewText text={field.value} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {embed.image ? (
                <PreviewImage
                  src={embed.image}
                  className="dc-embed-image"
                  placeholderClassName="dc-embed-image dc-img-token"
                  label={embed.image.startsWith("{") ? embed.image : "image"}
                />
              ) : null}
              {/* Footer and timestamp on one line, a bullet between them, and
                  either alone when only one is set -- as Discord draws it. */}
              {embed.footer?.text || embed.timestamp ? (
                <div className="dc-embed-footer">
                  {embed.footer?.icon_url && !isImageToken(embed.footer.icon_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={embed.footer.icon_url} alt="" className="dc-embed-footer-icon" referrerPolicy="no-referrer" />
                  ) : null}
                  {embed.footer?.text ? <span>{substitute(embed.footer.text)}</span> : null}
                  {embed.footer?.text && embed.timestamp ? <span className="dc-embed-dot">•</span> : null}
                  {embed.timestamp ? <span>{previewTimestamp(embed.timestamp)}</span> : null}
                </div>
              ) : null}
            </div>
            {embed.thumbnail ? (
              <PreviewImage
                src={embed.thumbnail}
                className="dc-embed-thumb"
                placeholderClassName="dc-embed-thumb dc-img-token"
                label={embed.thumbnail.startsWith("{") ? embed.thumbnail : "image"}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {buttons && buttons.length > 0 ? <DiscordComponentPreview components={buttons} /> : null}
    </DiscordFrame>
  );
}

/** Discord's button colour for a stored button, on the surface's classes. */
function previewButtonStyle(button: { color?: string; style?: string; url?: string }) {
  const style = rowButtonColor(button);
  if (button.url || button.style === "Link") return "secondary";
  if (style === "Green") return "success";
  if (style === "Red") return "danger";
  if (style === "Blue") return "primary";
  return "secondary";
}

export function DiscordComponentPreview({ components }: { components: any[] }) {
  const [open, setOpen] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<Record<number, number>>({});
  const [notice, setNotice] = React.useState("");
  const rows = Array.from(new Set(components.map((item) => Number(item?.row) || 0))).sort();
  return (
    <div className="dc-blocks dc-controls-rows">
      {rows.map((row) => (
        <div key={row} className="dc-action-row dc-controls">
          {components.filter((item) => (Number(item?.row) || 0) === row).map((button) => {
            const absoluteIndex = components.indexOf(button);
            const isSelect = ["select", "dropdown", "message_dropdown"].includes(String(button.type || "").toLowerCase());
            if (isSelect) {
              return (
                <div key={absoluteIndex} className="dc-select-wrap">
                  <button type="button" disabled={button.disabled} onClick={() => setOpen(open === absoluteIndex ? null : absoluteIndex)} className="dc-select" aria-expanded={open === absoluteIndex}>
                    <span>{selected[absoluteIndex] != null ? button.options?.[selected[absoluteIndex]]?.label : button.placeholder || button.label || "Make a selection"}</span>
                    <IconChevronDown size={16} className="dc-select-caret" data-open={open === absoluteIndex ? "true" : undefined} />
                  </button>
                  {open === absoluteIndex ? (
                    <div className="dc-select-menu">
                      {(button.options || []).map((option: any, optionIndex: number) => (
                        <button key={optionIndex} type="button" onClick={() => { setSelected({ ...selected, [absoluteIndex]: optionIndex }); setOpen(null); }} className="dc-select-opt">
                          {option.emoji ? <span>{option.emoji}</span> : null}
                          <span className="dc-select-opt-say">
                            <span className="dc-select-opt-label">{option.label || "Option"}</span>
                            {option.description ? <span className="dc-select-opt-note">{option.description}</span> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }
            return (
              <button key={absoluteIndex} type="button" disabled={button.disabled} onClick={() => { setNotice(button.label || "Button"); window.setTimeout(() => setNotice(""), 1400); }} className="dc-btn" data-style={previewButtonStyle(button)}>
                {button.emoji ? <PreviewInline text={button.emoji} /> : null}
                <PreviewInline text={button.label || "Button"} />
                {button.url ? <IconExternalLink size={14} className="dc-btn-out" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ))}
      {notice ? <p className="dc-note">“{notice}” previewed. Nothing was sent.</p> : null}
    </div>
  );
}

/**
 * The footer timestamp as Discord writes it. `"now"` is stored for "the moment
 * the message is sent", so a resent template is not stamped with the day it was
 * written; the preview shows today.
 */
export function previewTimestamp(value: string): string {
  if (value === "now") return "Today at " + new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today at ${time}` : `${date.toLocaleDateString()} ${time}`;
}

/** Drop empty embed parts so the stored document matches the bot's shape. */
export function cleanEmbed(embed: MessageEmbed): MessageEmbed | undefined {
  const output: MessageEmbed = {};
  if (embed.title?.trim()) output.title = embed.title;
  if (embed.description?.trim()) output.description = embed.description;
  if (typeof embed.color === "string" && embed.color.trim())
    output.color = embed.color.replace(/^#/, "").toLowerCase();
  if (embed.thumbnail?.trim()) output.thumbnail = embed.thumbnail.trim();
  if (embed.image?.trim()) output.image = embed.image.trim();
  // A title link without a title is dropped: Discord ignores `url` without
  // `title`.
  if (embed.url?.trim() && embed.title?.trim()) output.url = embed.url.trim();
  if (embed.timestamp?.trim()) output.timestamp = embed.timestamp.trim();
  if (embed.author?.name?.trim()) {
    output.author = { name: embed.author.name };
    if (embed.author.icon_url?.trim())
      output.author.icon_url = embed.author.icon_url.trim();
    if (embed.author.url?.trim()) output.author.url = embed.author.url.trim();
  }
  if (embed.footer?.text?.trim()) {
    output.footer = { text: embed.footer.text };
    if (embed.footer.icon_url?.trim())
      output.footer.icon_url = embed.footer.icon_url.trim();
  }
  const fields = (embed.fields || []).filter(
    (field) => field.name?.trim() && field.value?.trim()
  );
  if (fields.length) output.fields = fields;

  // Colour, timestamp and title link only style an embed; on their own they are
  // no embed. (The colour picker has a default, so an untouched embed would
  // otherwise be kept with just a `color`, and the bot would send an
  // empty-embed error.)
  const hasBody = Boolean(
    output.title ||
      output.description ||
      output.author ||
      output.fields ||
      output.image ||
      output.thumbnail ||
      output.footer,
  );
  return hasBody ? output : undefined;
}

/**
 * How close a value is to Discord's limit: quiet below 60%, amber near the
 * limit, red over it.
 */
/** Exported because the container editor counts the same way. */
export function CharacterCount({ value, limit }: { value: string | undefined; limit: number }) {
  const used = (value || "").length;
  if (used < limit * 0.6) return null;
  const over = used > limit;
  return (
    <span
      className={`text-[11px] font-semibold tabular-nums ${
        over ? "text-[var(--tone-bad)]" : used > limit * 0.9 ? "text-[var(--tone-warn)]" : "text-white/35"
      }`}
    >
      {used}/{limit}
    </span>
  );
}

/**
 * One collapsible part of an embed, grouped as Discohook does. A section with
 * content opens by default and says so in its header, so the embed's shape is
 * readable while collapsed.
 */
function EmbedSection({
  title,
  summary,
  filled,
  children,
}: {
  title: string;
  summary?: string;
  filled: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(filled);
  return (
    <div className="gw-md-part" data-open={open ? "true" : "false"}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="gw-md-part-head"
      >
        <span className="gw-md-part-name">{title}</span>
        {summary ? (
          <span className="gw-md-part-say">{summary}</span>
        ) : (
          <span className="flex-1" />
        )}
        <IconChevronRight size={15} className="gw-md-part-chev" aria-hidden="true" />
      </button>
      {/* Same unfold as every group on the dashboard: the height opens, and
          the fields ride in a beat behind it. */}
      <div className="gw-md-part-roll">
        <div className="gw-md-part-clip" inert={!open}>
          <div className="gw-md-part-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* The embed's parts as one list of rows, each opening in place. */
function EmbedParts({
  title = "Embed",
  count,
  action,
  list = true,
  children,
}: {
  title?: string;
  count?: React.ReactNode;
  action?: React.ReactNode;
  list?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="gw-md-embed">
      <div className="gw-md-embed-head">
        <span className="gw-md-embed-name">{title}</span>
        {count}
        {action ? <span className="gw-md-embed-act">{action}</span> : null}
      </div>
      <div className={list ? "gw-md-parts" : "gw-md-fields"}>{children}</div>
    </div>
  );
}

export function EmbedForm({
  embed,
  onChange,
  insertMenu,
}: {
  embed: MessageEmbed;
  onChange: (patch: Partial<MessageEmbed>) => void;
  insertMenu?: React.ReactNode;
}) {
  const fields: EmbedField[] = embed.fields || [];
  const fieldKeys = useListKeys(fields);
  const total = embedCharacterCount(embed);

  const writeFields = (next: EmbedField[]) => onChange({ fields: next });
  const moveField = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    writeFields(next);
  };

  return (
    <>
      <EmbedParts
        count={
          // The whole-embed budget, the one limit no single field shows.
          total > EMBED_LIMITS.total * 0.6 ? (
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                total > EMBED_LIMITS.total
                  ? "text-[var(--tone-bad)]"
                  : total > EMBED_LIMITS.total * 0.9
                    ? "text-[var(--tone-warn)]"
                    : "text-white/40"
              }`}
            >
              {total}/{EMBED_LIMITS.total} characters
            </span>
          ) : undefined
        }
      >
        <EmbedSection
          title="Author"
          summary={embed.author?.name || "The small line above the title"}
          filled={Boolean(embed.author?.name)}
        >
          <FieldRow label="Author name" trailing={<CharacterCount value={embed.author?.name} limit={EMBED_LIMITS.author} />}>
            <TextField
              value={embed.author?.name || ""}
              onChange={(next) =>
                onChange({ author: { ...(embed.author || {}), name: next } })
              }
            />
          </FieldRow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow label="Author icon URL">
              <TextField
                value={embed.author?.icon_url || ""}
                placeholder="https://… or {staff.avatar}"
                onChange={(next) =>
                  onChange({ author: { ...(embed.author || {}), icon_url: next } })
                }
              />
            </FieldRow>
            <FieldRow
              label="Author link"
              /* Makes the author name a link in Discord. */
            >
              <TextField
                value={embed.author?.url || ""}
                placeholder="https://…"
                onChange={(next) =>
                  onChange({ author: { ...(embed.author || {}), url: next } })
                }
              />
            </FieldRow>
          </div>
        </EmbedSection>

        <EmbedSection
          title="Body"
          summary={embed.title || embed.description || "Title, description, and colour"}
          filled={Boolean(embed.title || embed.description)}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow label="Title" trailing={<CharacterCount value={embed.title} limit={EMBED_LIMITS.title} />}>
              <TextField
                value={embed.title || ""}
                onChange={(next) => onChange({ title: next })}
              />
            </FieldRow>
            <FieldRow
              label="Title link"
              hint={embed.url && !embed.title ? "A link needs a title to sit on." : undefined}
            >
              <TextField
                value={embed.url || ""}
                placeholder="https://…"
                onChange={(next) => onChange({ url: next })}
              />
            </FieldRow>
          </div>
          <FieldRow label="Description" trailing={<CharacterCount value={embed.description} limit={EMBED_LIMITS.description} />}>
            <TextAreaField
              rows={5}
              value={embed.description || ""}
              trailing={insertMenu}
              onChange={(next) => onChange({ description: next })}
            />
          </FieldRow>
          <FieldRow label="Color">
            <ColorPicker
              value={`#${String(embed.color || "2b2d31").replace(/^#/, "")}`}
              label="Choose embed color"
              onChange={(next) => onChange({ color: next.slice(1) })}
            />
          </FieldRow>
        </EmbedSection>

        <EmbedSection
          title="Images"
          summary="Thumbnail and the large image"
          filled={Boolean(embed.thumbnail || embed.image)}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow label="Thumbnail URL">
              <TextField
                value={embed.thumbnail || ""}
                placeholder="https://… or {staff.avatar}"
                onChange={(next) => onChange({ thumbnail: next })}
              />
            </FieldRow>
            <FieldRow label="Image URL">
              <TextField
                value={embed.image || ""}
                placeholder="https://…"
                onChange={(next) => onChange({ image: next })}
              />
            </FieldRow>
          </div>
        </EmbedSection>

        <EmbedSection
          title="Footer"
          summary={embed.footer?.text || "The small line under everything"}
          filled={Boolean(embed.footer?.text || embed.timestamp)}
        >
          <FieldRow label="Footer text" trailing={<CharacterCount value={embed.footer?.text} limit={EMBED_LIMITS.footer} />}>
            <TextField
              value={embed.footer?.text || ""}
              onChange={(next) =>
                onChange({ footer: { ...(embed.footer || {}), text: next } })
              }
            />
          </FieldRow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow label="Footer icon URL">
              <TextField
                value={embed.footer?.icon_url || ""}
                placeholder="https://…"
                onChange={(next) =>
                  onChange({ footer: { ...(embed.footer || {}), icon_url: next } })
                }
              />
            </FieldRow>
            <FieldRow
              label="Timestamp"
              hint="“When sent” uses the moment each message goes out."
            >
              <TimestampField
                value={embed.timestamp}
                onChange={(next) => onChange({ timestamp: next })}
              />
            </FieldRow>
          </div>
        </EmbedSection>
      </EmbedParts>

      <EmbedParts
        title="Fields"
        list={false}
        count={
          <span className="gw-md-embed-count">
            {fields.length}/{EMBED_LIMITS.fields}
          </span>
        }
        action={
          <button
            type="button"
            disabled={fields.length >= EMBED_LIMITS.fields}
            onClick={() =>
              writeFields([...fields, { name: "", value: "", inline: false }])
            }
            className="gw-md-embed-add"
          >
            <IconPlus size={13} />
            Add field
          </button>
        }
      >
        {fields.length === 0 ? (
          <p className="gw-md-embed-empty">No fields. Inline ones sit side by side, three to a row.</p>
        ) : (
          <PresenceList
            items={fields}
            keys={fieldKeys}
            className="gw-md-field-list"
            render={(field, index) => (
            <div className="editor-block p-4">
              {/* Reorder and duplicate fields (they render in stored order). */}
              <div className="mb-3 flex items-center gap-1">
                <span className="gw-caption mr-auto">
                  Field {index + 1}
                </span>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                  className="rounded-xl p-1 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                  aria-label={`Move field ${index + 1} up`}
                >
                  <IconArrowUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={index === fields.length - 1}
                  onClick={() => moveField(index, 1)}
                  className="rounded-xl p-1 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                  aria-label={`Move field ${index + 1} down`}
                >
                  <IconArrowDown size={14} />
                </button>
                <button
                  type="button"
                  disabled={fields.length >= EMBED_LIMITS.fields}
                  onClick={() =>
                    writeFields([
                      ...fields.slice(0, index + 1),
                      { ...field },
                      ...fields.slice(index + 1),
                    ])
                  }
                  className="rounded-xl p-1 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
                  aria-label={`Duplicate field ${index + 1}`}
                >
                  <IconCopy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => writeFields(fields.filter((_, i) => i !== index))}
                  className="rounded-xl p-1 text-white/40 transition-colors hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
                  aria-label={`Remove field ${index + 1}`}
                >
                  <IconTrash size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldRow label="Name" trailing={<CharacterCount value={field.name} limit={EMBED_LIMITS.fieldName} />}>
                  <TextField
                    value={field.name}
                    placeholder="Field name"
                    onChange={(next) => {
                      const nextFields = [...fields];
                      nextFields[index] = { ...field, name: next };
                      writeFields(nextFields);
                    }}
                  />
                </FieldRow>
                <FieldRow label="Value" trailing={<CharacterCount value={field.value} limit={EMBED_LIMITS.fieldValue} />}>
                  <TextAreaField
                    rows={2}
                    value={field.value}
                    placeholder="Field value"
                    onChange={(next) => {
                      const nextFields = [...fields];
                      nextFields[index] = { ...field, value: next };
                      writeFields(nextFields);
                    }}
                  />
                </FieldRow>
              </div>
              <div className="mt-3">
                <OptionCard
                  compact
                  label="Inline"
                  checked={Boolean(field.inline)}
                  onChange={(next) => {
                    const nextFields = [...fields];
                    nextFields[index] = { ...field, inline: next };
                    writeFields(nextFields);
                  }}
                />
              </div>
            </div>
            )}
          />
        )}
      </EmbedParts>
    </>
  );
}

/**
 * The footer timestamp: off, the moment of sending (stored as `"now"`), or a
 * fixed instant (an ISO string), so the bot can resolve it at send time.
 */
function TimestampField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (next: string | undefined) => void;
}) {
  const mode = !value ? "none" : value === "now" ? "now" : "fixed";
  const localValue = React.useMemo(() => {
    if (mode !== "fixed" || !value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }, [mode, value]);

  return (
    <div className="space-y-2">
      <SelectField
        value={mode}
        options={[
          { value: "none", label: "No timestamp" },
          { value: "now", label: "When sent" },
          { value: "fixed", label: "A specific time" },
        ]}
        onChange={(next) => {
          if (next === "none") return onChange(undefined);
          if (next === "now") return onChange("now");
          onChange(new Date().toISOString());
        }}
      />
      {mode === "fixed" ? (
        <input
          type="datetime-local"
          value={localValue}
          onChange={(event) => {
            const parsed = new Date(event.target.value);
            onChange(Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString());
          }}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-[#f5f2f2] outline-none transition-colors focus:border-[rgb(var(--accent-rgb)/0.45)]"
        />
      ) : null}
    </div>
  );
}
