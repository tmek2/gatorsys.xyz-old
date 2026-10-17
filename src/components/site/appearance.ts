"use client";

/* Which appearance the page is actually in. CSS can hold both answers (an
   explicit `data-theme`, else the device preference); an image cannot, since
   `<picture>` can read `prefers-color-scheme` but not an attribute. This reads
   the same two things in the same order. It starts as `dark` (the server
   render) and corrects after mount, well before these lazy images inside the
   scroll-opened window are seen. */

import { useEffect, useState } from "react";

export type Appearance = "light" | "dark";

export function useAppearance(): Appearance {
  const [mode, setMode] = useState<Appearance>("dark");

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const read = (): Appearance => {
      const chosen = root.getAttribute("data-theme");
      if (chosen === "light" || chosen === "dark") return chosen;
      return media.matches ? "light" : "dark";
    };

    const sync = () => setMode(read());
    sync();

    /* The toggle sets and clears the attribute rather than calling anything, so
       watching it is what keeps this in step with a switch made anywhere. */
    const watcher = new MutationObserver(sync);
    watcher.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    media.addEventListener("change", sync);

    return () => {
      watcher.disconnect();
      media.removeEventListener("change", sync);
    };
  }, []);

  return mode;
}
