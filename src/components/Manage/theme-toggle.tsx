"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IconMoon, IconSun } from "@tabler/icons-react";

/**
 * Where this older toggle (used by the form page and document reader headers)
 * lets the light theme apply: /manage, /docs and /account, which have light
 * designs. Elsewhere it keeps the attribute dark.
 */
function themeApplies(pathname: string): boolean {
  return (
    pathname.startsWith("/manage") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/account")
  );
}

/** Reads the persisted theme and keeps <html data-theme> in sync. */
export function useTheme(): ["dark" | "light", () => void] {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const pathname = usePathname() || "/";

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("gator-theme");
    } catch {}
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    // The preference is remembered everywhere and applied only where it means
    // something, so leaving /manage does not silently forget it.
    document.documentElement.dataset.theme = themeApplies(pathname)
      ? initial
      : "dark";
  }, [pathname]);

  function toggle() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = themeApplies(pathname)
        ? next
        : "dark";
      try {
        localStorage.setItem("gator-theme", next);
      } catch {}
      // Live surfaces that render their own chrome (Univer spreadsheets)
      // listen for this to re-theme without a reload.
      try {
        window.dispatchEvent(
          new CustomEvent("gator-theme-change", { detail: next }),
        );
      } catch {}
      return next;
    });
  }

  return [theme, toggle];
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const pathname = usePathname() || "/";

  // Not rendered where the theme does not apply, since pressing it would change
  // nothing on screen.
  if (!themeApplies(pathname)) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle theme"
      className="theme-toggle rounded-xl border border-white/[0.08] p-2 text-white/55 transition-colors hover:border-white/20 hover:text-white"
    >
      {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
    </button>
  );
}
