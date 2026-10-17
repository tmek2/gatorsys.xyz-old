"use client";

import React from "react";
import { JellyThumb, useJellyThumb } from "@/components/motion";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** A small number beside the label: how many there are, or how many are
   *  waiting. Zero shows nothing. */
  count?: number;
  /** The count is something to act on, not a total. */
  alert?: boolean;
}

/**
 * Views of one page as a segmented control with a sliding thumb (`ModeSwitch`
 * is this for two options). Each option is its label's width plus an equal
 * share of the rest, so long labels are not cut off; the thumb is therefore
 * positioned by measuring the option.
 */
export function Segments<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
  kind = "views",
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (next: T) => void;
  label: string;
  className?: string;
  /** Views of a page (tabs), or one setting picked from a few (radios). The
   *  look is the same; what a screen reader is told differs. */
  kind?: "views" | "choice";
}) {
  const choice = kind === "choice";
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const box = React.useRef<HTMLDivElement | null>(null);
  useJellyThumb(box, `${value}:${options.length}`);
  return (
    <div
      ref={box}
      className={`gw-segs ${className}`}
      role={choice ? "radiogroup" : "tablist"}
      aria-label={label}
      style={
        {
          "--seg-n": options.length,
          "--seg-i": index,
        } as React.CSSProperties
      }
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        const next = options[(index + step + options.length) % options.length];
        onChange(next.value);
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(".gw-segs-opt");
        buttons[(index + step + options.length) % options.length]?.focus();
      }}
    >
      <JellyThumb />
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role={choice ? "radio" : "tab"}
            aria-selected={choice ? undefined : on}
            aria-checked={choice ? on : undefined}
            tabIndex={on ? 0 : -1}
            data-on={on ? "true" : undefined}
            className="gw-segs-opt"
            onClick={() => onChange(option.value)}
          >
            <span className="gw-segs-label">{option.label}</span>
            {option.count ? (
              <span className="gw-segs-count" data-alert={option.alert ? "true" : undefined}>
                {option.count > 99 ? "99+" : option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** A remembered choice of view, per page, in this browser only. */
export function useRememberedView<T extends string>(
  key: string,
  initial: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const [view, setView] = React.useState<T>(initial);
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(key) as T | null;
      if (stored && allowed.includes(stored)) setView(stored);
    } catch {}
    // Read once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const choose = React.useCallback(
    (next: T) => {
      setView(next);
      try {
        localStorage.setItem(key, next);
      } catch {}
    },
    [key],
  );
  return [view, choose];
}
