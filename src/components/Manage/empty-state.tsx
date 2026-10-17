"use client";

import React from "react";
import Image from "next/image";
import { DoodleMark, type DoodleName } from "./doodle-mark";

/**
 * One empty state for the whole dashboard: one size, with the action inside the
 * state that asks for it.
 */
export function EmptyState({
  title,
  hint,
  action,
  compact,
  doodle,
  className,
  variant = "block",
}: {
  /** The one line that says what is missing. Not a sentence about buttons. */
  title: string;
  /** Optional second line: what happens once it exists. */
  hint?: string;
  /** The thing to do about it. Put the real button here, not "see above". */
  action?: React.ReactNode;
  /** For states nested inside a card that already has its own padding. */
  compact?: boolean;
  /** A hand-drawn doodle instead of the logo. */
  doodle?: DoodleName;
  className?: string;
  /**
   * `row`: the same state as a line inside a group's panel (whose header
   * already has the action), with no box and no mark.
   */
  variant?: "block" | "row";
}) {
  if (variant === "row") {
    return (
      <div
        className={`gator-empty gator-empty-row${className ? ` ${className}` : ""}`}
        data-empty="true"
      >
        <p className="gator-empty-title">{title}</p>
        {hint ? <p className="gator-empty-hint">{hint}</p> : null}
        {action ? <div className="gator-empty-action">{action}</div> : null}
      </div>
    );
  }
  return (
    <div
      className={`gator-empty${compact ? " gator-empty-compact" : ""}${
        className ? ` ${className}` : ""
      }`}
      data-empty="true"
    >
      {doodle ? (
        <DoodleMark name={doodle} size={52} className="gator-empty-doodle" />
      ) : (
        <Image
          src="/gator-logo.png"
          alt=""
          width={34}
          height={37}
          className="gator-empty-mark"
        />
      )}
      <p className="gator-empty-title">{title}</p>
      {hint ? <p className="gator-empty-hint">{hint}</p> : null}
      {action ? <div className="gator-empty-action">{action}</div> : null}
    </div>
  );
}

/**
 * The list's shape before the list arrives: the real card's radius, border,
 * padding, minimum height and gap, so nothing moves when data lands. Set `rows`
 * to what the panel usually holds.
 */
export function SkeletonRows({
  rows = 3,
  label = "Loading…",
  /** For rows that lead with an icon or avatar, which most of ours do. */
  lead = true,
  className,
}: {
  rows?: number;
  label?: string;
  lead?: boolean;
  className?: string;
}) {
  const count = Math.max(1, Math.min(8, rows));
  return (
    <div
      className={`gator-skeleton-list${className ? ` ${className}` : ""}`}
      // One announcement for the whole wait. Marking each bar would read the
      // skeleton out row by row, which is six announcements of nothing.
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="gator-skeleton-row" aria-hidden="true">
          {lead ? <span className="gator-skeleton-bar gator-skeleton-block" /> : null}
          <span className="gator-skeleton-text">
            <span className="gator-skeleton-bar gator-skeleton-bar-title" />
            <span className="gator-skeleton-bar gator-skeleton-bar-line" />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A single panel-shaped placeholder (an editor pane, a detail panel, a chart).
 * Tinted from the text colour, so it shows in both themes.
 */
export function SkeletonBlock({
  height = "10rem",
  label = "Loading…",
  className,
}: {
  /** Whatever the real panel measures. The point is that it does not move. */
  height?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`gator-skeleton-list${className ? ` ${className}` : ""}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <div className="gator-skeleton-panel" style={{ height }} aria-hidden="true" />
    </div>
  );
}
