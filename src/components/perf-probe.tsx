"use client";

/* A performance meter you have to ask for (`?perf=1`): frame times, the
   display's refresh rate (a 120Hz screen has half a 60Hz screen's budget), the
   pixels being drawn, whether drawing is on the GPU or in software, and the
   build. Without the parameter it renders, measures and schedules nothing. */

import { useEffect, useState } from "react";

interface Reading {
  fps: number;
  worst: number;
  hz: number;
  view: string;
  dpr: number;
  gpu: string;
  build: string;
}

export function PerfProbe({ build }: { build: string }) {
  const [on, setOn] = useState(false);
  const [read, setRead] = useState<Reading | null>(null);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("perf")) return;
    setOn(true);
  }, []);

  useEffect(() => {
    if (!on) return;

    /* The display's refresh rate, taken as the fastest frame in the first
       second rather than the average. */
    let quickest = Infinity;
    const gaps: number[] = [];
    let last = performance.now();
    let frame = 0;
    let settled = 0;

    const gpu = (() => {
      try {
        const canvas = document.createElement("canvas");
        const gl = (canvas.getContext("webgl") ??
          canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
        if (!gl) return "no webgl, software";
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        return info
          ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
          : "renderer withheld";
      } catch {
        return "unavailable";
      }
    })();

    const tick = (now: number) => {
      const gap = now - last;
      last = now;
      if (gap > 0.5) {
        gaps.push(gap);
        if (gap < quickest) quickest = gap;
      }
      if (gaps.length > 120) gaps.shift();
      if (now - settled > 400 && gaps.length > 8) {
        settled = now;
        const sorted = [...gaps].sort((a, b) => a - b);
        setRead({
          fps: Math.round(1000 / sorted[Math.floor(sorted.length / 2)]),
          worst: Math.round(sorted[sorted.length - 1]),
          hz: Math.round(1000 / quickest),
          view: `${window.innerWidth}x${window.innerHeight}`,
          dpr: window.devicePixelRatio,
          gpu,
          build,
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on, build]);

  if (!on || !read) return null;

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 2147483647,
        right: 8,
        bottom: 8,
        maxWidth: "min(92vw, 30rem)",
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(9, 9, 9, 0.88)",
        color: "#eaeaea",
        font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
      }}
    >
      {`${read.fps} fps  (worst frame ${read.worst}ms)
screen  ~${read.hz}Hz          budget ${(1000 / Math.max(read.hz, 1)).toFixed(1)}ms
window  ${read.view} @ ${read.dpr}x  = ${(
        (read.view.split("x").map(Number).reduce((a, b) => a * b, 1) *
          read.dpr *
          read.dpr) /
        1e6
      ).toFixed(1)}Mpx
draws   ${read.gpu}
build   ${read.build}`}
    </div>
  );
}
