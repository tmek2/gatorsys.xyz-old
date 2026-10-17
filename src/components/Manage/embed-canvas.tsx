"use client";

import React from "react";
import { IconArrowDown, IconArrowUp, IconCheck, IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { PresenceList } from "@/components/motion";
import { ColorPicker, OptionCard } from "./fields";
import {
  DiscordComponentPreview,
  isImageToken,
  previewTimestamp,
  renderableImageUrl,
} from "./embed-editor";
import { DiscordFrame, ImageSlot, InlineText, LinkField, PartRoll, PartSheet, PartTools, SheetField, usePhone } from "./discord-message";
import { EMBED_LIMITS, embedCharacterCount, type EmbedField, type MessageEmbed } from "./types";

/**
 * The message, edited where it is read, on the mockup builder's Discord surface
 * (its colours, type and measurements) and signed with the bot's own name and
 * avatar in this server. Every part is edited in place; a part's extras (a
 * link, an icon, the timestamp) open under it while it is active. Pictures can
 * be dropped, chosen or linked, and `{` offers the variables this message can
 * use.
 */

type PartId =
  | "content"
  | "author"
  | "title"
  | "description"
  | "color"
  | "image"
  | "thumbnail"
  | "footer"
  | `field:${number}`;

interface Props {
  /** Every embed in the message, in order. One is the usual; Discord takes ten. */
  embeds: MessageEmbed[];
  onEmbeds: (next: MessageEmbed[]) => void;
  /** Told which embed you are in, for the template bar beside the editor. */
  onActiveEmbed?: (index: number) => void;
  content?: string;
  onContent?: (next: string) => void;
  hideContent?: boolean;
  /** The variables this message may use (the `{` list is the editor's). */
  variables: string[];
  buttons?: React.ComponentProps<typeof DiscordComponentPreview>["components"];
}

/** A part being edited: which embed it is in, or -1 for the message's text. */
type ActivePart = { at: number; part: PartId };

const MAX_EMBEDS = 10;

/* Discord lays inline fields three to a row, and a short run shares the row
   out evenly: one inline field alone is full width, two are halves. */
function fieldSpan(fields: EmbedField[], index: number) {
  if (!fields[index]?.inline) return 12;
  let start = index;
  while (start > 0 && fields[start - 1].inline) start -= 1;
  let end = index;
  while (end + 1 < fields.length && fields[end + 1].inline) end += 1;
  const rowStart = start + Math.floor((index - start) / 3) * 3;
  return 12 / Math.min(3, end - rowStart + 1);
}

const SWATCHES = [
  "f7a8c4", "fb7185", "f97316", "facc15", "34d399",
  "22d3ee", "5865f2", "a78bfa", "f8fafc", "4b5563",
];

/**
 * Every embed in the message (up to ten) and the text above them, stacked as
 * Discord stacks them. Embeds are added from the end of the message like
 * container blocks, without a kind menu. The active one has a small bar to
 * move, copy or remove it.
 */
export function EmbedCanvas({
  embeds: given,
  onEmbeds,
  onActiveEmbed,
  content,
  onContent,
  hideContent = false,
  buttons,
}: Props) {
  const embeds = given.length ? given : [{}];
  const [active, setActiveState] = React.useState<ActivePart | null>(null);
  const phone = usePhone();
  const host = React.useRef<HTMLDivElement | null>(null);
  const setActive = React.useCallback(
    (next: ActivePart | null) => {
      setActiveState(next);
      if (next && next.at >= 0) onActiveEmbed?.(next.at);
    },
    [onActiveEmbed],
  );
  const close = React.useCallback(() => setActiveState(null), []);

  /* A part stays open until a press lands outside it (not on blur), so the
     formatting bar, the `{` list and the part's tools can act on it. */
  React.useEffect(() => {
    if (!active) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest("[data-part], .gw-cv-tools, .gw-psheet-layer, .gw-cv-embed-bar")) return;
      if (
        target.closest(
          ".gw-md-bar, .gw-md-vars, .gw-vac, [data-md-keep], .gw-menu, [role='listbox'], [data-radix-popper-content-wrapper]",
        )
      )
        return;
      setActiveState(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [active]);

  const write = (index: number, patch: Partial<MessageEmbed>) =>
    onEmbeds(embeds.map((embed, i) => (i === index ? { ...embed, ...patch } : embed)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= embeds.length) return;
    const next = [...embeds];
    [next[index], next[target]] = [next[target], next[index]];
    onEmbeds(next);
    if (active) setActive({ ...active, at: target });
  };
  const copy = (index: number) => {
    if (embeds.length >= MAX_EMBEDS) return;
    const next = [...embeds];
    next.splice(index + 1, 0, JSON.parse(JSON.stringify(embeds[index])));
    onEmbeds(next);
    setActive({ at: index + 1, part: "title" });
  };
  const remove = (index: number) => {
    if (embeds.length <= 1) return;
    setActiveState(null);
    onEmbeds(embeds.filter((_, i) => i !== index));
  };
  const add = () => {
    if (embeds.length >= MAX_EMBEDS) return;
    onEmbeds([...embeds, {}]);
    setActive({ at: embeds.length, part: "title" });
  };

  const total = embeds.reduce((sum, embed) => sum + embedCharacterCount(embed), 0);
  const contentActive = active?.at === -1 ? active.part : null;

  return (
    <div className="gw-cv" ref={host} data-phone={phone ? "true" : undefined}>
      <DiscordFrame className="gw-cv-chat">
        {!hideContent && onContent ? (
          <div className="gw-cv-part dc-content" data-part="content" data-active={contentActive ? "true" : undefined}>
            <InlineText
              value={content || ""}
              onChange={onContent}
              open={!phone && contentActive === "content"}
              onOpen={() => setActive({ at: -1, part: "content" })}
              onClose={close}
              placeholder={embeds.length > 1 ? "Add a message above the embeds" : "Add a message above the embed"}
              multiline
              limit={2000}
            />
          </div>
        ) : null}

        <PresenceList
          items={embeds}
          className="gw-cv-embeds"
          render={(embed, index) => (
            <EmbedCard
              embed={embed}
              onChange={(patch) => write(index, patch)}
              active={active?.at === index ? active.part : null}
              setActive={(part) => (part ? setActive({ at: index, part }) : close())}
              phone={phone}
              host={host.current}
              bar={
                active?.at === index && !phone && embeds.length > 1 ? (
                  <EmbedBar
                    index={index}
                    count={embeds.length}
                    onMove={(delta) => move(index, delta)}
                    onCopy={() => copy(index)}
                    onRemove={() => remove(index)}
                  />
                ) : null
              }
              acts={
                phone && embeds.length > 1 ? (
                  <div className="gw-psheet-acts">
                    <button type="button" className="gw-btn" data-kind="ghost" disabled={index === 0} onClick={() => move(index, -1)}>
                      <IconArrowUp size={15} /> Embed up
                    </button>
                    <button type="button" className="gw-btn" data-kind="ghost" disabled={index === embeds.length - 1} onClick={() => move(index, 1)}>
                      <IconArrowDown size={15} /> Embed down
                    </button>
                    <button type="button" className="gw-btn gw-psheet-remove" onClick={() => remove(index)}>
                      <IconTrash size={15} /> Remove embed
                    </button>
                  </div>
                ) : null
              }
            />
          )}
        />
        {embeds.length < MAX_EMBEDS ? (
          <button type="button" className="gw-cv-add gw-cv-add-embed" onClick={add}>
            <IconPlus size={13} aria-hidden="true" />
            Embed
            {embeds.length > 1 ? <span className="gw-cv-add-count">{embeds.length} of {MAX_EMBEDS}</span> : null}
          </button>
        ) : null}

        {buttons && buttons.length ? <DiscordComponentPreview components={buttons} /> : null}
      </DiscordFrame>
      <PartSheet host={host.current} open={phone && contentActive !== null} title="Message" onClose={close}>
        {phone && contentActive && onContent ? (
          <SheetField autoFocus label="Message" multiline limit={2000} value={content || ""} onChange={onContent} placeholder="Above the embed" />
        ) : null}
      </PartSheet>
      <p className="gw-cv-hint">
        Press any part to change it. Type <kbd>{"{"}</kbd> for a variable.
        {total > EMBED_LIMITS.total * 0.6 ? (
          <span
            className="gw-cv-count"
            data-tone={total > EMBED_LIMITS.total ? "bad" : total > EMBED_LIMITS.total * 0.9 ? "warn" : undefined}
          >
            {total.toLocaleString()} / {EMBED_LIMITS.total.toLocaleString()}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** The embed you are in, when there is more than one: where it is, and moving,
 *  copying or taking it out. */
function EmbedBar({
  index,
  count,
  onMove,
  onCopy,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="gw-cc-bar gw-cv-embed-bar" data-md-keep>
      <span className="gw-cc-bar-name">
        Embed {index + 1} of {count}
      </span>
      <span className="gw-cc-bar-acts">
        <button type="button" className="gw-cc-bar-btn" aria-label="Move embed up" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <IconArrowUp size={14} />
        </button>
        <button type="button" className="gw-cc-bar-btn" aria-label="Move embed down" title="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          <IconArrowDown size={14} />
        </button>
        <button type="button" className="gw-cc-bar-btn" aria-label="Copy embed" title="Copy" disabled={count >= MAX_EMBEDS} onClick={onCopy}>
          <IconCopy size={14} />
        </button>
        <button type="button" className="gw-cc-bar-btn" data-tone="bad" aria-label="Remove embed" title="Remove" onClick={onRemove}>
          <IconTrash size={14} />
        </button>
      </span>
    </div>
  );
}

/** One embed, each of its parts changed in place. */
/**
 * An open field takes the whole row, so its raw text and its tools have room;
 * the fields around it glide to their new places instead of jumping (FLIP).
 * Positions are read on a press or a key, which is what opens and closes a
 * field, never on every render.
 */
function useFieldGlide(card: React.RefObject<HTMLDivElement | null>, open: string | null) {
  const before = React.useRef<Map<Element, { x: number; y: number }> | null>(null);
  React.useEffect(() => {
    const read = () => {
      const rows = card.current?.querySelector(".gw-cv-fields")?.children;
      if (!rows) return;
      before.current = new Map(
        Array.from(rows, (row) => [row, { x: (row as HTMLElement).offsetLeft, y: (row as HTMLElement).offsetTop }]),
      );
    };
    document.addEventListener("pointerdown", read, true);
    document.addEventListener("keydown", read, true);
    return () => {
      document.removeEventListener("pointerdown", read, true);
      document.removeEventListener("keydown", read, true);
    };
  }, [card]);
  React.useLayoutEffect(() => {
    const was = before.current;
    before.current = null;
    const rows = card.current?.querySelector(".gw-cv-fields")?.children;
    if (!was || !rows || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const row of Array.from(rows) as HTMLElement[]) {
      const from = was.get(row);
      if (!from) continue;
      const dx = from.x - row.offsetLeft;
      const dy = from.y - row.offsetTop;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: 320,
        easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      });
    }
  }, [card, open]);
}

function EmbedCard({
  embed,
  onChange,
  active,
  setActive,
  phone,
  host,
  bar,
  acts,
}: {
  embed: MessageEmbed;
  onChange: (patch: Partial<MessageEmbed>) => void;
  active: PartId | null;
  setActive: (next: PartId | null) => void;
  phone: boolean;
  host: HTMLDivElement | null;
  /** The embed's own bar, while you are in it. */
  bar: React.ReactNode;
  /** On a phone, the same moves at the foot of each of its sheets. */
  acts: React.ReactNode;
}) {
  const fields: EmbedField[] = embed.fields || [];
  const colorHex =
    typeof embed.color === "string" && embed.color
      ? embed.color.replace(/^#/, "").toLowerCase()
      : typeof embed.color === "number"
        ? embed.color.toString(16).padStart(6, "0")
        : "";

  const writeFields = (next: EmbedField[]) => onChange({ fields: next });
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const openField = !phone && active?.startsWith("field:") ? active : null;
  useFieldGlide(cardRef, openField);
  const fieldAt = (index: number, patch: Partial<EmbedField>) =>
    writeFields(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  const moveField = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    writeFields(next);
    setActive(`field:${target}`);
  };

  const part = (id: PartId) => ({
    "data-part": id,
    "data-active": active === id ? "true" : undefined,
  });
  const text = (
    id: PartId,
    value: string | undefined,
    set: (next: string) => void,
    options: { placeholder: string; multiline?: boolean; limit?: number; className?: string; focusOnOpen?: boolean },
  ) => (
    <InlineText
      value={value || ""}
      onChange={set}
      // On a phone the part opens in the sheet, and the canvas is its preview.
      open={!phone && active === id}
      onOpen={() => setActive(id)}
      onClose={() => setActive(null)}
      {...options}
    />
  );

  /* A part's sheet, on a phone: its words at a size you can type into, and
     everything else it has under them. */
  const renderSheet = (id: PartId): React.ReactNode => {
    if (id === "author") {
      return (
        <>
          <SheetField autoFocus label="Name" limit={EMBED_LIMITS.author} value={embed.author?.name || ""} onChange={(name) => onChange({ author: { ...embed.author, name } })} />
          <div className="gw-cv-icon-row">
            <ImageSlot size="thumb" className="gw-cv-icon-slot" imgClassName="gw-cv-icon-img" label="Icon" value={embed.author?.icon_url} onChange={(icon_url) => onChange({ author: { ...embed.author, icon_url } })} onLink={() => undefined} />
            <div className="gw-cv-stack">
              <LinkField picture label="Icon link" value={embed.author?.icon_url} onChange={(icon_url) => onChange({ author: { ...embed.author, icon_url } })} />
              <LinkField label="Opens" value={embed.author?.url} onChange={(url) => onChange({ author: { ...embed.author, url } })} />
            </div>
          </div>
        </>
      );
    }
    if (id === "title") {
      return (
        <>
          <SheetField autoFocus label="Title" limit={EMBED_LIMITS.title} value={embed.title || ""} onChange={(title) => onChange({ title })} />
          <LinkField label="Title opens" placeholder="https://… (the title becomes a link)" value={embed.url} onChange={(url) => onChange({ url })} />
        </>
      );
    }
    if (id === "description") {
      return <SheetField autoFocus label="Description" multiline limit={EMBED_LIMITS.description} value={embed.description || ""} onChange={(description) => onChange({ description })} placeholder="Markdown, mentions and {variables} work." />;
    }
    if (id === "color") {
      return <ColorTools colorHex={colorHex} onChange={(color) => onChange({ color })} />;
    }
    if (id === "image") {
      return (
        <>
          <div className="gw-psheet-picture">
            <ImageSlot label="Image" value={embed.image} imgClassName="dc-embed-image" onChange={(image) => onChange({ image })} onLink={() => undefined} />
          </div>
          <LinkField picture label="Image link" value={embed.image} onChange={(image) => onChange({ image })} />
        </>
      );
    }
    if (id === "thumbnail") {
      return (
        <>
          <ImageSlot size="thumb" label="Thumbnail" value={embed.thumbnail} imgClassName="dc-embed-thumb" onChange={(thumbnail) => onChange({ thumbnail })} onLink={() => undefined} />
          <LinkField picture label="Thumbnail link" value={embed.thumbnail} onChange={(thumbnail) => onChange({ thumbnail })} />
        </>
      );
    }
    if (id === "footer") {
      return (
        <>
          <SheetField autoFocus label="Footer" limit={EMBED_LIMITS.footer} value={embed.footer?.text || ""} onChange={(footerText) => onChange({ footer: { ...embed.footer, text: footerText } })} />
          <div className="gw-cv-icon-row">
            <ImageSlot size="thumb" className="gw-cv-icon-slot" imgClassName="gw-cv-icon-img" label="Icon" value={embed.footer?.icon_url} onChange={(icon_url) => onChange({ footer: { ...embed.footer, icon_url } })} onLink={() => undefined} />
            <div className="gw-cv-stack">
              <LinkField picture label="Icon link" value={embed.footer?.icon_url} onChange={(icon_url) => onChange({ footer: { ...embed.footer, icon_url } })} />
              <OptionCard compact label="Timestamp" description="When the message is sent" checked={Boolean(embed.timestamp)} onChange={(on) => onChange({ timestamp: on ? "now" : undefined })} />
            </div>
          </div>
        </>
      );
    }
    if (id.startsWith("field:")) {
      const index = Number(id.slice(6));
      const field = fields[index];
      if (!field) return null;
      return (
        <>
          <SheetField autoFocus label="Name" limit={EMBED_LIMITS.fieldName} value={field.name || ""} onChange={(name) => fieldAt(index, { name })} />
          <SheetField label="Value" multiline limit={EMBED_LIMITS.fieldValue} value={field.value || ""} onChange={(value) => fieldAt(index, { value })} />
          <OptionCard compact label="Inline" description="Side by side with the fields next to it" checked={Boolean(field.inline)} onChange={(inline) => fieldAt(index, { inline })} />
          <div className="gw-psheet-acts">
            <button type="button" className="gw-btn" data-kind="ghost" disabled={index === 0} onClick={() => moveField(index, -1)}>
              <IconArrowUp size={15} /> Up
            </button>
            <button type="button" className="gw-btn" data-kind="ghost" disabled={index === fields.length - 1} onClick={() => moveField(index, 1)}>
              <IconArrowDown size={15} /> Down
            </button>
            <button
              type="button"
              className="gw-btn gw-psheet-remove"
              onClick={() => {
                setActive(null);
                writeFields(fields.filter((_, i) => i !== index));
              }}
            >
              <IconTrash size={15} /> Remove
            </button>
          </div>
        </>
      );
    }
    return null;
  };

  const authorIcon = renderableImageUrl(embed.author?.icon_url);
  const footerIcon = renderableImageUrl(embed.footer?.icon_url);
  const hasThumb = Boolean(embed.thumbnail);


  return (
    <>
        <div
          ref={cardRef}
          className="dc-embed gw-cv-embed"
          data-active={active ? "true" : undefined}
          style={{ ["--embed-accent" as string]: colorHex ? `#${colorHex}` : undefined }}
        >
          {bar}
          {/* The colour is the strip; pressing the strip changes it. */}
          <button
            type="button"
            className="gw-cv-strip"
            aria-label="Embed colour"
            title="Colour"
            data-part="color"
            data-active={active === "color" ? "true" : undefined}
            onClick={() => setActive(active === "color" ? null : "color")}
          />
          <PartRoll open={!phone && active === "color"}>
            <PartTools className="gw-cv-tools-top">
              <ColorTools colorHex={colorHex} onChange={(color) => onChange({ color })} />
            </PartTools>
          </PartRoll>

          <div className="dc-embed-grid" data-thumb={hasThumb ? "true" : undefined}>
            <div className="dc-embed-main">
              {/* Author */}
              <div className="gw-cv-part" {...part("author")}>
                <div className="dc-embed-author">
                  {authorIcon || isImageToken(embed.author?.icon_url) ? (
                    authorIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="dc-embed-author-icon" src={authorIcon} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="dc-embed-author-icon dc-img-token" />
                    )
                  ) : null}
                  {text("author", embed.author?.name, (name) => onChange({ author: { ...embed.author, name } }), {
                    placeholder: "Author",
                    limit: EMBED_LIMITS.author,
                  })}
                </div>
                <PartRoll open={!phone && active === "author"}>
                  <PartTools>
                    <div className="gw-cv-icon-row">
                      <ImageSlot
                        size="thumb"
                        className="gw-cv-icon-slot"
                        imgClassName="gw-cv-icon-img"
                        label="Icon"
                        value={embed.author?.icon_url}
                        onChange={(icon_url) => onChange({ author: { ...embed.author, icon_url } })}
                        onLink={() => document.getElementById("gw-cv-author-icon")?.focus()}
                      />
                      <div className="gw-cv-stack">
                        <LinkField
                          picture
                          label="Icon link"
                          value={embed.author?.icon_url}
                          onChange={(icon_url) => onChange({ author: { ...embed.author, icon_url } })}
                        />
                        <LinkField
                          label="Opens"
                          placeholder="https://… (the author's name becomes a link)"
                          value={embed.author?.url}
                          onChange={(url) => onChange({ author: { ...embed.author, url } })}
                        />
                      </div>
                    </div>
                  </PartTools>
                </PartRoll>
              </div>

              {/* Title */}
              <div className="gw-cv-part" {...part("title")}>
                <div className="dc-embed-title" data-link={embed.url ? "true" : undefined}>
                  {text("title", embed.title, (title) => onChange({ title }), {
                    placeholder: "Title",
                    limit: EMBED_LIMITS.title,
                  })}
                </div>
                <PartRoll open={!phone && active === "title"}>
                  <PartTools>
                    <LinkField
                      label="Title opens"
                      placeholder="https://… (the title becomes a link)"
                      value={embed.url}
                      onChange={(url) => onChange({ url })}
                    />
                  </PartTools>
                </PartRoll>
              </div>

              {/* Description */}
              <div className="gw-cv-part" {...part("description")}>
                <div className="dc-embed-description">
                  {text("description", embed.description, (description) => onChange({ description }), {
                    placeholder: "Description. Markdown, mentions and {variables} work.",
                    multiline: true,
                    limit: EMBED_LIMITS.description,
                  })}
                </div>
              </div>

              {/* Fields */}
              {fields.length ? (
                <PresenceList
                  items={fields}
                  className="dc-embed-fields gw-cv-fields"
                  itemStyle={(_, index) =>
                    openField === `field:${index}`
                      ? { gridColumn: "1 / -1" }
                      : { gridColumn: `span ${fieldSpan(fields, index)}` }
                  }
                  render={(field, index) => {
                    const id: PartId = `field:${index}`;
                    return (
                      <div className="gw-cv-part dc-embed-field" {...part(id)}>
                        <div className="dc-embed-field-name">
                          {text(id, field.name, (name) => fieldAt(index, { name }), {
                            placeholder: "Name",
                            limit: EMBED_LIMITS.fieldName,
                          })}
                        </div>
                        <div className="dc-embed-field-value">
                          {text(id, field.value, (value) => fieldAt(index, { value }), {
                            placeholder: "Value",
                            multiline: true,
                            limit: EMBED_LIMITS.fieldValue,
                            focusOnOpen: false,
                          })}
                        </div>
                        <PartRoll open={!phone && active === id}>
                          <PartTools className="gw-cv-tools-row">
                            <OptionCard
                              compact
                              label="Inline"
                              checked={Boolean(field.inline)}
                              onChange={(inline) => fieldAt(index, { inline })}
                            />
                            <span className="gw-cv-acts">
                              <button type="button" className="gw-cv-act" aria-label="Move field up" title="Move up" disabled={index === 0} onClick={() => moveField(index, -1)}>
                                <IconArrowUp size={15} />
                              </button>
                              <button type="button" className="gw-cv-act" aria-label="Move field down" title="Move down" disabled={index === fields.length - 1} onClick={() => moveField(index, 1)}>
                                <IconArrowDown size={15} />
                              </button>
                              <button
                                type="button"
                                className="gw-cv-act"
                                data-tone="bad"
                                aria-label="Remove field"
                                title="Remove"
                                onClick={() => {
                                  setActive(null);
                                  writeFields(fields.filter((_, i) => i !== index));
                                }}
                              >
                                <IconTrash size={15} />
                              </button>
                            </span>
                          </PartTools>
                        </PartRoll>
                      </div>
                    );
                  }}
                />
              ) : null}
              {fields.length < 25 ? (
                <button
                  type="button"
                  className="gw-cv-add"
                  onClick={() => {
                    writeFields([...fields, { name: "", value: "", inline: false }]);
                    setActive(`field:${fields.length}`);
                  }}
                >
                  <IconPlus size={13} aria-hidden="true" />
                  Field
                </button>
              ) : null}

              {/* Image */}
              <div className="gw-cv-part gw-cv-image" {...part("image")}>
                <ImageSlot
                  label="Image"
                  value={embed.image}
                  imgClassName="dc-embed-image"
                  onChange={(image) => onChange({ image })}
                  onLink={() => setActive("image")}
                />
                <PartRoll open={!phone && active === "image"}>
                  <PartTools>
                    <LinkField picture label="Image link" autoFocus value={embed.image} onChange={(image) => onChange({ image })} />
                  </PartTools>
                </PartRoll>
              </div>

              {/* Footer and timestamp */}
              <div className="gw-cv-part" {...part("footer")}>
                <div className="dc-embed-footer">
                  {footerIcon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="dc-embed-footer-icon" src={footerIcon} alt="" referrerPolicy="no-referrer" />
                  ) : isImageToken(embed.footer?.icon_url) ? (
                    <span className="dc-embed-footer-icon dc-img-token" />
                  ) : null}
                  <span className="gw-cv-grow">
                    {text("footer", embed.footer?.text, (footerText) => onChange({ footer: { ...embed.footer, text: footerText } }), {
                      placeholder: "Footer",
                      limit: EMBED_LIMITS.footer,
                    })}
                  </span>
                  {embed.timestamp ? (
                    <span className="gw-cv-stamp">
                      {embed.footer?.text ? <span className="dc-embed-dot">•</span> : null}
                      {previewTimestamp(embed.timestamp)}
                    </span>
                  ) : null}
                </div>
                <PartRoll open={!phone && active === "footer"}>
                  <PartTools>
                    <div className="gw-cv-icon-row">
                      <ImageSlot
                        size="thumb"
                        className="gw-cv-icon-slot"
                        imgClassName="gw-cv-icon-img"
                        label="Icon"
                        value={embed.footer?.icon_url}
                        onChange={(icon_url) => onChange({ footer: { ...embed.footer, icon_url } })}
                        onLink={() => undefined}
                      />
                      <div className="gw-cv-stack">
                        <LinkField
                          picture
                          label="Icon link"
                          value={embed.footer?.icon_url}
                          onChange={(icon_url) => onChange({ footer: { ...embed.footer, icon_url } })}
                        />
                        <OptionCard
                          compact
                          label="Timestamp"
                          description="When the message is sent"
                          checked={Boolean(embed.timestamp)}
                          onChange={(on) => onChange({ timestamp: on ? "now" : undefined })}
                        />
                      </div>
                    </div>
                  </PartTools>
                </PartRoll>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="gw-cv-part gw-cv-thumb" {...part("thumbnail")}>
              <ImageSlot
                size="thumb"
                label="Thumbnail"
                value={embed.thumbnail}
                imgClassName="dc-embed-thumb"
                onChange={(thumbnail) => onChange({ thumbnail })}
                onLink={() => setActive("thumbnail")}
              />
            </div>
          </div>
          <PartRoll open={!phone && active === "thumbnail"}>
            <PartTools>
              <LinkField picture label="Thumbnail link" autoFocus value={embed.thumbnail} onChange={(thumbnail) => onChange({ thumbnail })} />
            </PartTools>
          </PartRoll>
        </div>

      <PartSheet host={host} open={phone && active !== null} title={sheetTitle(active, fields)} onClose={() => setActive(null)}>
        {phone && active ? (
          <>
            {renderSheet(active)}
            {acts}
          </>
        ) : null}
      </PartSheet>
    </>
  );
}

/** What the phone's sheet is called, for the part it holds. */
function sheetTitle(id: PartId | null, fields: EmbedField[]) {
  if (!id) return "";
  if (id.startsWith("field:")) {
    const index = Number(id.slice(6));
    return fields[index]?.name ? `Field · ${fields[index].name}` : `Field ${index + 1}`;
  }
  return (
    {
      content: "Message",
      author: "Author",
      title: "Title",
      description: "Description",
      color: "Colour",
      image: "Image",
      thumbnail: "Thumbnail",
      footer: "Footer",
    } as Record<string, string>
  )[id] ?? "";
}

/**
 * The embed colour: swatches, none, or any colour through the same picker as a
 * container's accent.
 */
function ColorTools({ colorHex, onChange }: { colorHex: string; onChange: (next: string | undefined) => void }) {
  return (
    <>
      <div className="gw-cv-swatches" role="radiogroup" aria-label="Embed colour">
        <button
          type="button"
          role="radio"
          aria-checked={!colorHex}
          className="gw-cv-swatch"
          data-none="true"
          title="No colour"
          onClick={() => onChange(undefined)}
        >
          {!colorHex ? <IconCheck size={12} stroke={3} /> : null}
        </button>
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            role="radio"
            aria-checked={colorHex === swatch}
            className="gw-cv-swatch"
            style={{ background: `#${swatch}` }}
            title={`#${swatch.toUpperCase()}`}
            onClick={() => onChange(swatch)}
          >
            {colorHex === swatch ? <IconCheck size={12} stroke={3} /> : null}
          </button>
        ))}
      </div>
      <div className="gw-cv-field gw-cv-hex">
        <span className="gw-cv-label">Any colour</span>
        <ColorPicker
          label="Embed colour"
          value={colorHex ? `#${colorHex}` : "#f7a8c4"}
          onChange={(value) => {
            const next = value.replace(/[^0-9a-f]/gi, "").slice(0, 6);
            onChange(next.length === 6 ? next.toLowerCase() : next || undefined);
          }}
        />
      </div>
    </>
  );
}
