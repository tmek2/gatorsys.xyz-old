"use client";

/* Momentum for a mouse wheel. A trackpad already glides; a wheel moves in flat
   notches. Each notch sets a destination and the page eases toward it,
   scrolling the real document, so the scrollbar, anchor links and the window's
   scroll-driven rise all keep working.

   - Only real notches are eased: trackpads and precision mice arrive already
     smooth.
   - A wheel over a box with its own scrollbar and room to move scrolls that
     box.
   - The loop stops as soon as the page catches up, so nothing runs on an idle
     page. */

import { useEffect } from "react";
import { glide, stopGlide } from "./glide";
import { scrollLocked } from "./scroll-lock";

/* It also decides where the scroll may come to rest. The window's runway is one
   screen long; resting partway leaves a half-risen window that looks usable but
   is not. CSS scroll snapping cannot be used (the browser re-snaps after every
   programmatic step of the easing), so the rule runs here on `scrollend`, after
   momentum and easing finish. */

/** How much of the remaining distance to close in one 60fps frame. */
const EASE = 0.14;
/** Under this many pixels from the destination, it has arrived. */
const SETTLE = 0.5;
/** A notch is at least this big. Below it, something else is driving. */
const NOTCH = 50;
/** How much of the runway counts as "I have barely left the top". Below this
 *  a rest goes back up, above it the reader was on their way down. */
const TURN = 0.25;
/** Nearer than this to either end and it has arrived; nudging it would be the
 *  page arguing with a reader who is already where they meant to be. */
const EDGE = 8;
/**
 * How long the page must be still before a stop counts as a rest. The easing
 * carries each notch for a few hundred milliseconds, so `scrollend` does not
 * fire between notches of a continuous turn; longer than this only adds a pause
 * before the page moves on its own.
 */
const REST_MS = 200;

export function SmoothScroll() {
  useEffect(() => {
    const root = document.scrollingElement as HTMLElement | null;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let target = window.scrollY;
    let frame = 0;
    let last = 0;
    /* Where the page was on the previous frame, so a glide that cannot move
       any further can tell. */
    let seen = -1;

    /* `clientHeight`, not `innerHeight`: a limit even a pixel past the real one
       can never be reached. */
    const limit = () => Math.max(0, root.scrollHeight - root.clientHeight);

    const step = (now: number) => {
      const current = window.scrollY;
      const gap = target - current;
      const arrived = Math.abs(gap) < SETTLE;

      if (arrived || current === seen) {
        /* Lands exactly on the target. The window's rise is bound to the
           scroll, and stopping a fraction short leaves the window at a
           fractional scale with soft text. `current === seen` also ends it: the
           page cannot move further. */
        if (arrived) window.scrollTo({ top: target, behavior: "instant" });
        frame = 0;
        return;
      }

      seen = current;
      /* Frame-rate independent, and clamped: rAF's timestamp can be earlier
         than the `performance.now()` taken in the wheel handler, and a negative
         dt would step backwards. */
      const dt = Math.min(Math.max(now - last, 1), 50);
      last = now;
      const k = Math.min(1, 1 - Math.pow(1 - EASE, dt / 16.667));
      const move = gap * k;
      /* At least a whole pixel: the browser rounds the scroll offset, so a step
         under half a pixel would never move and the loop would never end. */
      window.scrollTo({
        /* `instant`, because the site sets `scroll-behavior: smooth` globally
           and a smooth scroll inside this loop would fight it. */
        top: current + (Math.abs(move) < 1 ? Math.sign(gap) : move),
        behavior: "instant",
      });
      frame = requestAnimationFrame(step);
    };

    /** Is this wheel already spoken for by a box under the pointer? */
    const claimed = (node: EventTarget | null, delta: number) => {
      let el = node instanceof Element ? node : null;
      while (el && el !== document.body && el !== root) {
        const overflow = getComputedStyle(el).overflowY;
        if (/auto|scroll/.test(overflow) && el.scrollHeight > el.clientHeight + 1) {
          const room =
            delta > 0
              ? el.scrollTop < el.scrollHeight - el.clientHeight - 1
              : el.scrollTop > 1;
          if (room) return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.defaultPrevented) return;
      /* Honours the scroll lock: `window.scrollTo` works even with `overflow:
         hidden`, so the stylesheet alone cannot stop this loop. */
      if (scrollLocked()) return;
      if (event.deltaMode !== 0) return;
      if (!Number.isInteger(event.deltaY) || Math.abs(event.deltaY) < NOTCH) return;
      if (claimed(event.target, event.deltaY)) return;

      event.preventDefault();
      /* A notch interrupts any glide, before the position is read below. */
      stopGlide();
      // Anything else that moved the page -- a scrollbar, a key, a link to an
      // anchor -- is where we are starting from.
      if (!frame) {
        target = window.scrollY;
        last = performance.now();
        seen = -1;
      }
      target = Math.max(0, Math.min(limit(), target + event.deltaY));
      if (!frame) frame = requestAnimationFrame(step);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* The runway has two ends and the page does not rest between them. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("onscrollend" in window)) return;

    let settle = 0;
    /* Where the page last came to rest, which is the only way to know which
       way a reader was going without listening to the scroll itself. */
    let from = window.scrollY;

    const act = (was: number) => {
      // Nor is a page something else is holding still a page that has rested.
      if (scrollLocked()) return;
      /* It moved again while waiting, so that was not a rest (every notch ends
         in its own `scrollend`). */
      if (Math.abs(window.scrollY - was) > 1) return;

      const page = document.querySelector<HTMLElement>(".g-page");
      if (!page) return;
      const top = page.offsetTop;
      const foot = top + page.offsetHeight - window.innerHeight;
      const at = window.scrollY;
      if (foot <= top) return;

      /* Anywhere but the middle of the runway is a fine place to be. Remember
         it, so the next rest knows which way this reader is travelling. */
      if (at <= top + EDGE || at >= foot - EDGE) {
        from = at;
        return;
      }

      /* Which end they were heading for, unless they barely left the end they
         came from (a nudge returns them there). */
      const down = at >= from;
      const into = (at - top) / (foot - top);
      const barely = down ? into < TURN : into > 1 - TURN;
      const to = barely ? (down ? top : foot) : down ? foot : top;

      from = to;
      /* On the site's own curve (see glide.ts) rather than `behavior:
         "smooth"`, which uses a fixed duration regardless of distance. */
      glide(to);
    };

    const onEnd = () => {
      window.clearTimeout(settle);
      const was = window.scrollY;
      settle = window.setTimeout(() => act(was), REST_MS);
    };

    window.addEventListener("scrollend", onEnd);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("scrollend", onEnd);
    };
  }, []);

  return null;
}
