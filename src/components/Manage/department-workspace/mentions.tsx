"use client";

import React, { useEffect, useRef, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import { createPortal } from "react-dom";
import { IconDeviceGamepad2, IconUsers } from "@tabler/icons-react";
import { DiscordLogo } from "@/components/brand-icons";
import { MemberAvatar } from "../member-avatar";
import { parseServerDate } from "./shared";

/* @-mentions in announcements: the text area that inserts them, how they render, and the card a mention opens. */

/** Discord-style profile card shown when a @mention is clicked: department
 *  identity, rank, and profile links (Discord always, Roblox when linked). */
function MentionProfileCard({
  member,
  departmentName,
  accentColor,
  anchor,
  onClose,
}: {
  member: any;
  departmentName?: string;
  /** Department accent so the portaled card matches its highlight colour. */
  accentColor?: string | null;
  anchor: { x: number; y: number };
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (!cardRef.current?.contains(event.target as Node)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);
  if (typeof window === "undefined") return null;
  const width = 288;
  const left = Math.max(
    8,
    Math.min(anchor.x - width / 2, window.innerWidth - width - 8),
  );
  const top = Math.min(anchor.y + 8, window.innerHeight - 8 - 250);
  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${member.name} profile`}
      className="fixed z-[240] w-72 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#131415] shadow-[0_28px_80px_rgba(0,0,0,.75)]"
      style={
        accentColor
          ? ({ left, top, "--accent-peach": accentColor } as React.CSSProperties)
          : { left, top }
      }
    >
      <div className="h-14 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-peach)_45%,#1b1b1b),#151515)]" />
      <div className="-mt-7 px-4 pb-4">
        {member.avatar ? (
          <img
            src={discordAvatarUrl(member.avatar) || ""}
            alt=""
            className="h-14 w-14 rounded-full border-4 border-[#131415] object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#131415] bg-[color-mix(in_srgb,var(--accent-peach)_14%,transparent)] text-[var(--accent-peach)]">
            <IconUsers size={20} />
          </span>
        )}
        <p className="mt-2 truncate text-sm font-extrabold text-white">
          {member.name}
        </p>
        {member.username ? (
          <p className="cool-text truncate text-xs">@{member.username}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-peach)]/25 bg-[color-mix(in_srgb,var(--accent-peach)_9%,transparent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent-peach)]">
            {member.rankName || "Unranked"}
          </span>
          {departmentName ? (
            <span className="cool-text text-[11px]">in {departmentName}</span>
          ) : null}
        </div>
        {member.joinedAt ? (
          <p className="cool-text mt-2 text-[11px]">
            Member since{" "}
            {parseServerDate(member.joinedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          <a
            href={`https://discord.com/users/${member.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:border-white/20 hover:text-white"
          >
            <DiscordLogo size={14} />
            View Discord profile
          </a>
          {member.robloxId ? (
            <a
              href={`https://www.roblox.com/users/${member.robloxId}/profile`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:border-white/20 hover:text-white"
            >
              <IconDeviceGamepad2 size={14} />
              View Roblox profile
            </a>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Renders announcement/reply text with @mentions highlighted like Discord.
 *  Clicking a mention opens that member's department profile card. */
export function MentionText({
  text,
  members,
  departmentName,
  accentColor,
}: {
  text: string;
  /** Roster rows (id/name/username/avatar/rankName/robloxId/joinedAt). */
  members: any[];
  departmentName?: string;
  accentColor?: string | null;
}) {
  const [popover, setPopover] = useState<{
    member: any;
    anchor: { x: number; y: number };
  } | null>(null);
  const sorted = [...members].sort(
    (a, b) => String(b.name || "").length - String(a.name || "").length,
  );
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length) {
    const at = rest.indexOf("@");
    if (at < 0) {
      parts.push(rest);
      break;
    }
    const match = sorted.find(
      (member) =>
        member.name &&
        rest
          .slice(at + 1)
          .toLowerCase()
          .startsWith(String(member.name).toLowerCase()),
    );
    if (!match) {
      parts.push(rest.slice(0, at + 1));
      rest = rest.slice(at + 1);
      continue;
    }
    if (at > 0) parts.push(rest.slice(0, at));
    const label = rest.slice(at + 1, at + 1 + String(match.name).length);
    parts.push(
      <button
        key={key++}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setPopover({
            member: match,
            anchor: { x: rect.left + rect.width / 2, y: rect.bottom },
          });
        }}
        className="rounded bg-[color-mix(in_srgb,var(--accent-peach)_18%,transparent)] px-1 font-semibold text-[var(--accent-peach)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-peach)_30%,transparent)]"
      >
        @{label}
      </button>,
    );
    rest = rest.slice(at + 1 + String(match.name).length);
  }
  return (
    <>
      {parts}
      {popover ? (
        <MentionProfileCard
          member={popover.member}
          departmentName={departmentName}
          accentColor={accentColor}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
        />
      ) : null}
    </>
  );
}

/** Textarea with a Discord-style @mention picker fed by the roster. */
export function MentionTextArea({
  value,
  onChange,
  members,
  placeholder,
  rows = 1,
  className,
  onSubmit,
  onMention,
}: {
  value: string;
  onChange: (next: string) => void;
  members: { id: string; name: string; avatar?: string }[];
  placeholder?: string;
  rows?: number;
  className?: string;
  onSubmit?: () => void;
  /** Fired with the exact member picked, so the recipient id is captured
   *  directly instead of being re-parsed (fragile) out of the text. */
  onMention?: (member: { id: string; name: string }) => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const matches =
    mentionQuery === null
      ? []
      : members
          .filter((member) =>
            member.name.toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6);
  function refreshQuery(next: string, caret: number) {
    const upToCaret = next.slice(0, caret);
    const match = /@([\w .-]{0,32})$/.exec(upToCaret);
    setMentionQuery(match ? match[1] : null);
  }
  function pick(member: { id: string; name: string }) {
    const area = areaRef.current;
    const caret = area?.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const start = upToCaret.lastIndexOf("@");
    const next = `${value.slice(0, start)}@${member.name} ${value.slice(caret)}`;
    onChange(next);
    onMention?.(member);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      area?.focus();
      const position = start + member.name.length + 2;
      area?.setSelectionRange(position, position);
    });
  }
  return (
    <div className="relative min-w-0 flex-1">
      <textarea
        ref={areaRef}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          refreshQuery(event.target.value, event.target.selectionStart ?? 0);
        }}
        onKeyDown={(event) => {
          if (mentionQuery !== null && event.key === "Enter" && matches.length) {
            event.preventDefault();
            pick(matches[0]);
            return;
          }
          if (event.key === "Escape") setMentionQuery(null);
          if (
            onSubmit &&
            event.key === "Enter" &&
            !event.shiftKey &&
            mentionQuery === null
          ) {
            event.preventDefault();
            onSubmit();
          }
        }}
        onBlur={() => window.setTimeout(() => setMentionQuery(null), 150)}
        className={className}
      />
      {mentionQuery !== null && matches.length ? (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-64 rounded-xl border border-white/[0.08] bg-[#131415] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
          <p className="cool-text px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.12em]">
            Mention a member
          </p>
          {matches.map((member) => (
            <button
              key={member.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(member);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/75 hover:bg-white/[0.06] hover:text-white"
            >
              {member.avatar ? (
                <MemberAvatar src={member.avatar} name={member.name} className="h-6 w-6" />
              ) : (
                <span className="h-6 w-6 rounded-full bg-white/[0.06]" />
              )}
              <span className="truncate">{member.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Which roster members are @mentioned in a piece of text. */
export function mentionedMemberIds(
  text: string,
  members: { id: string; name: string }[],
): string[] {
  return members
    .filter((member) => text.toLowerCase().includes(`@${member.name.toLowerCase()}`))
    .map((member) => member.id)
    .slice(0, 20);
}
