"use client";

import React, { useMemo, useState } from "react";
import { IconMoodSmile, IconSearch, IconX } from "@tabler/icons-react";
import { PortalMenu, usePopover } from "./fields";
import { useOptionalManage } from "./manage-context";
import type { ManagedEmoji } from "./types";

/**
 * Discohook-style emoji picker: the server's emojis, the bot's application
 * emojis and the standard Unicode set, all searchable. Returns the token the
 * bot understands (`<:name:id>`, `<a:name:id>`, or the Unicode character).
 */

const STANDARD_EMOJIS: { group: string; items: [string, string][] }[] = [
  {
    group: "Smileys",
    items: [
      ["😀", "grinning"], ["😁", "beaming"], ["😂", "joy"], ["🤣", "rofl"],
      ["😊", "blush"], ["😇", "innocent"], ["🙂", "slight smile"], ["😉", "wink"],
      ["😍", "heart eyes"], ["🥰", "smiling hearts"], ["😘", "kiss"], ["😎", "sunglasses"],
      ["🤩", "star struck"], ["🥳", "partying"], ["😏", "smirk"], ["😅", "sweat smile"],
      ["😢", "cry"], ["😭", "sob"], ["😤", "triumph"], ["😡", "rage"],
      ["🤔", "thinking"], ["🤨", "raised eyebrow"], ["😴", "sleeping"], ["🤯", "mind blown"],
      ["🥺", "pleading"], ["😬", "grimace"], ["🙄", "eye roll"], ["😳", "flushed"],
    ],
  },
  {
    group: "Gestures & People",
    items: [
      ["👍", "thumbs up"], ["👎", "thumbs down"], ["👏", "clap"], ["🙌", "raised hands"],
      ["👋", "wave"], ["🤝", "handshake"], ["🙏", "pray"], ["💪", "muscle"],
      ["👀", "eyes"], ["🫡", "salute"], ["🤙", "call me"], ["✌️", "victory"],
      ["🤞", "fingers crossed"], ["👮", "police officer"], ["🧑‍🚒", "firefighter"], ["🕵️", "detective"],
    ],
  },
  {
    group: "Hearts & Symbols",
    items: [
      ["❤️", "red heart"], ["🧡", "orange heart"], ["💛", "yellow heart"], ["💚", "green heart"],
      ["💙", "blue heart"], ["💜", "purple heart"], ["🖤", "black heart"], ["🤍", "white heart"],
      ["💖", "sparkling heart"], ["✨", "sparkles"], ["⭐", "star"], ["🌟", "glowing star"],
      ["🔥", "fire"], ["💥", "collision"], ["✅", "check mark"], ["❌", "cross mark"],
      ["⚠️", "warning"], ["❗", "exclamation"], ["❓", "question"], ["💯", "hundred"],
      ["🔴", "red circle"], ["🟠", "orange circle"], ["🟡", "yellow circle"], ["🟢", "green circle"],
      ["🔵", "blue circle"], ["🟣", "purple circle"], ["⚫", "black circle"], ["⚪", "white circle"],
    ],
  },
  {
    group: "Objects & Activity",
    items: [
      ["📢", "loudspeaker"], ["📣", "megaphone"], ["🔔", "bell"], ["📌", "pin"],
      ["📎", "paperclip"], ["📝", "memo"], ["📋", "clipboard"], ["📁", "folder"],
      ["🗳️", "ballot"], ["🎉", "party"], ["🎊", "confetti"], ["🎁", "gift"],
      ["🏆", "trophy"], ["🥇", "gold medal"], ["🎮", "video game"], ["🎯", "dart"],
      ["🚀", "rocket"], ["🚨", "siren"], ["🚓", "police car"], ["🚒", "fire engine"],
      ["🚑", "ambulance"], ["🛠️", "tools"], ["🔑", "key"], ["🔒", "lock"],
      ["⏰", "alarm"], ["⏳", "hourglass"], ["📅", "calendar"], ["💼", "briefcase"],
    ],
  },
];

export function emojiToken(emoji: ManagedEmoji): string {
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

export function emojiImageUrl(emoji: ManagedEmoji): string {
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}?size=44`;
}

/** Searchable emoji grid, embeddable in any popover (also used by the
 *  insert menu). Calls `onPick` with the ready-to-insert token. */
export function EmojiGrid({ onPick }: { onPick: (token: string) => void }) {
  // Optional — reachable from the automation canvas, which has no provider.
  // Without one there are no server emoji to offer, only the unicode set.
  const meta = useOptionalManage()?.meta ?? null;
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();

  const custom = meta?.emojis || [];
  const serverEmojis = useMemo(
    () => custom.filter((emoji) => emoji.source !== "bot" && emoji.name.toLowerCase().includes(term)),
    [custom, term]
  );
  const botEmojis = useMemo(
    () => custom.filter((emoji) => emoji.source === "bot" && emoji.name.toLowerCase().includes(term)),
    [custom, term]
  );
  const standardGroups = useMemo(
    () =>
      STANDARD_EMOJIS.map((group) => ({
        group: group.group,
        items: group.items.filter(([, name]) => !term || name.includes(term)),
      })).filter((group) => group.items.length > 0),
    [term]
  );

  const customSection = (label: string, list: ManagedEmoji[]) =>
    list.length === 0 ? null : (
      <div key={label}>
        <p className="gw-caption px-1 pb-1 pt-2">
          {label}
        </p>
        <div className="grid grid-cols-8 gap-1">
          {list.map((emoji) => (
            <button
              key={emoji.id}
              type="button"
              title={`:${emoji.name}:`}
              onClick={() => onPick(emojiToken(emoji))}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-white/[0.08]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={emojiImageUrl(emoji)} alt={`:${emoji.name}:`} className="h-6 w-6 object-contain" />
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="w-full min-w-0 sm:w-[304px]">
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-3">
        <IconSearch size={13} className="shrink-0 text-white/35" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search emojis…"
          className="w-full bg-transparent text-[13px] text-[#f5f2f2] placeholder:text-white/25 outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-2">
        {customSection("Server emojis", serverEmojis)}
        {customSection("Bot emojis", botEmojis)}
        {standardGroups.map((group) => (
          <div key={group.group}>
            <p className="gw-caption px-1 pb-1 pt-2">
              {group.group}
            </p>
            <div className="grid grid-cols-8 gap-1">
              {group.items.map(([emoji, name]) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => onPick(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition-colors hover:bg-white/[0.08]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
        {serverEmojis.length === 0 && botEmojis.length === 0 && standardGroups.length === 0 ? (
          <p className="cool-text px-2 py-5 text-center text-xs">No emoji matches that search.</p>
        ) : null}
      </div>
    </div>
  );
}

/** Small button that shows the chosen emoji and opens the picker. */
export function EmojiPickerButton({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (token: string | undefined) => void;
}) {
  const { open, setOpen, ref, menuRef } = usePopover();
  const custom = value?.match(/^<(a?):(\w+):(\d+)>$/);

  return (
    <div className="relative" ref={ref}>
      {/* The mark on its own, not a smiley standing in a box beside the field
          it belongs to: a tile appears under the pointer. */}
      <div className="gw-emoji-field flex min-h-[42px] items-center gap-1">
        <button
          type="button"
          title="Pick an emoji"
          aria-label="Pick an emoji"
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition-colors hover:bg-white/[0.08]"
        >
          {custom ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://cdn.discordapp.com/emojis/${custom[3]}.${custom[1] ? "gif" : "png"}?size=44`}
              alt={`:${custom[2]}:`}
              className="h-5 w-5 object-contain"
            />
          ) : value ? (
            <span>{value}</span>
          ) : (
            <IconMoodSmile size={17} className="text-white/40" />
          )}
        </button>
        {value ? (
          <button
            type="button"
            aria-label="Clear emoji"
            onClick={() => onChange(undefined)}
            className="text-white/35 transition-colors hover:text-white"
          >
            <IconX size={12} stroke={2.5} />
          </button>
        ) : null}
      </div>
      {open ? (
        <PortalMenu anchorRef={ref} menuRef={menuRef}>
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#101010] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <EmojiGrid
              onPick={(token) => {
                onChange(token);
                setOpen(false);
              }}
            />
          </div>
        </PortalMenu>
      ) : null}
    </div>
  );
}
