import React from "react";

/**
 * Status indicators: one geometry and five tones, in both themes (see the tone
 * tokens in globals.css).
 */

export type Tone = "ok" | "warn" | "bad" | "info" | "idle";

/** The dot alone, for a row that already says its state in words. */
export function StatusDot({
  tone = "idle",
  pulse,
  className,
}: {
  tone?: Tone;
  /** Only for genuinely live state — a running shift, an open session. A dot
   *  that pulses for something static is an alarm nobody can turn off. */
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={`gator-dot${pulse ? " gator-dot-live" : ""}${
        className ? ` ${className}` : ""
      }`}
    />
  );
}

/**
 * Dot and label as a pill. `children` is the label, so a caller can include a
 * count or name.
 */
export function StatusPill({
  tone = "idle",
  pulse,
  dot = true,
  children,
  className,
  title,
}: {
  tone?: Tone;
  pulse?: boolean;
  /** Off for a pill that is a tag rather than a state — a plan name, a type. */
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      data-tone={tone}
      title={title}
      className={`gator-pill${className ? ` ${className}` : ""}`}
    >
      {dot ? <StatusDot tone={tone} pulse={pulse} /> : null}
      {children}
    </span>
  );
}

/**
 * The colour swatch beside a Discord role or rank (the role's own colour), with
 * one size and one fallback grey for uncoloured roles.
 */
export function RoleSwatch({
  color,
  className,
}: {
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`gator-swatch${className ? ` ${className}` : ""}`}
      // Discord's own colour for a role that has none. One grey, named once.
      style={{ backgroundColor: color || "#99aab5" }}
    />
  );
}
