"use client";

import { useEffect } from "react";

/**
 * Removes the query string from the address bar once the server has read it
 * (e.g. `?callbackUrl=%2Faccount`). `replaceState`, not `push`, so Back does
 * not return to the same page.
 */
export function TidyUrl({ to }: { to: string }) {
  useEffect(() => {
    if (window.location.pathname + window.location.search === to) return;
    window.history.replaceState(null, "", to);
  }, [to]);
  return null;
}
