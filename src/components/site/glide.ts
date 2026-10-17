"use client";

/* Scrolling the landing on the site's own curve, for the three things that
   scroll it without a wheel: the "Explore Gator" handle, the parked window, and
   the runway's resting-place rule. The window's rise is bound to the scroll
   position, so the scroll's curve is the window's curve; `behavior: "smooth"`
   would hand that to each browser's own easing (Chrome's is a fixed 468ms).
   Duration grows with distance, and any sign the reader wants to be elsewhere
   cancels it. Only the scroll position moves. */

/* A symmetric ease-in-out (accelerate, cruise, settle), peaking at 1.8× the
   average speed. The front-loaded sheet curve (`--g-ease-sheet`) suits short
   sheet movements but makes a page scroll jump then creep. */
const EASE = [0.45, 0, 0.55, 1] as const;

/**
 * Milliseconds per pixel: duration grows with distance so the speed stays
 * constant. A screen of runway on a 900px window takes 720ms.
 */
const RATE = 0.8;
/** And the ends of the scale, so a nudge is not instant and the longest
 *  journey on the page does not become something you wait for. */
const SHORTEST = 260;
const LONGEST = 820;

/* The same curve and pace, shared with the servers list collapsing when
   filtered (which also moves the page). */
export const carry = {
  css: `cubic-bezier(${EASE[0]}, ${EASE[1]}, ${EASE[2]}, ${EASE[3]})`,
  time: (span: number) =>
    Math.min(LONGEST, Math.max(SHORTEST, Math.abs(span) * RATE)),
};

/* A unit bezier solved by Newton's method with a bisection fallback, as
   browsers do. Five iterations keep the error well under a pixel. */
function bezier(t: number) {
  const [x1, y1, x2, y2] = EASE;
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const at = (a: number, b: number, c: number, u: number) =>
    ((a * u + b) * u + c) * u;

  let u = t;
  for (let i = 0; i < 5; i += 1) {
    const slope = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(slope) < 1e-6) break;
    u -= (at(ax, bx, cx, u) - t) / slope;
  }
  /* Newton can walk off the end of the curve on the flat parts of an aggressive
     ease; a clamped bisection is what the browsers fall back to as well. */
  if (u < 0 || u > 1) {
    let low = 0;
    let high = 1;
    u = t;
    for (let i = 0; i < 20; i += 1) {
      u = (low + high) / 2;
      if (at(ax, bx, cx, u) < t) low = u;
      else high = u;
    }
  }
  return at(ay, by, cy, u);
}

let frame = 0;
let give: (() => void) | null = null;

/**
 * Stops wherever it is. Called when the reader takes over, and by the wheel
 * smoother before it eases a notch of its own.
 */
export function stopGlide() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  give?.();
  give = null;
}

/** Scroll the document to `to`, on the curve above. */
export function glide(to: number) {
  stopGlide();

  const root = document.scrollingElement as HTMLElement | null;
  if (!root) return;
  const limit = Math.max(0, root.scrollHeight - root.clientHeight);
  const end = Math.max(0, Math.min(limit, Math.round(to)));
  const from = window.scrollY;
  const span = end - from;

  /* Already there, or reduced motion: no animation at all. */
  if (
    span === 0 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    window.scrollTo({ top: end, behavior: "instant" });
    return;
  }

  const run = carry.time(span);
  const start = performance.now();

  /* Any input meaning "I would rather be elsewhere" ends it: wheel, touch,
     `pointerdown` (the scrollbar) and `keydown` (Home, End, arrows, space). */
  const surrender = () => stopGlide();
  const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  for (const name of events) {
    window.addEventListener(name, surrender, { passive: true });
  }
  give = () => {
    for (const name of events) window.removeEventListener(name, surrender);
  };

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / run);
    /* Lands exactly on the target: the window's rise ends at a fixed scroll
       fraction, and stopping a pixel short leaves it at a fractional scale with
       soft text. */
    window.scrollTo({
      top: t === 1 ? end : from + span * bezier(t),
      behavior: "instant",
    });
    if (t === 1) {
      stopGlide();
      return;
    }
    frame = requestAnimationFrame(step);
  };

  frame = requestAnimationFrame(step);
}
