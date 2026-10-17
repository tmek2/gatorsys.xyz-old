"use client";

import React, { useEffect, useState } from "react";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconX,
} from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/style.css";
import { PortalMenu, usePopover } from "./pickers";

/* Date, date range and time fields, on react-day-picker. */

/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Styled date picker (the native date input's calendar ignores the theme).
 * Value is an ISO date string (yyyy-mm-dd).
 */
export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  min,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  min?: string;
}) {
  const { open, setOpen, ref, menuRef } = usePopover();
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [view, setView] = React.useState(() => {
    const base = selected || new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  React.useEffect(() => {
    if (open && selected)
      setView({ year: selected.getFullYear(), month: selected.getMonth() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const first = new Date(view.year, view.month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days: Date[] = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  const iso = (day: Date) =>
    `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const today = iso(new Date());
  const move = (delta: number) =>
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-10 w-full items-center gap-3 rounded-xl border px-4 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] transition-colors ${open ? "border-[rgb(var(--accent-rgb)/0.45)] bg-white/[0.06]" : "border-white/[0.08] bg-white/[0.04] hover:border-white/20"} ${value ? "text-[#f5f2f2]" : "text-white/30"}`}
      >
        <IconCalendar size={15} className="shrink-0 text-white/40" />
        {selected
          ? selected.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : placeholder}
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.stopPropagation();
                onChange("");
              }
            }}
            className="ml-auto rounded p-1 text-white/30 hover:text-white"
            aria-label="Clear date"
          >
            <IconX size={13} />
          </span>
        ) : null}
      </button>
      {open ? (
        <PortalMenu anchorRef={ref} menuRef={menuRef}>
          <div className="gw-pop w-72">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-extrabold text-white/85">
                {MONTHS[view.month]} {view.year}
              </p>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="rounded-xl p-2 text-white/45 hover:bg-white/[0.06] hover:text-white"
                  aria-label="Previous month"
                >
                  <IconChevronUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="rounded-xl p-2 text-white/45 hover:bg-white/[0.06] hover:text-white"
                  aria-label="Next month"
                >
                  <IconChevronDown size={15} />
                </button>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((weekday) => (
                <span
                  key={weekday}
                  className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white/45"
                >
                  {weekday}
                </span>
              ))}
              {days.map((day) => {
                const dayIso = iso(day);
                const inMonth = day.getMonth() === view.month;
                const isSelected = value === dayIso;
                const disabled = Boolean(min && dayIso < min);
                return (
                  <button
                    key={dayIso}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(dayIso);
                      setOpen(false);
                    }}
                    className={`h-8 rounded-xl text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-[var(--accent-peach)] text-[#1b1010]"
                        : dayIso === today
                          ? "border border-[var(--accent-peach)]/50 text-[var(--accent-peach)]"
                          : inMonth
                            ? "text-white/70 hover:bg-white/[0.06]"
                            : "text-white/20 hover:bg-white/[0.04]"
                    } ${disabled ? "cursor-not-allowed opacity-25" : ""}`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/[0.08] px-1 pt-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs font-semibold text-white/45 hover:text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(today);
                  setOpen(false);
                }}
                className="text-xs font-semibold text-[var(--accent-peach)] hover:text-white"
              >
                Today
              </button>
            </div>
          </div>
        </PortalMenu>
      ) : null}
    </div>
  );
}

function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isoFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Date range picker for a start-to-end span (leave periods, etc.), built on
 * react-day-picker: click a start day then an end day.
 */
export function DateRangeField({
  startValue,
  endValue,
  onChange,
  placeholder = "Pick a date range",
  min,
}: {
  startValue: string;
  endValue: string;
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  // Two months on desktop (shadcn's default), one on phones so it never
  // overflows the popover.
  const [months, setMonths] = useState(2);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const sync = () => setMonths(query.matches ? 2 : 1);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const from = parseIsoDate(startValue);
  const to = parseIsoDate(endValue);
  const minDate = parseIsoDate(min);
  // HeroUI-style segmented display: "M / D / YYYY – M / D / YYYY".
  const seg = (date: Date) => format(date, "M / d / yyyy");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-4 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] transition-colors ${open ? "border-[rgb(var(--accent-rgb)/0.45)] bg-white/[0.06]" : "border-white/[0.08] bg-white/[0.035] hover:border-white/20"}`}
        >
          <span className={`truncate tabular-nums ${from ? "text-[#f5f2f2]" : "text-white/30"}`}>
            {from ? (
              <>
                {seg(from)}
                {to ? <span className="mx-1.5 text-white/35">to</span> : null}
                {to ? seg(to) : null}
              </>
            ) : (
              placeholder
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {from || to ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange("", "");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.stopPropagation();
                    onChange("", "");
                  }
                }}
                className="rounded p-1 text-white/30 hover:text-white"
                aria-label="Clear date range"
              >
                <IconX size={13} />
              </span>
            ) : null}
            <IconCalendar size={16} className="text-white/40" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="gator-rdp gw-pop z-[190] w-auto"
      >
        <DayPicker
          mode="range"
          numberOfMonths={months}
          defaultMonth={from}
          autoFocus
          selected={from ? { from, to } : undefined}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(range: DateRange | undefined) => {
            const nextFrom = range?.from ? isoFromDate(range.from) : "";
            const nextTo = range?.to ? isoFromDate(range.to) : "";
            onChange(nextFrom, nextTo);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Styled time picker (15-minute steps) — replaces the native time input's
 *  browser-themed popup. Value is "HH:MM" 24h. */
export function TimeField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const { open, setOpen, ref, menuRef } = usePopover();
  const times: string[] = [];
  for (let h = 0; h < 24; h += 1)
    for (let m = 0; m < 60; m += 15)
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  const label = (v: string) => {
    if (!v) return "";
    const [h, m] = v.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] transition-colors disabled:opacity-35 ${open ? "border-[rgb(var(--accent-rgb)/0.45)] bg-white/[0.06]" : "border-white/[0.08] bg-white/[0.04] hover:border-white/20"} ${value ? "text-[#f5f2f2]" : "text-white/30"}`}
      >
        <IconClock size={14} className="shrink-0 text-white/40" />
        {value ? label(value) : "Time"}
      </button>
      {open ? (
        <PortalMenu anchorRef={ref} menuRef={menuRef}>
          <div className="max-h-56 w-40 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#131415] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
            {times.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={`block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${value === t ? "bg-[var(--accent-peach)] text-[#1b1010]" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
              >
                {label(t)}
              </button>
            ))}
          </div>
        </PortalMenu>
      ) : null}
    </div>
  );
}
