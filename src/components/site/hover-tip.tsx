"use client";

/* A label that belongs to the page instead of the browser's `title` tooltip
   (late, unstyled, unreachable by keyboard, invisible on touch). A wrapper, so
   it can wrap a chip, link or button.

   The label is drawn at the end of the document and positioned there, measured
   once on open: the header's controls sit just above the landing window's top
   edge, and the header is inside a sticky element (its own stacking context),
   so a label drawn inside it would be cut off by the window whatever its
   z-index. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./hover-tip.css";

/** How far under the host the label sits. */
const DROP = 9;

export type TipAlign = "center" | "end";

/**
 * Somewhere to hang a label and where to hang it from. Shared with the
 * appearance control's own two-line label.
 */
export function useTipSpot(align: TipAlign = "center") {
  const host = useRef<HTMLElement | null>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  /* Mounted, because the document is not there to draw into on the server. */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const show = useCallback(() => {
    const node = host.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    setSpot({
      x: align === "end" ? box.right : box.left + box.width / 2,
      y: box.bottom + DROP,
    });
  }, [align]);

  const hide = useCallback(() => setSpot(null), []);

  /* Focus shows the label only for keyboard focus (a click also focuses the
     control, which would leave the label stuck open). */
  const focused = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.matches(":focus-visible")) return;
      show();
    },
    [show],
  );

  /** Everything the host needs, so a caller cannot wire half of it. */
  const hostProps = {
    "data-shown": spot ? "true" : "false",
    onPointerEnter: show,
    onPointerLeave: hide,
    onFocus: focused,
    onBlur: hide,
  } as const;

  const draw = (className: string, children: ReactNode) =>
    ready && spot
      ? createPortal(
          <span
            className={className}
            data-align={align}
            role="tooltip"
            style={{ left: `${spot.x}px`, top: `${spot.y}px` }}
          >
            {children}
          </span>,
          document.body,
        )
      : null;

  return { host, hostProps, draw, shown: Boolean(spot) };
}

export function HoverTip({
  label,
  children,
  className,
  align = "center",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  /** `end` for a host sitting against the right edge of its container. */
  align?: TipAlign;
}) {
  const tip = useTipSpot(align);

  return (
    <span
      ref={tip.host as React.RefObject<HTMLSpanElement>}
      className={`g-tip-host ${className ?? ""}`}
      {...tip.hostProps}
    >
      {children}
      {tip.draw("g-tip", label)}
    </span>
  );
}
