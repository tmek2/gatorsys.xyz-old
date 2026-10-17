"use client";

/* The ripple button, after Animate UI's `<RippleButton>` with a
   `<RippleButtonRipples />` child, `variant` and `size`, with four changes: -
   The waves layer reads ripples from context and is placed by this component
   (see below). - The palette is the site's, not shadcn's tokens. - `as` can
   make it a link (`a` or Next's `Link`), since many rippling actions navigate.
   - Keyboard activation ripples from the centre.

   Ripples are keyed by a counter, not a timestamp (two clicks in one
   millisecond are two ripples). */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { useTilt } from "./tilt";
import "./ripple-button.css";

interface Ripple {
  x: number;
  y: number;
  size: number;
  key: number;
}

export type RippleVariant =
  | "default"
  | "outline"
  | "ghost"
  | "secondary"
  | "destructive";
export type RippleSize = "sm" | "default" | "lg" | "icon" | "icon-sm";

const RippleContext = createContext<Ripple[]>([]);

/** Ripple state for a host that is not a `RippleButton` — a card, a row. */
export function useRipples(duration = 600) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const seq = useRef(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  const spawn = useCallback(
    (host: HTMLElement, clientX?: number, clientY?: number) => {
      if (reduced.current) return;
      const rect = host.getBoundingClientRect();
      // Big enough that the circle still covers the far corner from anywhere
      // inside the host, which a `max(width, height)` circle does not.
      const size = Math.hypot(rect.width, rect.height) * 2;
      const cx = clientX ?? rect.left + rect.width / 2;
      const cy = clientY ?? rect.top + rect.height / 2;
      seq.current += 1;
      setRipples((current) => [
        ...current,
        {
          x: cx - rect.left - size / 2,
          y: cy - rect.top - size / 2,
          size,
          key: seq.current,
        },
      ]);
    },
    [],
  );

  useEffect(() => {
    if (ripples.length === 0) return;
    const oldest = ripples[0].key;
    const timer = window.setTimeout(
      () => setRipples((current) => current.filter((r) => r.key !== oldest)),
      duration,
    );
    return () => window.clearTimeout(timer);
  }, [ripples, duration]);

  return { ripples, spawn };
}

/** The waves themselves. Placed as a child so its stacking is the caller's. */
export function RippleButtonRipples({
  color,
  duration = 600,
}: {
  /** Defaults to whatever `--ripple` resolves to for the variant. */
  color?: string;
  duration?: number;
}) {
  const ripples = useContext(RippleContext);
  return (
    <span className="g-ripple-field" aria-hidden="true">
      {ripples.map((r) => (
        <span
          className="g-ripple-wave"
          key={r.key}
          style={
            {
              width: r.size,
              height: r.size,
              top: r.y,
              left: r.x,
              background: color ?? "var(--ripple)",
              "--duration": `${duration}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

export interface RippleButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: RippleVariant;
  size?: RippleSize;
  duration?: number;
  /** `button` by default. `a`, or Next's `Link`, for anything that navigates. */
  as?: React.ElementType;
  /* The anchor attributes this site uses when `as` makes it a link; anything
     else should be added deliberately. */
  href?: string;
  target?: string;
  rel?: string;
  download?: boolean | string;
}

export const RippleButton = React.forwardRef<HTMLElement, RippleButtonProps>(
  function RippleButton(
    {
      className,
      children,
      variant = "default",
      size = "default",
      duration = 600,
      as,
      onClick,
      onKeyUp,
      onPointerMove,
      onPointerLeave,
      ...props
    },
    ref,
  ) {
    const Tag = (as ?? "button") as React.ElementType;
    const { ripples, spawn } = useRipples(duration);
    // Six degrees corner to corner. See `tilt.ts` for why a card gets fewer.
    const tilt = useTilt(6);
    const value = useMemo(() => ripples, [ripples]);
    const content = React.Children.toArray(children).filter(
      (child) =>
        !(React.isValidElement(child) && child.type === RippleButtonRipples),
    );

    return (
      <RippleContext.Provider value={value}>
        <Tag
          ref={ref as never}
          className={cn("g-ripple", className)}
          data-variant={variant}
          data-size={size}
          // `type` is meaningless on an anchor and React warns about it.
          {...(Tag === "button" ? { type: "button" } : {})}
          onClick={(event: React.MouseEvent<HTMLElement>) => {
            spawn(event.currentTarget, event.clientX, event.clientY);
            (onClick as never as (e: unknown) => void)?.(event);
          }}
          onKeyUp={(event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              spawn(event.currentTarget);
            }
            (onKeyUp as never as (e: unknown) => void)?.(event);
          }}
          onPointerMove={(event: React.PointerEvent<HTMLElement>) => {
            tilt.track(event);
            (onPointerMove as never as (e: unknown) => void)?.(event);
          }}
          onPointerLeave={(event: React.PointerEvent<HTMLElement>) => {
            tilt.rest(event);
            (onPointerLeave as never as (e: unknown) => void)?.(event);
          }}
          {...props}
        >
          {/* The ripple layer is lifted out of `children` and rendered here, so
             it never ends up inside the label over the text, a button without
             it still ripples, and there is never a second layer. */}
          <span className="g-ripple-label">{content}</span>
          <RippleButtonRipples duration={duration} />
        </Tag>
      </RippleContext.Provider>
    );
  },
);
