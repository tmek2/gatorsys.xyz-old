"use client";

/* One pointer physics for every surface: the surface tips like a panel on a
   pivot, dipping on the side you point at and rising on the other, with a fixed
   light so the raised side brightens and the dipped side darkens. The tilt,
   shading and rim all derive from one number (the pointer's position in the
   box), so they agree, and one shared hook keeps buttons and cards consistent.

   The magnitude is the caller's: small controls take the full six degrees,
   bigger surfaces less.

   The position is written to the node as custom properties, so React never
   re-renders on pointer moves.

   Mouse only, and off under reduced motion.

   Smoothing is a frame loop. The pointer is read on the event and the surface
   advanced once per frame on one time constant, frame-rate independent via `1 -
   exp(-dt/tau)`. (A CSS transition restarted by each event follows the event
   clock and steps unevenly.) The loop runs only while the pointer is on a
   surface and while it settles afterwards, then cancels itself. */

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import "./tilt.css";

/** Half the rim band, in px: the near edge shades by this, the far edge lights. */
const RIM = 1.5;
/** How long a measured box is trusted, in ms. */
const FRESH = 180;
/**
 * Time constants in ms: following the pointer (40ms, about 2.5 frames: absorbs
 * jitter without feeling late) and letting go (four times longer, so it relaxes
 * slowly).
 */
const TAU_TRACK = 40;
const TAU_REST = 170;
/** Below this, in degrees and percent, it has arrived and the loop can stop. */
const SETTLED = 0.01;

interface Surface {
  node: HTMLElement;
  /** Where the box was when the pointer arrived, and when that was read. */
  left: number;
  top: number;
  width: number;
  height: number;
  at: number;
  /** Where the pointer wants it, 0 to 1 in each axis, and where it is now. */
  toX: number;
  toY: number;
  x: number;
  y: number;
  /* Every pointer position since the last frame, summed. Mice report faster
     than the screen refreshes, so frames hold two events, then one, then two;
     the mean advances evenly where the newest would not. Costs about 4ms of
     lag. */
  sumX: number;
  sumY: number;
  seen: number;
  /** Is the pointer still on it? */
  held: boolean;
}

export function useTilt(max: number) {
  const able = useRef(false);
  const live = useRef<Surface | null>(null);
  const frame = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    able.current =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  /** One write of all six, from the smoothed position. */
  const draw = useCallback(
    (surface: Surface) => {
      const { node, x, y } = surface;
      // Positive `rotateX` sends the top edge away, positive `rotateY` sends
      // the right edge away — so both are signed to dip the side pointed at.
      node.style.setProperty("--tilt-x", `${(0.5 - y) * 2 * max}deg`);
      node.style.setProperty("--tilt-y", `${(x - 0.5) * 2 * max}deg`);
      node.style.setProperty("--tilt-px", `${x * 100}%`);
      node.style.setProperty("--tilt-py", `${y * 100}%`);
      // An inset shadow offset down-right shades the top and left insides, so
      // these carry the same sign as the dip.
      node.style.setProperty("--rim-x", `${(0.5 - x) * 2 * RIM}px`);
      node.style.setProperty("--rim-y", `${(0.5 - y) * 2 * RIM}px`);
    },
    [max],
  );

  const step = useCallback(
    (now: number) => {
      frame.current = 0;
      const surface = live.current;
      if (!surface) return;

      /* Frame-rate independent, and clamped: rAF can return a timestamp earlier
         than the `performance.now()` taken in the handler, and a negative delta
         would step backwards. */
      const delta = Math.min(Math.max(now - (last.current || now), 1), 64);
      last.current = now;
      /* The frame's target: the average of what the pointer said since the
         last one, or the last target if it said nothing. */
      if (surface.seen > 0) {
        surface.toX = surface.sumX / surface.seen;
        surface.toY = surface.sumY / surface.seen;
        surface.sumX = 0;
        surface.sumY = 0;
        surface.seen = 0;
      }

      const tau = surface.held ? TAU_TRACK : TAU_REST;
      const k = 1 - Math.exp(-delta / tau);

      surface.x += (surface.toX - surface.x) * k;
      surface.y += (surface.toY - surface.y) * k;

      const arrived =
        Math.abs(surface.toX - surface.x) < SETTLED &&
        Math.abs(surface.toY - surface.y) < SETTLED;
      if (arrived) {
        surface.x = surface.toX;
        surface.y = surface.toY;
      }
      draw(surface);

      /* Held, it keeps running: the pointer will move again. Let go, it runs
         until it is flat and then stops for good. */
      if (surface.held || !arrived) {
        frame.current = requestAnimationFrame(step);
      } else {
        live.current = null;
      }
    },
    [draw],
  );

  const wake = useCallback(() => {
    if (!frame.current) {
      last.current = 0;
      frame.current = requestAnimationFrame(step);
    }
  }, [step]);

  const track = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!able.current || event.pointerType !== "mouse") return;
      const node = event.currentTarget;
      let surface = live.current;

      /* The box is measured on arrival, not on every move: the call forces
         layout after this handler has just written style. It is re-read after
         `FRESH` ms, so a page that scrolls or reflows under a resting pointer
         self-corrects quickly. */
      if (!surface || surface.node !== node || event.timeStamp - surface.at > FRESH) {
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        const fresh = !surface || surface.node !== node;
        surface = {
          node,
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          at: event.timeStamp,
          toX: 0.5,
          toY: 0.5,
          sumX: 0,
          sumY: 0,
          seen: 0,
          /* Arriving on a surface starts where the pointer is, not from the
             middle (which would tip every button as the pointer crossed its
             edge). */
          x: surface && !fresh ? surface.x : 0.5,
          y: surface && !fresh ? surface.y : 0.5,
          held: true,
        };
        live.current = surface;
      }

      surface.held = true;
      // 0 at the left/top edge, 1 at the right/bottom, 0.5 dead centre.
      surface.sumX += (event.clientX - surface.left) / surface.width;
      surface.sumY += (event.clientY - surface.top) / surface.height;
      surface.seen += 1;
      wake();
    },
    [wake],
  );

  /* Back to flat and to the centre, so the shading fades out evenly; the loop
     carries it there on the slower time constant and then stops. */
  const rest = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const surface = live.current;
      if (!surface || surface.node !== event.currentTarget) {
        /* Nothing was tracking (touch, reduced motion, or a leave with no
           move): write the neutral values anyway so a surface is never left
           tipped. */
        const style = event.currentTarget.style;
        style.setProperty("--tilt-x", "0deg");
        style.setProperty("--tilt-y", "0deg");
        style.setProperty("--tilt-px", "50%");
        style.setProperty("--tilt-py", "50%");
        style.setProperty("--rim-x", "0px");
        style.setProperty("--rim-y", "0px");
        return;
      }
      surface.held = false;
      surface.toX = 0.5;
      surface.toY = 0.5;
      /* Anything the pointer said on its way out is not where it is going. */
      surface.sumX = 0;
      surface.sumY = 0;
      surface.seen = 0;
      wake();
    },
    [wake],
  );

  return { track, rest };
}
