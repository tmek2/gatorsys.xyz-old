"use client";

/* A small burst of the site's confetti from an element, for a moment worth
   marking (every module turned on). One canvas over the page, made the first
   time, so the library only loads when something is celebrated. Never under
   reduced motion. */

import type { CreateTypes } from "canvas-confetti";

/** The site's own colours, the same as "Free" on the landing. */
const COLOURS = ["#f7a8c4", "#ffffff", "#5fd08a", "#ffd7e6", "#c9f5db"];

let gun: CreateTypes | null = null;

export async function burstFrom(element: Element | null, { big = false }: { big?: boolean } = {}) {
  if (!element || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!gun) {
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "450",
      pointerEvents: "none",
    });
    document.body.appendChild(canvas);
    const { default: confetti } = await import("canvas-confetti");
    gun = confetti.create(canvas, { resize: true, useWorker: true });
  }
  const box = element.getBoundingClientRect();
  // A hidden element (a phone has no footer, so no counter) has no box: then
  // straight up from the middle of the window's foot.
  const shown = box.width > 0 && box.height > 0;
  const origin = shown
    ? {
        x: (box.left + box.width / 2) / window.innerWidth,
        y: (box.top + box.height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 1 };
  // Upward from where the element sits; `big` is wider and fuller, for a
  // burst in the middle of the page rather than at its foot.
  void gun({
    particleCount: big ? 130 : 70,
    spread: big ? 110 : 70,
    startVelocity: big ? 42 : 34,
    decay: 0.91,
    scalar: 0.8,
    ticks: 160,
    gravity: 0.95,
    angle: shown && !big ? 100 : 90,
    colors: COLOURS,
    origin,
  });
}
