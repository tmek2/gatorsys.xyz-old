"use client";

import React from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

export type ScheduleDelay = { days: number; hours: number; minutes: number };

export const EMPTY_DELAY: ScheduleDelay = { days: 0, hours: 0, minutes: 0 };

export function delayIsEmpty(delay: ScheduleDelay) {
  return !delay.days && !delay.hours && !delay.minutes;
}

/** Convert a relative delay into the ISO timestamp the bot expects. */
export function delayToIso(delay: ScheduleDelay): string | null {
  if (delayIsEmpty(delay)) return null;
  const ms =
    ((delay.days * 24 + delay.hours) * 60 + delay.minutes) * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export function describeDelay(delay: ScheduleDelay): string | null {
  if (delayIsEmpty(delay)) return null;
  const parts: string[] = [];
  if (delay.days) parts.push(`${delay.days} day${delay.days === 1 ? "" : "s"}`);
  if (delay.hours)
    parts.push(`${delay.hours} hour${delay.hours === 1 ? "" : "s"}`);
  if (delay.minutes)
    parts.push(`${delay.minutes} minute${delay.minutes === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function StepperColumn({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const step = (direction: 1 | -1) =>
    onChange((value + direction + max + 1) % (max + 1));
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => step(1)}
        className="rounded-xl p-1 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-[var(--accent-peach)]"
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <IconChevronUp size={16} />
      </button>
      <input
        inputMode="numeric"
        value={String(value).padStart(2, "0")}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(-2);
          onChange(Math.min(max, Number(digits || 0)));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            step(-1);
          }
        }}
        className={`h-12 w-14 rounded-xl border bg-[#0c0c0c] text-center font-mono text-xl font-extrabold tabular-nums outline-none transition-colors focus:border-[rgb(var(--accent-rgb)/.45)] ${value ? "border-[rgb(var(--accent-rgb)/.3)] text-white" : "border-white/[0.08] text-white/45"}`}
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => step(-1)}
        className="rounded-xl p-1 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-[var(--accent-peach)]"
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <IconChevronDown size={16} />
      </button>
      <span className="cool-text text-[10px] font-bold uppercase tracking-[0.14em]">
        {label}
      </span>
    </div>
  );
}

/**
 * A relative scheduler: three columns (days, hours, minutes) with arrows above
 * and below each value.
 */
export function ScheduleDelayPicker({
  value,
  onChange,
}: {
  value: ScheduleDelay;
  onChange: (next: ScheduleDelay) => void;
}) {
  const summary = describeDelay(value);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
      <div className="flex items-start justify-center gap-2">
        <StepperColumn
          label="Days"
          value={value.days}
          max={30}
          onChange={(days) => onChange({ ...value, days })}
        />
        <span className="mt-[38px] text-lg font-extrabold text-white/25">
          :
        </span>
        <StepperColumn
          label="Hours"
          value={value.hours}
          max={23}
          onChange={(hours) => onChange({ ...value, hours })}
        />
        <span className="mt-[38px] text-lg font-extrabold text-white/25">
          :
        </span>
        <StepperColumn
          label="Minutes"
          value={value.minutes}
          max={59}
          onChange={(minutes) => onChange({ ...value, minutes })}
        />
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 border-t border-white/[0.08] pt-2">
        <p className="cool-text text-[11px]">
          {summary ? `Posts in ${summary}` : "Posts immediately"}
        </p>
        {summary ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_DELAY)}
            className="text-[11px] font-semibold text-[var(--accent-peach)] hover:underline"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
