"use client";

/* Dragging a tab along the strip.

   Not Swapy (which the wall uses): Swapy moves DOM nodes itself, which is only
   safe while React's tree never changes shape, and tabs are added and removed.
   Here nothing is reordered until the drag ends. While a tab is carried, the
   tabs it passes slide over on transforms with the list untouched; the new
   order is committed once on release. Positions are read once at the start and
   stay valid, so no FLIP is needed. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/* `useLayoutEffect` warns on the server and `useEffect` runs after the first
   paint, so pick per environment. */
const useLayoutRun = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** How far a press has to travel before it is a drag rather than a press. */
const REACH = 4;
/** The strip's own gap, which a displaced tab has to cross as well. */
const GAP = 2;

type Lane = { id: number; left: number; width: number };

export interface TabDrag {
  /** The tab being carried, if any. */
  dragging: number | null;
  /** True until the click a finished drag produces has been swallowed. */
  dragged: () => boolean;
  /** How far along this tab should sit right now. */
  shift: (id: number) => number;
  stripRef: (node: HTMLElement | null) => void;
  handleProps: (id: number) => {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  };
}

export function useTabDrag(
  order: number[],
  onReorder: (from: number, to: number) => void,
): TabDrag {
  const strip = useRef<HTMLElement | null>(null);
  const stripRef = useCallback((node: HTMLElement | null) => {
    strip.current = node;
  }, []);

  const [dragging, setDragging] = useState<number | null>(null);
  /* Rendered, because every tab's position depends on it: which tabs move and
     how far follows from the two indices. */
  const [to, setTo] = useState(0);
  const [dx, setDx] = useState(0);

  const live = useRef<{
    id: number;
    from: number;
    pointer: number;
    startX: number;
    lanes: Lane[];
    bounds: { left: number; right: number };
    moved: boolean;
    /* Kept in a ref as well as state, because the release handler reads them
       immediately. */
    to: number;
    dx: number;
  } | null>(null);
  /* And what the tab has to travel once the list has been reordered under it.
     Set on release, spent on the next commit. */
  const settling = useRef<{ id: number; from: number } | null>(null);
  const swallow = useRef(false);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  /* Runs before the paint after the reorder, so the tab is never drawn at its
     new slot first and then moved. Less than half a pixel counts as there. */
  useLayoutRun(() => {
    const held = settling.current;
    if (!held) return;
    settling.current = null;
    if (Math.abs(held.from) < 0.5) return;
    const node = strip.current?.querySelector<HTMLElement>(
      `[data-tab="${held.id}"]`,
    );
    if (!node || typeof node.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    node.animate(
      [{ transform: `translateX(${held.from}px)` }, { transform: "none" }],
      { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [order]);

  const shift = useCallback(
    (id: number) => {
      const held = live.current;
      if (!held || !held.moved) return 0;
      if (id === held.id) return dx;
      const at = order.indexOf(id);
      if (at < 0) return 0;
      const step = held.lanes[held.from].width + GAP;
      if (held.from < at && at <= to) return -step;
      if (to <= at && at < held.from) return step;
      return 0;
    },
    [dx, order, to],
  );

  const handleProps = useCallback(
    (id: number) => ({
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0 && event.pointerType === "mouse") return;
        const node = strip.current;
        if (!node) return;
        const tabs = [...node.querySelectorAll<HTMLElement>("[data-tab]")];
        if (tabs.length < 2) return;

        const lanes: Lane[] = tabs.map((el) => {
          const box = el.getBoundingClientRect();
          return { id: Number(el.dataset.tab), left: box.left, width: box.width };
        });
        const from = lanes.findIndex((lane) => lane.id === id);
        if (from < 0) return;

        live.current = {
          id,
          from,
          pointer: event.pointerId,
          startX: event.clientX,
          lanes,
          /* The span the tabs occupy, so a tab can be carried to either end of
             the row and no further. */
          bounds: {
            left: lanes[0].left,
            right: lanes[lanes.length - 1].left + lanes[lanes.length - 1].width,
          },
          moved: false,
          to: from,
          dx: 0,
        };
        setTo(from);
        setDx(0);

        const move = (moveEvent: PointerEvent) => {
          const held = live.current;
          if (!held || moveEvent.pointerId !== held.pointer) return;
          const travel = moveEvent.clientX - held.startX;
          if (!held.moved) {
            if (Math.abs(travel) <= REACH) return;
            held.moved = true;
            swallow.current = true;
            setDragging(held.id);
          }

          const lane = held.lanes[held.from];
          const low = held.bounds.left - lane.left;
          const high = held.bounds.right - (lane.left + lane.width);
          const carried = Math.max(low, Math.min(high, travel));
          held.dx = carried;
          setDx(carried);

          /* Where it would land: the lane whose middle the carried tab's
             leading edge has passed (its left edge going left, its right edge
             going right). Comparing middle to middle made the front unreachable
             when the carried tab was wider than the first one. With leading
             edges nothing moves at rest, and both ends are reachable. */
          const leftEdge = lane.left + carried;
          const rightEdge = lane.left + lane.width + carried;
          let landed = held.from;
          while (
            landed + 1 < held.lanes.length &&
            rightEdge > centre(held.lanes[landed + 1])
          ) {
            landed += 1;
          }
          while (landed - 1 >= 0 && leftEdge < centre(held.lanes[landed - 1])) {
            landed -= 1;
          }
          held.to = landed;
          setTo(landed);
        };

        const end = () => {
          const held = live.current;
          stop.current?.();
          live.current = null;
          setDragging(null);
          setDx(0);
          if (!held?.moved) {
            swallow.current = false;
            return;
          }
          if (held.to !== held.from) {
            /* On release, the tab's transform is set to the offset between
               where it was let go and its new slot, so it closes only that
               small gap (moving right it lands where the passed lane ended;
               moving left, where it began). Resetting to zero while the list
               reorders would animate it from the wrong place. */
            const lane = held.lanes[held.from];
            const target = held.lanes[held.to];
            const landsAt =
              held.to > held.from
                ? target.left + target.width - lane.width
                : target.left;
            settling.current = {
              id: held.id,
              from: lane.left + held.dx - landsAt,
            };
            onReorder(held.from, held.to);
          }
          /* Cleared after the click the release produces, not before it. */
          window.setTimeout(() => {
            swallow.current = false;
          }, 0);
        };

        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        stop.current = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", end);
          stop.current = null;
        };
      },
    }),
    [onReorder],
  );

  return {
    dragging,
    dragged: () => swallow.current,
    shift,
    stripRef,
    handleProps,
  };
}

function centre(lane: Lane) {
  return lane.left + lane.width / 2;
}
