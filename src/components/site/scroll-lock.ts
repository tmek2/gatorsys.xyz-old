"use client";

/* Holding the page still while something is over it.

   `document.body.style.overflow = "hidden"` does nothing here: in standards
   mode the root element is the scrolling box. Three things are needed instead:

   - The root stops scrolling: `overflow: hidden` on `html`, with the scrollbar
     gutter held open where there is one, so nothing reflows.
   - Wheel and touch scrolling are cancelled unless they start inside something
     meant to scroll (marked `data-lock-scrollable`, with its own
     `overscroll-behavior: contain`). This also holds the page on iOS, which
     does not reliably honour the root's overflow for touch.
   - This site's own wheel easing stops too: it scrolls with `window.scrollTo`,
     which works even with `overflow: hidden`, so the lock is also
     `data-scroll-locked` on the root, which the smoother reads.

   Reference-counted, so a second lock releasing does not unlock the page under
   the first.

   Applied in two halves. Changing the root's overflow costs a full-document
   style recalculation (about 14ms on the landing page), which would stutter the
   frame a sheet starts moving. Stopping scroll is free (the attribute and a
   non-passive wheel listener), so that half goes on immediately and the
   overflow change waits until the arriving thing has finished animating.
   Releasing waits for the exit the same way. */

let depth = 0;
let undo: ((leaving: number) => void) | null = null;
/* The deferred half, if it has not run yet. Held so that a lock released
   before it fires never applies it at all. */
let pending: number | null = null;

function clearPending() {
  if (pending !== null) {
    window.clearTimeout(pending);
    pending = null;
  }
}

function begin(arriving: number) {
  const root = document.documentElement;
  const overflow = root.style.overflow;
  const gutter = root.style.scrollbarGutter;
  let heavy = false;

  /* The real lock, once nothing is moving. */
  const hold = () => {
    pending = null;
    heavy = true;
    /* Whether the scrollbar takes width from the page (classic) or is drawn
       over it (overlay). Asked before anything changes. */
    const classic = window.innerWidth - root.clientWidth > 0;

    root.style.overflow = "hidden";
    /* Hold the gutter open only for a classic scrollbar (otherwise hiding
       overflow gives its width back and the page reflows). With an overlay
       scrollbar (Mac, phones) there is no gutter, and `scrollbar-gutter:
       stable` would add padding and shift the page. */
    if (classic) root.style.scrollbarGutter = "stable";
  };

  root.dataset.scrollLocked = "true";

  const stop = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.closest?.("[data-lock-scrollable]")) return;
    if (event.cancelable) event.preventDefault();
  };
  /* Non-passive, so `preventDefault` counts. This holds the page until the
     overflow change runs, and keeps holding it on iOS. */
  document.addEventListener("touchmove", stop, { passive: false });
  document.addEventListener("wheel", stop, { passive: false });

  clearPending();
  if (arriving > 0) pending = window.setTimeout(hold, arriving);
  else hold();

  undo = (leaving: number) => {
    delete root.dataset.scrollLocked;
    document.removeEventListener("touchmove", stop);
    document.removeEventListener("wheel", stop);
    clearPending();
    /* Nothing to put back if the page never got as far as the real lock. */
    if (!heavy) return;
    const give = () => {
      pending = null;
      root.style.overflow = overflow;
      root.style.scrollbarGutter = gutter;
    };
    /* Wheel and touch work again the moment the listeners come off, so waiting
       out the exit before restoring overflow costs nothing. */
    if (leaving > 0) pending = window.setTimeout(give, leaving);
    else give();
  };
}

/**
 * Stops the page; returns the release, which is safe to call twice. `arriving`
 * and `leaving` are how long the overlay takes to appear and disappear, the
 * windows in which the expensive half must not run. Zero for anything that
 * appears without animation.
 */
export function lockScroll({
  arriving = 0,
  leaving = 0,
}: { arriving?: number; leaving?: number } = {}): () => void {
  if (typeof document === "undefined") return () => {};
  depth += 1;
  if (depth === 1) begin(arriving);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      undo?.(leaving);
      undo = null;
    }
  };
}

/** Is the page being held still by something? Read by the wheel smoother,
 *  which would otherwise scroll it by hand. */
export function scrollLocked() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.scrollLocked === "true"
  );
}
