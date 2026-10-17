"use client";

/* Type "gator" anywhere on the site (not in a text field) and one swims along
   the foot of the screen, leaving a wake. One at a time, and never under
   reduced motion. */

import React, { useEffect, useRef, useState } from "react";
import { GatorLogo } from "@/components/site/gator-logo";
import "./gator-swim.css";

const WORD = "gator";
/** How long it takes to cross the screen. */
const SWIM_MS = 7200;
/** A ripple of the wake every this many ms. */
const WAKE_EVERY = 170;

export function GatorSwim() {
  /** When the current swim started, or 0 when nobody is swimming. */
  const [swim, setSwim] = useState(0);
  const typed = useRef("");
  const water = useRef<HTMLDivElement | null>(null);
  const gator = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
      const el = event.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      typed.current = (typed.current + event.key.toLowerCase()).slice(-WORD.length);
      if (typed.current !== WORD || reduced.matches) return;
      typed.current = "";
      setSwim((current) => current || Date.now());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* The wake: rings left on the water where the tail was, each fading on its
     own. Added straight to the layer rather than through React, so nothing
     re-renders while it swims. */
  useEffect(() => {
    if (!swim) return;
    const layer = water.current;
    const timer = window.setInterval(() => {
      const body = gator.current?.getBoundingClientRect();
      if (!layer || !body) return;
      const ring = document.createElement("span");
      ring.className = "g-swim-wake";
      ring.style.left = `${body.left + body.width * 0.15}px`;
      ring.addEventListener("animationend", () => ring.remove(), { once: true });
      layer.appendChild(ring);
    }, WAKE_EVERY);
    const done = window.setTimeout(() => setSwim(0), SWIM_MS + 1400);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(done);
    };
  }, [swim]);

  if (!swim) return null;
  return (
    <div ref={water} className="g-swim" aria-hidden="true" key={swim}>
      <span className="g-swim-path" style={{ animationDuration: `${SWIM_MS}ms` }}>
        <span ref={gator} className="g-swim-gator">
          <GatorLogo size={34} title="" />
        </span>
      </span>
    </div>
  );
}
