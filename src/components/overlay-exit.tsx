"use client";

import { useEffect } from "react";

/**
 * Gives every `.gator-overlay` an exit animation without touching call sites. A
 * conditionally mounted modal (`{open && <Modal/>}`) leaves the DOM the moment
 * `open` flips, so CSS cannot animate it. A MutationObserver watches for
 * `.gator-overlay` nodes leaving the document; React has already detached them,
 * so the node is re-inserted into <body>, faded out and dropped. The clone is
 * inert (no pointer events, aria-hidden, no focus) for the ~160ms it exists.
 */
export function OverlayExit() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Honour reduced motion by simply not doing any of this.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Element.animate is the whole mechanism; without it, do nothing.
    if (typeof Element.prototype.animate !== "function") return;

    const dying = new WeakSet<Element>();

    const farewell = (node: Element) => {
      // Guard against the same node being seen twice (a nested removal, or the
      // observer firing for both the node and its parent).
      if (dying.has(node) || node.isConnected) return;
      dying.add(node);

      const ghost = node as HTMLElement;
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.pointerEvents = "none";
      // Kill the entrance animation, or it restarts on re-insertion and the
      // overlay flashes back in before leaving.
      ghost.style.animation = "none";
      document.body.appendChild(ghost);

      const scrim = ghost.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 150, easing: "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards" },
      );

      // The panel leaves with a little travel, matching its arrival. Buttons
      // are skipped: in these overlays the full-bleed button is the scrim,
      // which only fades.
      for (const child of Array.from(ghost.children)) {
        if (child.tagName === "BUTTON") continue;
        (child as HTMLElement).animate(
          [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateY(0.4rem) scale(0.98)" },
          ],
          { duration: 150, easing: "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards" },
        );
      }

      const cleanup = () => ghost.remove();
      scrim.addEventListener("finish", cleanup);
      scrim.addEventListener("cancel", cleanup);
      // Belt and braces: a dropped animation event must never leave a ghost
      // overlay sitting on the page.
      window.setTimeout(cleanup, 400);
    };

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const removed of Array.from(record.removedNodes)) {
          if (!(removed instanceof Element)) continue;
          if (removed.classList?.contains("gator-overlay")) {
            farewell(removed);
            continue;
          }
          // The overlay may have gone as part of a larger subtree removal.
          removed.querySelectorAll?.(".gator-overlay").forEach(farewell);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
