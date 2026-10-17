"use client";

import { useEffect } from "react";

/**
 * Stops the browser scrolling a box that has no scrollbar. Dialogs are
 * `overflow-hidden` around a header, a scrolling body and a footer; focusing an
 * element inside the body makes the browser scroll every scrollable ancestor
 * into view, including the overflow-hidden dialog (still a scroll container,
 * just without a scrollbar), which then stays displaced with empty space under
 * it.
 *
 * Global rather than per dialog: a scrolled `overflow: hidden` element is never
 * intended. Scroll events do not bubble but do capture, so one document
 * listener sees them all; elements that legitimately scroll are remembered in a
 * `WeakSet` so the common case costs one lookup.
 */
export function OverflowScrollGuard() {
  useEffect(() => {
    // Elements already established as genuinely scrollable. The hot path.
    const scrollable = new WeakSet<Element>();

    function onScroll(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (scrollable.has(target)) return;
      if (!target.scrollTop && !target.scrollLeft) return;

      const style = getComputedStyle(target);
      const hidden =
        (target.scrollTop && style.overflowY === "hidden") ||
        (target.scrollLeft && style.overflowX === "hidden");
      if (!hidden) {
        scrollable.add(target);
        return;
      }
      // Put it back. The focused element stays reachable through the body's own
      // scroll container.
      if (style.overflowY === "hidden") target.scrollTop = 0;
      if (style.overflowX === "hidden") target.scrollLeft = 0;
    }

    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  return null;
}
