/**
 * Animations for the server picker changing shape. Filtering to pinned and back
 * is three motions at once: leaving cards go, staying cards move (FLIP: measure
 * before the change, let React lay out the new list, animate each card from its
 * old place), and arriving cards appear. Compositor-friendly properties only.
 */

import { carry } from "@/components/site/glide";

/** The site's own curve and pace, the same as the refresh re-entry. */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/* Durations are short because the phases are sequential (leaving cards must
   finish before React removes them): about 140ms of leaving, then about 230ms
   of moving with the arrivals inside it. A filter should feel like a direct
   response. */
const LEAVE_MS = 90;
const MOVE_MS = 230;
/** And what a long move adds to that, per pixel travelled, up to a ceiling. */
const MOVE_PER_PX = 0.22;
const MOVE_MAX_MS = 420;
const ENTER_MS = 190;
/**
 * Per-card delay on the way in, and how many cards get it. No stagger on the
 * way out: every filtered-out card leaves at once.
 */
const ENTER_STEP = 11;
const ENTER_STEP_MAX = 5;

export type Spot = { x: number; y: number };

/* A card's position in the document, not the window. Filtering can shorten the
   page and drag the scroll position, which would make window-relative
   before/after readings wrong; adding the scroll offset measures the real
   movement. */
const spot = (box: DOMRect): Spot => ({
  x: box.left + window.scrollX,
  y: box.top + window.scrollY,
});

/** How tall the list is now, so the page can be told to travel with it. */
export function height(box: HTMLElement) {
  return box.getBoundingClientRect().height;
}

/** Where every card is now, by server. */
export function positions(grid: HTMLElement): Map<string, Spot> {
  const out = new Map<string, Spot>();
  grid.querySelectorAll<HTMLElement>(".sv-frame").forEach((card) => {
    const id = card.dataset.serverId;
    if (!id) return;
    out.set(id, spot(card.getBoundingClientRect()));
  });
  return out;
}

export function motionAllowed() {
  if (typeof window === "undefined") return false;
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") {
    return false;
  }
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Animates the leaving cards and resolves when they are gone, before React
 * rebuilds the list.
 */
export function leave(cards: HTMLElement[]): Promise<void> {
  if (!cards.length) return Promise.resolve();
  const runs = cards.map((card) =>
    card.animate(
      [
        { opacity: 1, transform: "none" },
        /* Leaving cards shrink as they fade, so the moment before their slots
           close reads as part of the same motion. Scale and opacity only. */
        { opacity: 0, transform: "scale(0.94)" },
      ],
      {
        duration: LEAVE_MS,
        easing: "cubic-bezier(0.4, 0, 1, 1)",
        fill: "forwards",
      },
    ),
  );
  return Promise.all(
    runs.map((run) => run.finished.catch(() => undefined)),
  ).then(() => undefined);
}

/**
 * The new list settling: survivors slide from where they were, new cards fade
 * up. Called after React has laid out the new list; `before` comes from
 * `positions`.
 */
export function settle(grid: HTMLElement, before: Map<string, Spot>) {
  let arriving = 0;
  grid.querySelectorAll<HTMLElement>(".sv-frame").forEach((card) => {
    const id = card.dataset.serverId || "";
    const was = before.get(id);
    const now = spot(card.getBoundingClientRect());

    if (!was) {
      // New to the list: the site's own re-entry, the one a refresh uses.
      card.animate(
        [
          { opacity: 0, transform: "translateY(7px) scale(0.985)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: ENTER_MS,
          delay: Math.min(arriving++, ENTER_STEP_MAX) * ENTER_STEP,
          easing: EASE,
          fill: "backwards",
        },
      );
      return;
    }

    const dx = was.x - now.x;
    const dy = was.y - now.y;
    // A card that did not actually move does not need telling about it.
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    /* Duration grows with distance (capped), so speed stays roughly constant. */
    const reach = Math.hypot(dx, dy);
    card.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      {
        duration: Math.min(MOVE_MAX_MS, MOVE_MS + reach * MOVE_PER_PX),
        easing: EASE,
      },
    );
  });
}

/* Animates the list box's height so the page below (footer, document height,
   scrollbar, scroll position) moves with the cards instead of jumping in one
   frame.

   Two things move the scroll position and need handling: - Clamping: a document
   shorter than the scroll offset cuts the offset, and growing it back does not
   restore it. So the height and scroll are restored synchronously in the layout
   effect before paint, and the box then animates; the clamp happens gradually
   as it closes. - Scroll anchoring: the browser would compensate for the
   collapse before it has happened and keep re-correcting each frame. Anchoring
   is off for the duration.

   `overflow: clip` (not `hidden`, which would make it a scroll container) so
   rows do not paint over the footer while the box grows. */
const running = new WeakMap<HTMLElement, Animation>();

export function grow(box: HTMLElement, from: number, top: number) {
  /* The height the new list wants. Reading it lets the document shrink, which
     the code below corrects before paint. */
  const to = box.getBoundingClientRect().height;
  // Nothing to say when the list has changed but its height has not: filtering
  // one card out of a row of four takes nothing off the page.
  if (Math.abs(to - from) < 1) return;

  const style = box.style;
  style.height = `${from}px`;
  style.overflow = "clip";
  const root = document.documentElement;
  root.style.overflowAnchor = "none";
  /* Restored with `scrollTo({ behavior: "instant" })`: in Chrome, assigning
     `scrollTop` at this point in the layout effect does not hold. */
  if (root.scrollTop < top) root.scrollTo({ top, behavior: "instant" });

  // One at a time: a second press mid-flight animates from wherever the box
  // has got to, rather than fighting the first for the same property.
  running.get(box)?.cancel();
  const run = box.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    /* Same distance rule as the cards, so the box and the furthest card arrive
       together. */
    /* The page-scroll curve, not the cards' curve: the card curves front-load
       most of their distance, which for a page-sized collapse is a lurch then a
       creep. The scroll curve (also used by the landing page) peaks at 1.8× its
       average speed instead of 4.2×. */
    duration: carry.time(to - from),
    easing: carry.css,
  });
  running.set(box, run);
  const done = () => {
    if (running.get(box) !== run) return;
    running.delete(box);
    style.height = "";
    style.overflow = "";
    root.style.overflowAnchor = "";
  };
  run.finished.then(done, done);
}
