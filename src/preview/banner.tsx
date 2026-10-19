"use client";

import { useEffect, useRef, useState } from "react";
import "./banner.css";

const DISMISSED = "dashboard-preview-banner-closed";

export function PreviewBanner() {
  const [closed, setClosed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const banner = useRef<HTMLElement>(null);
  useEffect(() => {
    try { setClosed(sessionStorage.getItem(DISMISSED) === "1"); } catch { /* storage is optional */ }
  }, []);
  useEffect(() => {
    const update = () => document.documentElement.style.setProperty("--preview-height", `${closed ? 0 : banner.current?.offsetHeight || 0}px`);
    update();
    const observer = new ResizeObserver(update);
    if (banner.current) observer.observe(banner.current);
    return () => observer.disconnect();
  }, [closed]);
  function dismiss(value: boolean) {
    setClosed(value);
    try { sessionStorage.setItem(DISMISSED, value ? "1" : "0"); } catch { /* storage is optional */ }
  }
  async function reset() {
    setResetting(true); setError("");
    try {
      const response = await fetch("/api/preview/reset", { method: "POST" });
      if (!response.ok) throw new Error("Could not reset the preview. Try again.");
      // Drafts belong to these fictional servers, and must reset with them.
      for (const storage of [localStorage, sessionStorage]) {
        for (const key of Object.keys(storage)) {
          if (key.includes("10000000000000010") || key.startsWith("application-draft:")) storage.removeItem(key);
        }
      }
      window.location.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not reset the preview.");
      setResetting(false);
    }
  }
  if (closed) return <button className="preview-reopen" onClick={() => dismiss(false)} aria-label="Show test preview notice">Test preview</button>;
  return <aside className="preview-banner" ref={banner} aria-label="Test preview notice">
    <p><strong>Test preview</strong><span>Fictional account and servers. Nothing here is linked to real data.</span>{error && <span role="alert">{error}</span>}</p>
    <button className="preview-reset" onClick={reset} disabled={resetting}>{resetting ? "Resetting…" : "Reset preview"}</button>
    <button className="preview-close" onClick={() => dismiss(true)} aria-label="Close test preview notice">×</button>
  </aside>;
}
