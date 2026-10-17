"use client";

/* "Free", and the confetti that comes from it: fired from the word's own box.
   It fires when the pointer arrives (not on every move, and not again until the
   pointer has left for a second), on tap for touch, and never under reduced
   motion. The confetti canvas is created on first fire, so the library only
   loads if someone points at the word. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateTypes } from "canvas-confetti";

const COOLDOWN = 900;

/** The site's own colours, so it is Gator's confetti and not the library's. */
const COLOURS = ["#f7a8c4", "#ffffff", "#5fd08a", "#ffd7e6", "#c9f5db"];

export function ConfettiWord({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const host = useRef<HTMLSpanElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const gun = useRef<CreateTypes | null>(null);
  const last = useRef(0);
  const inside = useRef(false);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(
    () => () => {
      gun.current?.reset();
      gun.current = null;
      canvas.current?.remove();
      canvas.current = null;
    },
    [],
  );

  const fire = useCallback(async () => {
    if (reduced) return;
    const now = Date.now();
    if (now - last.current < COOLDOWN) return;
    last.current = now;

    const node = host.current;
    if (!node) return;

    if (!gun.current) {
      // One full-viewport canvas, owned by this component, above the page and
      // deaf to the pointer. The library's global canvas would outlive us.
      const element = document.createElement("canvas");
      element.className = "g-confetti-canvas";
      document.body.appendChild(element);
      canvas.current = element;
      const { default: confetti } = await import("canvas-confetti");
      gun.current = confetti.create(element, { resize: true, useWorker: true });
    }

    const box = node.getBoundingClientRect();
    const origin = {
      x: (box.left + box.width / 2) / window.innerWidth,
      y: (box.top + box.height / 2) / window.innerHeight,
    };

    // Two low, wide bursts rather than one cone: it reads as the word popping
    // rather than as a cannon going off behind it.
    for (const [angle, drift] of [
      [60, -0.35],
      [120, 0.35],
    ] as const) {
      void gun.current?.({
        particleCount: 26,
        spread: 58,
        startVelocity: 26,
        decay: 0.92,
        scalar: 0.78,
        ticks: 130,
        gravity: 0.9,
        angle,
        colors: COLOURS,
        origin: { x: origin.x + drift * (box.width / window.innerWidth), y: origin.y },
      });
    }
  }, [reduced]);

  return (
    <span
      ref={host}
      className={`g-confetti-word ${className ?? ""}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        if (inside.current) return;
        inside.current = true;
        void fire();
      }}
      onPointerLeave={() => {
        inside.current = false;
      }}
      onPointerDown={(event) => {
        // Coarse pointers never hover, so the tap is the hover.
        if (event.pointerType === "touch") void fire();
      }}
    >
      {children}
    </span>
  );
}
