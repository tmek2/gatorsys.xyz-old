"use client";

/**
 * The corridor between a control and what it opened (the "safe triangle"):
 * while the pointer moves toward a panel, the triangle from where it left the
 * trigger to the panel's two nearest corners counts as still being on the
 * control. No panel here opens on hover, so this is used for presses (below).
 */

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

/** Is `p` inside the triangle a-b-c? Barycentric sign test, no allocations. */
function inside(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const negative = d1 < 0 || d2 < 0 || d3 < 0;
  const positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}

function within(p: Point, rect: DOMRect, slop: number): boolean {
  return (
    p.x >= rect.left - slop &&
    p.x <= rect.right + slop &&
    p.y >= rect.top - slop &&
    p.y <= rect.bottom + slop
  );
}

/** The two corners of `panel` on the side facing `from`. */
function nearCorners(panel: DOMRect, from: Point): [Point, Point] {
  if (from.y <= panel.top) {
    return [
      { x: panel.left, y: panel.top },
      { x: panel.right, y: panel.top },
    ];
  }
  if (from.y >= panel.bottom) {
    return [
      { x: panel.left, y: panel.bottom },
      { x: panel.right, y: panel.bottom },
    ];
  }
  if (from.x <= panel.left) {
    return [
      { x: panel.left, y: panel.top },
      { x: panel.left, y: panel.bottom },
    ];
  }
  return [
    { x: panel.right, y: panel.top },
    { x: panel.right, y: panel.bottom },
  ];
}

/**
 * Outside-press dismissal that ignores the gap: a press must miss the trigger,
 * the panel, and the triangle between them (the gap between a control and its
 * panel is outside both boxes).
 */
export function useSafeOutsidePress({
  open,
  anchor,
  panel,
  onPress,
  slop = 6,
}: {
  open: boolean;
  anchor: React.RefObject<HTMLElement | null>;
  panel: React.RefObject<HTMLElement | null>;
  onPress: () => void;
  slop?: number;
}) {
  const pressRef = useRef(onPress);
  pressRef.current = onPress;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const onDown = (event: PointerEvent) => {
      const here: Point = { x: event.clientX, y: event.clientY };
      const trigger = anchor.current?.getBoundingClientRect();
      const box = panel.current?.getBoundingClientRect();
      if (!box) return;
      if (within(here, box, slop)) return;
      if (trigger && within(here, trigger, slop)) return;
      if (trigger) {
        // Measured from the trigger's centre, since a press is a single point.
        const from: Point = {
          x: trigger.left + trigger.width / 2,
          y: trigger.top + trigger.height / 2,
        };
        const [a, b] = nearCorners(box, from);
        if (inside(here, from, a, b)) return;
      }
      pressRef.current();
    };

    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, anchor, panel, slop]);
}
