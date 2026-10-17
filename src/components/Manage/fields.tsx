"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconMinus, IconPlus, IconX } from "@tabler/icons-react";
import { PresenceList } from "@/components/motion";
import { SelectField } from "./fields/pickers";

/* The parts' public names, so importers keep using this path. */
export { ColorPicker } from "./fields/color-picker";
export {
  ChannelPicker,
  MultiSelectField,
  PortalMenu,
  RolePicker,
  SelectField,
  usePopover,
} from "./fields/pickers";
export { DateField, DateRangeField, TimeField } from "./fields/dates";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/** The heading every settings surface uses, defined once. */
export function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    /* The same heading style as the schema tabs. */
    <h3 className={`gw-h3 ${className}`}>{children}</h3>
  );
}

/* A settings group drawn like the schema tabs' panels: the name and one line in
   the header row, the action at its end, and each part below ruled off from the
   next. */
export function SettingsCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="gw-set gw-card">
      <div className="gw-set-panel">
        <div className="gw-set-head" data-static="true">
          <span className="gw-set-head-copy">
            <span className="gw-set-head-name">{title}</span>
            {description ? (
              <span className="gw-set-head-say">{description}</span>
            ) : null}
          </span>
          {actions ? <span className="gw-card-acts">{actions}</span> : null}
        </div>
        <div className="gw-card-body">{children}</div>
      </div>
    </section>
  );
}

/* A labelled control inside a card: name, one line, and the control under them,
   in the same type as a schema row. */
export function FieldRow({
  label,
  description,
  hint,
  children,
  trailing,
  inline = false,
}: {
  label: string;
  description?: string;
  hint?: string;
  children: React.ReactNode;
  /**
   * A small slot on the label line (a character counter, a status), kept
   * visible while the control is in use.
   */
  trailing?: React.ReactNode;
  inline?: boolean;
}) {
  description = description || hint;
  /* A label plus a bare switch becomes an option card, converted here rather
     than at each call site. */
  if (inline && React.isValidElement(children) && children.type === Toggle) {
    const toggle = children.props as React.ComponentProps<typeof Toggle>;
    return (
      <OptionCard
        label={label}
        description={description}
        checked={toggle.checked}
        onChange={toggle.onChange}
        disabled={toggle.disabled}
        wide
      />
    );
  }
  if (inline) {
    // A short control (a number, a button) sits under its name at its own
    // width.
    return (
      <div className="gw-field-row" data-inline="true">
        <div className="gw-field-row-copy">
          <p className="gw-set-name">{label}</p>
          {description ? <p className="gw-set-note">{description}</p> : null}
        </div>
        <div className="gw-field-row-end">{children}</div>
      </div>
    );
  }
  return (
    <div className="gw-field-row">
      <div className="gw-field-row-head">
        <p className="gw-set-name">{label}</p>
        {trailing ? <span className="gw-field-row-trail">{trailing}</span> : null}
      </div>
      {description ? <p className="gw-set-note">{description}</p> : null}
      <div className="gw-field-row-control">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  // The shared switch for every settings surface. The knob moves with a
  // transform.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-state={checked ? "on" : "off"}
      className={`gator-switch relative h-7 w-12 shrink-0 rounded-full border focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? "border-[var(--accent-peach)] bg-[var(--accent-peach)]"
          : "border-white/12 bg-[#292529]"
      }`}
    >
      <span
        className={`gator-switch-knob absolute left-[3px] top-[3px] size-[20px] rounded-full bg-[#fff8f3] shadow-[0_1px_2px_rgba(0,0,0,0.28)] ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/**
 * An on/off setting as a card you press. `OptionCard` holds its own state; the
 * schema's `OptionTile` is this wired to a config path.
 */
export function OptionCard({
  checked,
  onChange,
  label,
  description,
  disabled,
  wide = false,
  compact = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
  /** The whole width of its grid: a group's own master switch. */
  wide?: boolean;
  /** Inside a dense editor: a pill of an option, the width of its words. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="gw-opt"
      data-on={checked ? "true" : "false"}
      data-wide={wide ? "true" : undefined}
      data-size={compact ? "compact" : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="gw-opt-fill" aria-hidden="true" />
      <span className="gw-opt-mark" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M4 8.4l2.6 2.6L12 5.6" />
        </svg>
      </span>
      <span className="gw-opt-copy">
        <span className="gw-opt-name">{label}</span>
        {description ? <span className="gw-opt-say">{description}</span> : null}
      </span>
    </button>
  );
}

/** What only matters while something is on: rolled away while it is off,
 *  and out of the tab order with it. The same roll as a settings group. */
export function Reveal({ when, children }: { when: boolean; children: React.ReactNode }) {
  return (
    <div className="gw-set-roll" data-open={when ? "true" : "false"}>
      <div className="gw-set-roll-clip" inert={!when}>
        {children}
      </div>
    </div>
  );
}

/** Option cards side by side: one column on a phone, more as there is room. */
export function OptionCards({ children }: { children: React.ReactNode }) {
  return <div className="gw-opts">{children}</div>;
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <OptionCard
      label={label}
      description={description}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      wide
    />
  );
}

/* ------------------------------------------------------------------ */
/* Text-ish inputs                                                     */
/* ------------------------------------------------------------------ */

// The one text field. Its look is `.gw-field` in manage-window.css.
const inputClass = "gw-field w-full";

export function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  );
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  trailing,
  autoGrow = true,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  trailing?: React.ReactNode;
  /** Grow to fit the content as you type instead of scrolling inside a fixed
      box. On by default; pass false to keep a fixed, manually-resizable box. */
  autoGrow?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el || !autoGrow) return;
    // Reset first so the box can shrink when text is deleted, then grow to fit.
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow]);

  // Re-fit whenever the value changes (typing, paste, or external updates).
  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        style={autoGrow ? { minHeight: `${rows * 1.7}em` } : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          resize();
        }}
        className={`${inputClass} leading-relaxed ${
          autoGrow ? "resize-none overflow-hidden" : "resize-y"
        } ${trailing ? "pr-12" : ""}`}
      />
      {trailing ? (
        <div className="absolute bottom-2 right-2 z-10">{trailing}</div>
      ) : null}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  placeholder,
  min,
  max,
  compact = false,
}: {
  value: number | "";
  onChange: (next: number | "") => void;
  placeholder?: string;
  min?: number;
  max?: number;
  /** Narrow width for inline steppers (min/max/step) instead of full width. */
  compact?: boolean;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(event) => {
        if (event.target.value === "") return onChange("");
        let next = Number(event.target.value);
        if (typeof max === "number" && next > max) next = max;
        if (typeof min === "number" && next < min) next = min;
        onChange(next);
      }}
      className={`${inputClass}${compact ? " w-24" : ""}`}
    />
  );
}

/**
 * A number in a short range set with minus and plus. The value and unit read as
 * one phrase, the number rolls in the direction it changed, and the ends of the
 * range disable the buttons.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step: by = 1,
  unit,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** How far one press moves it: ten seconds, not one. */
  step?: number;
  /** The unit, singular and plural: `["reply", "replies"]`. */
  unit?: [string, string];
  /** What the count is, for a screen reader. */
  label: string;
}) {
  const last = useRef(value);
  // Only once it has moved: a count does not roll in when the page opens.
  const dir = value > last.current ? "up" : value < last.current ? "down" : undefined;
  useEffect(() => {
    last.current = value;
  }, [value]);
  const step = (direction: number) => onChange(Math.min(max, Math.max(min, value + direction * by)));
  return (
    <div
      className="gw-stepper"
      role="group"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowRight") {
          event.preventDefault();
          step(1);
        } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
          event.preventDefault();
          step(-1);
        }
      }}
    >
      <button
        type="button"
        className="gw-stepper-btn"
        aria-label="Fewer"
        disabled={value <= min}
        onClick={() => step(-1)}
      >
        <IconMinus size={15} stroke={2.2} />
      </button>
      <span className="gw-stepper-value" aria-live="polite">
        <span key={value} className="gw-stepper-num" data-dir={dir}>
          {value}
        </span>
        {unit ? <span className="gw-stepper-unit">{value === 1 ? unit[0] : unit[1]}</span> : null}
      </span>
      <button
        type="button"
        className="gw-stepper-btn"
        aria-label="More"
        disabled={value >= max}
        onClick={() => step(1)}
      >
        <IconPlus size={15} stroke={2.2} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Duration (preset dropdown + custom)                                 */
/* ------------------------------------------------------------------ */

export type DurationUnit = "seconds" | "minutes" | "hours" | "days";

/** Presets per unit. Values are plain numbers in the field's own unit, so
 *  whatever the bot already stored keeps working. */
const DURATION_PRESETS: Record<DurationUnit, { label: string; value: number }[]> = {
  seconds: [
    { label: "30 seconds", value: 30 },
    { label: "1 minute", value: 60 },
    { label: "5 minutes", value: 300 },
    { label: "15 minutes", value: 900 },
    { label: "30 minutes", value: 1800 },
    { label: "1 hour", value: 3600 },
    { label: "6 hours", value: 21600 },
    { label: "12 hours", value: 43200 },
    { label: "1 day", value: 86400 },
    { label: "1 week", value: 604800 },
  ],
  minutes: [
    { label: "5 minutes", value: 5 },
    { label: "15 minutes", value: 15 },
    { label: "30 minutes", value: 30 },
    { label: "1 hour", value: 60 },
    { label: "6 hours", value: 360 },
    { label: "12 hours", value: 720 },
    { label: "1 day", value: 1440 },
    { label: "1 week", value: 10080 },
  ],
  hours: [
    { label: "1 hour", value: 1 },
    { label: "6 hours", value: 6 },
    { label: "12 hours", value: 12 },
    { label: "1 day", value: 24 },
    { label: "2 days", value: 48 },
    { label: "3 days", value: 72 },
    { label: "1 week", value: 168 },
    { label: "2 weeks", value: 336 },
  ],
  days: [
    { label: "1 day", value: 1 },
    { label: "2 days", value: 2 },
    { label: "3 days", value: 3 },
    { label: "1 week", value: 7 },
    { label: "2 weeks", value: 14 },
    { label: "30 days", value: 30 },
  ],
};

export function DurationField({
  unit,
  value,
  min,
  max,
  onChange,
}: {
  unit: DurationUnit;
  value: number | null;
  min?: number;
  max?: number;
  onChange: (next: number | null) => void;
}) {
  const presets = DURATION_PRESETS[unit] || DURATION_PRESETS.days;
  const matchesPreset = value != null && presets.some((preset) => preset.value === value);
  const [custom, setCustom] = useState(value != null && !matchesPreset);

  const selected = custom ? "custom" : value != null ? String(value) : null;

  return (
    <div className="space-y-2">
      <SelectField
        value={selected}
        placeholder="Select a preset or custom"
        options={[
          ...presets.map((preset) => ({ value: String(preset.value), label: preset.label })),
          { value: "custom", label: "Custom duration" },
        ]}
        onChange={(next) => {
          if (next === "custom") {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(next == null || next === "" ? null : Number(next));
        }}
      />
      {custom ? (
        <div className="flex items-center gap-2">
          <NumberField
            value={value ?? ""}
            min={min}
            max={max}
            onChange={(next) => onChange(next === "" ? null : Number(next))}
          />
          <span className="cool-text text-xs">{unit}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* String list editor (preset reasons, infraction types, ...)          */
/* ------------------------------------------------------------------ */

const LIST_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

function reducedMotion(): boolean {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/**
 * FLIP for a wrapping list: items slide to their new positions instead of
 * jumping (removing one chip shifts the rest, wrapping some to the line above).
 * Positions are relative to the list, so page scrolling is not mistaken for
 * movement.
 */
function useFlipList(ref: React.RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    const still = reducedMotion();
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((element) => {
      const id = element.dataset.flip || "";
      const box = element.getBoundingClientRect();
      const at = { x: box.left - origin.left, y: box.top - origin.top };
      next.set(id, at);
      const was = last.current.get(id);
      if (!was || still) return;
      const dx = was.x - at.x;
      const dy = was.y - at.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 420, easing: LIST_EASE },
      );
    });
    last.current = next;
  }, [ref, key]);
}

export function StringListEditor({
  values,
  onChange,
  placeholder = "Add an item…",
  addLabel = "Add",
  maxItems = 50,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  maxItems?: number;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  // Chips added, removed or restored by Discard all animate the same way, and
  // the rest slide over.
  useFlipList(listRef, values.join("\u0000"));

  const duplicate = draft.trim() !== "" && values.includes(draft.trim());

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || values.includes(trimmed) || values.length >= maxItems)
      return;
    onChange([...values, trimmed]);
    setDraft("");
  }

  return (
    <div className="gw-chips-editor">
      <div ref={listRef}>
        <PresenceList
          items={values}
          keys={values}
          inline
          exitMs={200}
          className="gw-chips"
          render={(item) => (
            <span data-flip={item} className="gw-chip">
              <span className="gw-chip-name">{item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="gw-chip-x"
                onClick={() => onChange(values.filter((v) => v !== item))}
              >
                <IconX size={12} stroke={2.5} />
              </button>
            </span>
          )}
        />
      </div>
      <div className="gw-chips-add">
        <input
          value={draft}
          placeholder={placeholder}
          aria-invalid={duplicate || undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || duplicate}
          className="gw-chips-go"
        >
          <IconPlus size={14} stroke={2.2} aria-hidden="true" />
          {addLabel}
        </button>
      </div>
      {duplicate ? <p className="gw-chips-dup">Already on the list.</p> : null}
    </div>
  );
}
