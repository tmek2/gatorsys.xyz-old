"use client";

import React from "react";
import { IconCheck } from "@tabler/icons-react";

/* Pieces several workspace pages use: types, the sub-navigation, the tick, and date and duration formatting. */

export type Feature = Record<string, any>;

export type Announcement = {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  image?: string;
  created_at: string;
  scheduled_for?: string | null;
  delivered_at?: string | null;
  resource_id?: string | null;
  attachment?: { name: string; type: string; data: string };
};

export const inputClass =
  "h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#f5f2f2] placeholder:text-white/25 outline-none transition-colors focus:border-[var(--accent-peach)]/45 focus:bg-white/[0.06]";

export function Subnav({
  items,
  value,
  onChange,
  counts,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  /** Per-tab waiting counts on the sub-tab row. */
  counts?: Record<string, number>;
}) {
  return (
    <div
      className="glass-panel grid gap-1 rounded-2xl p-2"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const count = counts?.[item] || 0;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${value === item ? "border border-white/[0.08] bg-white/[0.045] text-white" : "text-white/40 hover:text-white/70"}`}
          >
            {item}
            {count ? (
              <span className="sidebar-badge">{count > 99 ? "99+" : count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (!hours) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${hours}h ${minutes}m`;
}

/** Styled checkbox that matches the dashboard look (native checkboxes read
 *  as unthemed browser controls). */
export function Check({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label || "Select"}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange?.(!checked);
      }}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-lg border transition-all ${
        checked
          ? "border-[var(--accent-peach)] bg-[var(--accent-peach)] text-[#1b1010]"
          : "border-white/20 bg-white/[0.02] hover:border-white/40"
      } ${disabled ? "cursor-not-allowed opacity-30" : ""}`}
    >
      {checked ? <IconCheck size={13} stroke={3} /> : null}
    </button>
  );
}

/** Server timestamps may arrive as naive-UTC ISO strings (no Z/offset);
 *  parse those as UTC so every display converts to the viewer's timezone. */
export function parseServerDate(value: any): Date {
  if (
    typeof value === "string" &&
    /T\d/.test(value) &&
    !/(Z|[+-]\d{2}:?\d{2})$/.test(value)
  ) {
    return new Date(`${value}Z`);
  }
  return new Date(value);
}

export function timeAgo(value: any): string {
  const date = value ? parseServerDate(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "recently";
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 90) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 45) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${Math.round(months / 12)} year${Math.round(months / 12) === 1 ? "" : "s"} ago`;
}

// The document frame matches the editor: dark by default (the editor writes
// light text on a dark page), light when the viewer's OS is in light mode.
export const DOCUMENT_FRAME_STYLE =
  "<!doctype html><style>body{font:15px/1.7 Inter,Arial;padding:48px;color:#e6e6e6;background:#1c1c1c}a{color:#f7a8c4}img{max-width:100%}table{border-collapse:collapse}@media (prefers-color-scheme: light){body{color:#171717;background:#fff}}</style>";
