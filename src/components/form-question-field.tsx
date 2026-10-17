"use client";

import React, { useEffect, useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { PreviewText } from "@/components/Manage/embed-editor";
import { DateField, SelectField } from "@/components/Manage/fields";

/**
 * The form's question renderer, used by both the public form and the review
 * panel (which passes `disabled`), so a record of a form always looks like the
 * form.
 */

export interface FormQuestion {
  id: string;
  type: string;
  question: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string; image_url?: string }[];
  min?: number;
  max?: number;
  step?: number;
  max_length?: number;
  min_label?: string;
  max_label?: string;
  images?: string[];
  image_url?: string;
  display?: string;
  validation?: any[];
}

/** Keystroke/paste handlers the live form attaches to text answers. The review
 *  panel passes none — there is nothing left to measure once it is submitted. */
export type AuthorshipHandlers = {
  onPaste?: (event: React.ClipboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

/** Question images on the form — soft-edged squares side by side, click to
 *  zoom into the full image (matching the infraction proof viewer). */
export function FormQuestionImages({ images }: { images: string[] }) {
  const [zoom, setZoom] = useState<string | null>(null);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);
  if (!images.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.slice(0, 3).map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={src}
          alt=""
          onClick={() => setZoom(src)}
          className="h-28 w-28 cursor-zoom-in rounded-xl border border-white/[0.08] object-cover"
        />
      ))}
      {zoom ? (
        <button
          type="button"
          className="gator-overlay fixed inset-0 z-[250] flex cursor-zoom-out items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          onClick={() => setZoom(null)}
          aria-label="Close zoomed image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom}
            alt=""
            className="max-h-full max-w-full rounded-xl object-contain shadow-[0_28px_90px_rgba(0,0,0,.8)]"
          />
        </button>
      ) : null}
    </div>
  );
}

export function formQuestionImages(question: FormQuestion): string[] {
  if (Array.isArray(question.images))
    return question.images.filter(Boolean).slice(0, 3);
  if (question.image_url) return [question.image_url];
  return [];
}

type RobloxHit = {
  id: number;
  name: string;
  displayName?: string;
  avatarUrl?: string | null;
};

/**
 * Live Roblox username search: the applicant picks a profile from the results,
 * shown as a pill with avatar and username. The answer stores the username; a
 * separate query state drives the search so selecting does not search again.
 */
export function RobloxUserSearchField({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RobloxHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RobloxHit | null>(null);

  useEffect(() => {
    const keyword = query.trim();
    if (keyword.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    // Debounced; a request finishes and is ignored if a newer keystroke
    // superseded it. Not aborted: Roblox's search and thumbnail lookup is slow,
    // and aborting on each keystroke meant fast typists never got results.
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/roblox/search?keyword=${encodeURIComponent(keyword)}`,
          { cache: "no-store" },
        );
        const data = await res.json().catch(() => ({}));
        if (active) setResults(Array.isArray(data.users) ? data.users : []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  // A submitted answer has a username but no search behind it; it is the
  // chosen profile, so it reads as the pill rather than as an empty box.
  const settled = Boolean(value) && (disabled || selected?.name === value);
  if (settled) {
    const name = selected?.name || value;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--accent-peach)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent-peach)_10%,transparent)] px-3 py-3">
        {selected?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected.avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full bg-white/[0.06] object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white/60">
            {name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[#f5f2f2]">
            {name}
          </span>
          {selected?.displayName && selected.displayName !== name ? (
            <span className="block truncate text-xs text-white/45">
              {selected.displayName}
            </span>
          ) : null}
        </span>
        {!disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => {
              setSelected(null);
              onChange("");
              setQuery("");
            }}
            className="shrink-0 rounded-xl p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <IconX size={15} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        disabled={disabled}
        placeholder={placeholder || "Search a Roblox username…"}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-[#f5f2f2] placeholder:text-white/30 outline-none focus:border-[color-mix(in_srgb,var(--accent-peach)_45%,transparent)] disabled:opacity-50"
      />
      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#151515] p-1 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
          {loading && !results.length ? (
            <p className="px-3 py-3 text-xs text-white/40">
              Searching Roblox…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-white/40">
              No profiles found.
            </p>
          ) : (
            results.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setSelected(hit);
                  onChange(hit.name);
                  setQuery(hit.name);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/[0.06]"
              >
                {hit.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hit.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full bg-white/[0.06] object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-white/50">
                    {hit.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">
                  {hit.name}
                  {hit.displayName && hit.displayName !== hit.name ? (
                    <span className="ml-2 text-white/40">
                      ({hit.displayName})
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The options of a choice question, made safe for the renderers. Stored
 * questions are not trustworthy (half-used editors, deleted options, older
 * shapes, plain strings), and one null option used to crash the whole form.
 * Unusable options are dropped; a bare string becomes its own label and value.
 */
export function formQuestionOptions(
  question: FormQuestion,
): { value: string; label: string; image_url?: string }[] {
  const raw = (question as any)?.options;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const options: { value: string; label: string; image_url?: string }[] = [];
  raw.forEach((entry, index) => {
    if (entry === null || entry === undefined) return;
    if (typeof entry === "string" || typeof entry === "number") {
      const text = String(entry);
      if (!text || seen.has(text)) return;
      seen.add(text);
      options.push({ value: text, label: text });
      return;
    }
    if (typeof entry !== "object") return;
    const option = entry as Record<string, unknown>;
    // Value and label fall back to each other; with both blank it is an empty
    // editor row, not a choice.
    const value = String(option.value ?? option.label ?? "").trim();
    const label = String(option.label ?? option.value ?? "").trim();
    if (!value && !label) return;
    // Two options sharing a value make one un-selectable and collide as React
    // keys; the index disambiguates rather than dropping the second.
    const key = value || label;
    const unique = seen.has(key) ? `${key}-${index}` : key;
    seen.add(unique);
    options.push({
      value: unique,
      label: label || value,
      image_url:
        typeof option.image_url === "string" ? option.image_url : undefined,
    });
  });
  return options;
}

/** Just the answer control for a question, without the card around it. */
export function FormQuestionField({
  question,
  value,
  onChange,
  disabled,
  authorship,
}: {
  question: FormQuestion;
  value: any;
  onChange: (next: any) => void;
  disabled?: boolean;
  authorship?: AuthorshipHandlers;
}) {
  const q = question;
  const set = onChange;
  const hooks = authorship || {};

  if (q.type === "text_paragraph" || q.type === "text_long") {
    return (
      <textarea
        value={value || ""}
        maxLength={q.max_length || 1000}
        placeholder={q.placeholder || "Your answer"}
        disabled={disabled}
        rows={1}
        ref={(el) => {
          if (el) {
            el.style.height = "0px";
            el.style.height = `${el.scrollHeight}px`;
          }
        }}
        {...hooks}
        onChange={(e) => {
          set(e.target.value);
          e.target.style.height = "0px";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        className="w-full resize-none overflow-hidden border-0 border-b border-white/15 bg-transparent px-1 py-3 text-[15px] leading-6 text-[#f5f2f2] placeholder:text-white/30 outline-none transition-colors [color-scheme:dark] focus:border-[var(--accent-peach)] disabled:opacity-50"
      />
    );
  }

  if (q.type === "multiple_choice" && q.display === "dropdown") {
    // Our own styled dropdown (portal picker) instead of the browser's native
    // <select>, so it matches the site.
    return (
      <div className="max-w-md">
        <SelectField
          value={typeof value === "string" ? value : ""}
          placeholder="Select an option…"
          onChange={(next) => set(next || "")}
          options={formQuestionOptions(q).map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </div>
    );
  }

  if (q.type === "multiple_choice" || q.type === "multiple_choice_multi") {
    const multi = q.type === "multiple_choice_multi";
    return (
      <div className="space-y-2">
        {formQuestionOptions(q).map((option) => {
          const checked = multi
            ? Array.isArray(value) && value.includes(option.value)
            : value === option.value;
          return (
            <label
              key={option.value}
              className={`flex items-center gap-3 rounded-xl border px-4 py-4 text-[15px] transition-colors ${
                disabled ? "" : "cursor-pointer"
              } ${
                checked
                  ? "border-[color-mix(in_srgb,var(--accent-peach)_50%,transparent)] bg-[color-mix(in_srgb,var(--accent-peach)_12%,transparent)] text-[#f5f2f2]"
                  : disabled
                    ? "border-white/[0.08] bg-white/[0.02] text-white/60"
                    : "border-white/[0.08] bg-white/[0.02] text-white/75 hover:border-white/25 hover:bg-white/[0.02]"
              }`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={q.id}
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  if (multi) {
                    const arr = Array.isArray(value) ? value : [];
                    set(
                      checked
                        ? arr.filter((v: string) => v !== option.value)
                        : [...arr, option.value],
                    );
                  } else {
                    set(option.value);
                  }
                }}
                className="sr-only"
              />
              {/* Custom indicator — crisp fill, not the basic native control. */}
              <span
                className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center border-[1.5px] transition-colors ${
                  multi ? "rounded-[6px]" : "rounded-full"
                } ${
                  checked
                    ? "border-[var(--accent-peach)] bg-[var(--accent-peach)] text-[#20140f]"
                    : "border-white/30 bg-transparent"
                }`}
              >
                {checked ? (
                  multi ? (
                    <IconCheck size={13} strokeWidth={3} />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[#20140f]" />
                  )
                ) : null}
              </span>
              <span className="min-w-0 flex-1">{option.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (q.type === "image_selection") {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {formQuestionOptions(q).map((option) => {
          const checked = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => set(option.value)}
              className={`overflow-hidden rounded-xl border text-left transition-colors ${
                checked
                  ? "border-[color-mix(in_srgb,var(--accent-peach)_60%,transparent)] bg-[color-mix(in_srgb,var(--accent-peach)_8%,transparent)]"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/25"
              }`}
            >
              {option.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={option.image_url}
                  alt={option.label}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <span className="flex h-24 w-full items-center justify-center bg-white/[0.02] text-xs text-white/40">
                  no image
                </span>
              )}
              <span
                className={`block px-3 py-2 text-[13px] font-semibold ${
                  checked ? "text-[#f5f2f2]" : "text-white/70"
                }`}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "rating") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: q.max ?? 5 }, (_, i) => i + 1).map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => set(n)}
              aria-label={`Rating ${n} of ${q.max ?? 5}`}
              aria-pressed={active}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border text-base font-bold transition-all ${
                active
                  ? "border-[rgb(var(--accent-rgb)/0.6)] bg-[rgb(var(--accent-rgb)/0.16)] text-[var(--accent-peach)] scale-105"
                  : "border-white/12 bg-white/[0.02] text-white/55 hover:border-white/25 hover:text-white"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "range_slider") {
    return (
      <div className="flex items-center gap-3">
        <span className="cool-text text-xs">{q.min ?? 1}</span>
        <input
          type="range"
          min={q.min ?? 1}
          max={q.max ?? 10}
          step={q.step ?? 1}
          value={typeof value === "number" ? value : (q.min ?? 1)}
          disabled={disabled}
          onChange={(e) => set(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--accent-peach)]"
        />
        <span className="cool-text text-xs">{q.max ?? 10}</span>
        <span className="min-w-[2.5rem] rounded-xl bg-white/[0.06] px-2 py-1 text-center text-xs font-bold text-[#f5f2f2]">
          {typeof value === "number" ? value : "-"}
        </span>
      </div>
    );
  }

  if (q.type === "range") {
    return (
      <div className="flex items-end gap-3">
        {q.min_label ? (
          <span className="shrink-0 pb-1 text-sm text-white/55">
            {q.min_label}
          </span>
        ) : null}
        <div className="flex flex-1 items-end justify-between gap-2">
          {Array.from(
            { length: (q.max ?? 5) - (q.min ?? 1) + 1 },
            (_, i) => (q.min ?? 1) + i,
          ).map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => set(n)}
              className="group flex flex-col items-center gap-2"
              aria-label={`Select ${n}`}
            >
              <span
                className={`text-xs font-bold transition-colors ${
                  value === n ? "text-[var(--accent-peach)]" : "text-white/45"
                }`}
              >
                {n}
              </span>
              <span
                className={`h-5 w-5 rounded-full border-2 transition-colors ${
                  value === n
                    ? "border-[var(--accent-peach)] bg-[var(--accent-peach)]"
                    : "border-white/25 group-hover:border-white/50"
                }`}
              />
            </button>
          ))}
        </div>
        {q.max_label ? (
          <span className="shrink-0 pb-1 text-sm text-white/55">
            {q.max_label}
          </span>
        ) : null}
      </div>
    );
  }

  if (q.type === "roblox_user_search") {
    return (
      <RobloxUserSearchField
        value={value || ""}
        disabled={disabled}
        placeholder={q.placeholder}
        onChange={set}
      />
    );
  }

  if (q.type === "boolean") {
    return (
      <label
        className={`flex items-center gap-3 text-sm text-white/70 ${disabled ? "" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => set(e.target.checked)}
          className="accent-[var(--accent-peach)]"
        />
        Yes
      </label>
    );
  }

  if (q.type === "date") {
    // Themed calendar (same as the dashboard) instead of the browser's native
    // date popup. A submitted date is text, not a picker to open.
    if (disabled) {
      return (
        <p className="border-0 border-b border-white/15 px-1 py-3 text-[15px] text-[#f5f2f2]">
          {typeof value === "string" && value ? (
            value
          ) : (
            <span className="text-white/30">No answer</span>
          )}
        </p>
      );
    }
    return (
      <div className="max-w-xs">
        <DateField
          value={typeof value === "string" ? value : ""}
          placeholder={q.placeholder || "Pick a date"}
          onChange={set}
        />
      </div>
    );
  }

  return (
    <input
      type={
        q.type === "email"
          ? "email"
          : q.type === "phone"
            ? "tel"
            : q.type === "website"
              ? "url"
              : q.type === "date"
                ? "date"
                : q.type === "time"
                  ? "time"
                  : "text"
      }
      value={value || ""}
      maxLength={q.max_length || 254}
      placeholder={
        q.placeholder ||
        (q.type === "website"
          ? "https://…"
          : q.type === "phone"
            ? "+1 555 000 0000"
            : "Your answer")
      }
      disabled={disabled}
      {...hooks}
      onChange={(e) => set(e.target.value)}
      className="w-full border-0 border-b border-white/15 bg-transparent px-1 py-3 text-[15px] text-[#f5f2f2] placeholder:text-white/30 outline-none transition-colors [color-scheme:dark] focus:border-[var(--accent-peach)] disabled:opacity-50"
    />
  );
}

/**
 * A question as the applicant sees it: the card, heading, images and answer
 * control. `aside` sits beside the heading and `footer` under the answer (where
 * the review panel puts authorship hints).
 */
export function FormQuestionCard({
  question,
  value,
  onChange,
  disabled,
  authorship,
  aside,
  footer,
}: {
  question: FormQuestion;
  value: any;
  onChange: (next: any) => void;
  disabled?: boolean;
  authorship?: AuthorshipHandlers;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (question.type === "section") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#141414] px-6 py-5 sm:px-7">
        <h3 className="text-xl font-extrabold text-[#f5f2f2]">
          {question.question}
        </h3>
        {question.description ? (
          <div className="mt-1 text-pretty text-[13px] leading-relaxed text-white/55">
            <PreviewText text={question.description} />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    // `data-question-id` lets container-level keystroke and paste capture
    // attribute each signal to its question (the department form does this).
    <div
      data-question-id={question.id}
      className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <label className="block flex-1 text-lg font-semibold text-[#f5f2f2]">
          {question.question}
          {question.required !== false ? (
            <span className="group/req relative ml-1 inline-flex align-middle">
              <span className="cursor-default text-[var(--tone-bad)]">*</span>
              <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/[0.08] bg-[#0d0d0d] px-3 py-2 text-[11px] font-medium text-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.55)] group-hover/req:block">
                Required
              </span>
            </span>
          ) : null}
        </label>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {question.description ? (
        <div className="mt-1 text-pretty text-[13px] leading-relaxed text-white/55">
          <PreviewText text={question.description} />
        </div>
      ) : null}
      <FormQuestionImages images={formQuestionImages(question)} />
      <div className="mt-3">
        <FormQuestionField
          question={question}
          value={value}
          onChange={onChange}
          disabled={disabled}
          authorship={authorship}
        />
      </div>
      {footer}
    </div>
  );
}
