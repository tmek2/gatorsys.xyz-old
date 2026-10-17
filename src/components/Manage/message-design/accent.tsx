"use client";

import React from "react";
import { IconMinus } from "@tabler/icons-react";
import { ColorPicker } from "../fields";
import { V2_COLOR_HEX_FOR_JSON } from "../discord-json";

/* A container's accent colour: the named colours the bot resolves, and the picker. */

/**
 * Named accents a stored `v2_color` may hold, and the colour each draws. Only
 * for reading saved values: the picker writes hex, because Discord's
 * `accent_color` is an RGB integer. The bot's copy is `utils/accent_colors.py`;
 * the two must agree.
 */
/**
 * Defined in discord-json (which imports nothing from here, avoiding a cycle)
 * and re-exported under the existing name.
 */
export const V2_COLOR_HEX = V2_COLOR_HEX_FOR_JSON;

/**
 * The colour a stored accent draws, or null. Mirrors the bot's
 * `resolve_accent`: a name, `#rrggbb` with or without the hash, or nothing.
 * Anything unrecognised is no accent, matching the renderer.
 */
export function accentHex(value: string | undefined | null): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text || text === "none") return null;
  const named = V2_COLOR_HEX[text];
  if (named) return named;
  const raw = text.startsWith("#") ? text.slice(1) : text;
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${raw.split("").map((character) => character + character).join("")}`;
  }
  return /^[0-9a-f]{6}$/.test(raw) ? `#${raw}` : null;
}

/**
 * The container's accent colour: the dashboard's `ColorPicker` plus a "no
 * accent" option.
 */
export function AccentSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const hex = accentHex(value);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={hex === null}
        onClick={() => onChange(hex === null ? "#5865f2" : "none")}
        title={hex === null ? "Give this container an accent" : "Remove the accent"}
        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
          hex === null
            ? "border-[var(--accent-peach)]/45 bg-[rgb(var(--accent-rgb)/0.14)] text-[var(--accent-peach)]"
            : "border-white/[0.08] bg-white/[0.04] text-white/50 hover:text-white"
        }`}
      >
        <IconMinus size={13} />
        No accent
      </button>
      {/* Hidden rather than disabled while off: a greyed-out picker showing
          some colour invites the reading that the colour is still in effect. */}
      {hex === null ? null : (
        <div className="min-w-[200px] flex-1">
          <ColorPicker value={hex} onChange={onChange} label="Container accent colour" />
        </div>
      )}
    </div>
  );
}
