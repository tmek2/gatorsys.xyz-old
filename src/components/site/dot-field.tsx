"use client";

/* The dot field: a grid of dots that pushes away from the pointer and brightens
   near it.

   The interaction follows Kokonut UI's MouseEffectCard (MIT, © Dorian Baffier):
   same reach, maximum push and proximity glow. Differences:

   - The falloff is smoothed (see `ease`), so there is no visible rim where dots
     start moving.
   - The dots are drawn on canvas instead of one animated element per dot (a
     full page would be thousands of springs). One spring, not thousands: only
     the pointer's influence eases, and each dot's offset is a pure function of
     the pointer.
   - Two canvases. Redrawing a canvas re-uploads its whole area to the
     compositor, so cost scales with canvas size, not with what is drawn. The
     resting grid is drawn once at window size and left alone; a small
     fixed-size square follows the pointer and holds everything it disturbs. It
     fills itself with the ground colour first (covering the resting dots
     beneath it), and its edges sit between two columns of dots so no dot is
     ever cut in half. Both surfaces are drawn by the same function from the
     same numbers, so there is no seam.
   - Nothing is drawn live for a coarse pointer or reduced motion; both get the
     static grid.
   - It never pauses while the landing window is up: the window is inset,
     leaving visible strips of field down both sides.
   - A press on the bare ground (a tap, on a touch screen) drops a pebble: the
     dots where it lands sink and flash, then three rings run out and settle.
     The rings are drawn into the resting grid itself, redrawing only the patch
     they cover while they run, so they spread past the live square and end
     in a circle rather than at its edges. Quick presses make several. Never
     under reduced motion. */

import { useEffect, useRef } from "react";
import "./dot-field.css";

/** Grid pitch. Matches the field this replaces. */
const GAP = 21;
/** Dot radius. */
const DOT = 1.1;
/**
 * The falloff: smoothstep of the reference's linear `1 - d/r`, so the slope is
 * zero at both ends. Dots ease into motion at the rim and sit on a plateau
 * under the pointer. Same reach and maximum; the amplitudes still multiply a
 * 0-to-1 value.
 */
function ease(t: number) {
  return t * t * (3 - 2 * t);
}

/** How far the push reaches. */
const RADIUS = 172;
/** How far the nearest dot is pushed. */
const SHOVE = 22;
/** How much brighter a dot gets right under the pointer. */
const GLOW = 1.9;
/** And how much bigger. */
const SWELL = 0.55;
/**
 * Time constant, in ms, for the push fading in and out. The pointer position
 * itself is not smoothed (see the loop).
 */
const TAU_STRENGTH = 150;
const TURN = Math.PI * 2;
/**
 * The live square in CSS pixels: the pointer's reach plus a ring of dots,
 * snapped to the grid. Independent of window size, so the field costs the same
 * on a laptop and a 4K screen.
 */
const LIVE = Math.ceil((RADIUS + 2 * GAP) / GAP) * GAP * 2;
/**
 * How far the live square's edge sits before its first column of dots: about
 * half a gap, so its boundary falls between columns, but a whole number of
 * pixels. A half-pixel offset makes the compositor resample the layer and
 * rasterises dots differently from the resting grid, which shows as a visible
 * box.
 */
const EDGE = 10;
/** The pebble: how long a ring takes to run out, how far it runs, how thick
 *  it is, and how far its crest lifts a dot. */
const RIPPLE_MS = 900;
const RIPPLE_REACH = 300;
const RIPPLE_BAND = 22;
const RIPPLE_LIFT = 10;
/** Pebbles at once; a fifth press replaces the oldest. */
const RIPPLES = 4;
/** Each pebble's rings: how far behind the first (as a share of its time) and
 *  how strong, as water makes them. The last one sets how long a pebble is
 *  kept. */
const RINGS: [number, number][] = [
  [0, 1],
  [0.12, 0.6],
  [0.24, 0.32],
];
const KEPT_MS = RIPPLE_MS * (1 + RINGS[RINGS.length - 1][0]);
/** The plop where it lands, before the rings: how wide, how long, and how far
 *  the dots there sink toward it. */
const PLOP = 30;
const PLOP_MS = 260;
const PLOP_SINK = 5;
/** Everything a pebble can move, measured from where it lands: the furthest
 *  ring, its band, its lift and a column to spare. Past this every dot is at
 *  rest, so the patch's edge never cuts one. */
const RIPPLE_SPAN = RIPPLE_REACH + RIPPLE_BAND * 3 + RIPPLE_LIFT + GAP;
/** A tap, rather than the start of a scroll: this close and this quick. */
const TAP_SLOP = 10;
const TAP_MS = 350;

export function DotField({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const restRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const restCanvas = restRef.current;
    const liveCanvas = liveRef.current;
    if (!host || !restCanvas || !liveCanvas) return;
    const rest = restCanvas.getContext("2d");
    const live = liveCanvas.getContext("2d");
    if (!rest || !live) return;

    /* The host's own corner, kept rather than asked for. */
    const box = { left: 0, top: 0 };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = reduced || !window.matchMedia("(pointer: fine)").matches;

    let width = 0;
    let height = 0;
    let colour = "#f7a8c4";
    let alpha = 0.13;
    /* The live square's fill must match the ground it sits on, so it is read
       rather than assumed (the picker's ground comes through `--servers-paper`,
       everywhere else through `--g-ground`). */
    let ground = "#0c0c0c";
    /* The edge fade as six percentages (the ellipse's two radii, its centre and
       two stops), declared by the caller as `--g-dot-fade` because each field
       fades differently. Empty means no fade. */
    let fade: number[] | null = null;
    /* And the same thing in pixels: the centre, the two stops, and how much a
       circle is flattened to become the caller's ellipse. */
    let veilX = 0;
    let veilY = 0;
    let veilIn = 0;
    let veilOut = 0;
    let squash = 1;

    let x = -9999;
    let y = -9999;
    let toX = -9999;
    let toY = -9999;
    /* Every pointer position reported since the last frame, summed. A mouse
       reports faster than the screen refreshes, so frames get one, two or three
       events; using the mean rather than the newest advances evenly. */
    let sumX = 0;
    let sumY = 0;
    let seen = 0;
    let strength = 0;
    let want = 0;
    let frame = 0;
    let last = 0;
    let showing = false;
    /* Pebbles still rippling, in field coordinates, and the frame's time. */
    const drops: { x: number; y: number; at: number }[] = [];
    let clock = 0;
    /* The patch of the resting grid the pebbles have disturbed, in grid
       columns, so it can be put back once they settle. */
    let patch: { x0: number; y0: number; x1: number; y1: number } | null = null;
    /* A finger that has just gone down, until it is a tap or a scroll. */
    let touch: { id: number; x: number; y: number; at: number } | null = null;

    /* Read from the host element, not `:root`: `--g-dot-alpha` is declared on
       `.g-dots` (this element), so fields can differ. `--g-accent` is
       inherited, so it reads the same here. */
    function readTheme() {
      const style = getComputedStyle(host);
      /* `--g-dot-ink` if the theme names one (light needs a deeper ink than the
         accent; see dot-field.css), the accent otherwise. */
      colour =
        style.getPropertyValue("--g-dot-ink").trim() ||
        style.getPropertyValue("--g-accent").trim() ||
        colour;
      const declared = style.getPropertyValue("--g-dot-alpha").trim();
      const parsed = declared ? Number(declared) : 0.13;
      alpha = Number.isFinite(parsed) ? parsed : 0.13;

      const asked = style.getPropertyValue("--g-dot-fade").trim();
      const numbers = asked
        ? asked.split(/[\s,]+/).map((part) => Number.parseFloat(part) / 100)
        : [];
      fade =
        numbers.length === 6 && numbers.every((n) => Number.isFinite(n))
          ? numbers
          : null;
      ground = behind();
    }

    /** The first thing above the field that actually paints a colour. */
    function behind() {
      let node = host.parentElement;
      while (node) {
        const paint = getComputedStyle(node).backgroundColor;
        const clear = /^rgba?\([^)]*,\s*0(\.0+)?\)$/.test(paint);
        if (paint && paint !== "transparent" && !clear) return paint;
        node = node.parentElement;
      }
      return (
        getComputedStyle(host).getPropertyValue("--g-ground").trim() || ground
      );
    }

    /** The fade, in pixels rather than fractions. */
    function setVeil() {
      if (!fade) {
        veilIn = 0;
        veilOut = 0;
        squash = 1;
        return;
      }
      const [rx, ry, cx, cy, inner, outer] = fade;
      veilX = cx * width;
      veilY = cy * height;
      /* One circle squashed into the caller's ellipse, which is how
         `radial-gradient(ellipse …)` is defined. */
      const span = rx * width;
      veilIn = span * inner;
      veilOut = span * outer;
      squash = ry === 0 ? 1 : (ry * height) / (rx * width);
    }

    /**
     * How much of a dot survives the fade where it stands: all inside the inner
     * stop, none past the outer. Computed per dot so both canvases agree
     * exactly.
     */
    function keep(dotX: number, dotY: number) {
      if (!fade || veilOut <= veilIn) return 1;
      const awayX = dotX - veilX;
      const awayY = (dotY - veilY) / (squash || 1);
      const away = Math.sqrt(awayX * awayX + awayY * awayY);
      if (away <= veilIn) return 1;
      if (away >= veilOut) return 0;
      return 1 - (away - veilIn) / (veilOut - veilIn);
    }

    /**
     * Draws the dots of a box into a context whose origin is at (originX,
     * originY) in page coordinates. One fill per dot, because the fade varies
     * per dot; fills are the cheap part.
     */
    function dots(
      ctx: CanvasRenderingContext2D,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      originX: number,
      originY: number,
      pointer: boolean,
      ripples: boolean,
    ) {
      const reachSq = RADIUS * RADIUS;
      ctx.fillStyle = colour;
      for (let dotX = x0; dotX <= x1; dotX += GAP) {
        for (let dotY = y0; dotY <= y1; dotY += GAP) {
          const shade = keep(dotX, dotY);
          if (shade <= 0.001) continue;
          let atX = dotX;
          let atY = dotY;
          let size = DOT;
          let ink = alpha * shade;
          if (pointer) {
            const awayX = dotX - x;
            const awayY = dotY - y;
            const square = awayX * awayX + awayY * awayY;
            if (square < reachSq) {
              const distance = Math.sqrt(square) || 0.0001;
              const near = ease(1 - distance / RADIUS) * strength;
              const push = near * SHOVE;
              atX = dotX + (awayX / distance) * push;
              atY = dotY + (awayY / distance) * push;
              size = DOT * (1 + near * SWELL);
              ink = Math.min(alpha * (1 + near * GLOW) * shade, 1);
            }
          }
          if (ripples) {
            for (const drop of drops) {
              const fromX = dotX - drop.x;
              const fromY = dotY - drop.y;
              const square = fromX * fromX + fromY * fromY;
              if (square > RIPPLE_SPAN * RIPPLE_SPAN) continue;
              const from = Math.sqrt(square) || 0.0001;
              const since = clock - drop.at;
              /* The plop: the dots where it landed sink toward it and flash,
                 for a moment, before any ring has left. */
              if (since < PLOP_MS) {
                const left = 1 - since / PLOP_MS;
                const near = Math.exp(-((from / PLOP) ** 2)) * left;
                atX -= (fromX / from) * near * left * PLOP_SINK;
                atY -= (fromY / from) * near * left * PLOP_SINK;
                size *= 1 + near * 0.9;
                ink = Math.min(ink + alpha * near * 3.2 * shade, 1);
              }
              for (const [lag, height] of RINGS) {
                const age = since / RIPPLE_MS - lag;
                if (age < 0 || age >= 1) continue;
                /* Quick off the mark and still moving as it fades, the way a
                   ring crosses water, rather than crawling to a stop. */
                const ring = RIPPLE_REACH * (1 - (1 - age) ** 2);
                const off = (from - ring) / RIPPLE_BAND;
                if (off < -3 || off > 3) continue;
                const wave = Math.exp(-off * off) * (1 - age) ** 1.3 * height;
                atX += (fromX / from) * wave * RIPPLE_LIFT;
                atY += (fromY / from) * wave * RIPPLE_LIFT;
                size *= 1 + wave * 0.9;
                ink = Math.min(ink + alpha * wave * 4.2 * shade, 1);
              }
            }
          }
          ctx.globalAlpha = ink;
          ctx.beginPath();
          ctx.arc(atX - originX, atY - originY, size, 0, TURN);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    /** The resting grid, at the size of the window. Drawn on a resize and on
     *  an appearance change, and at no other time. */
    function paintRest() {
      rest.clearRect(0, 0, width, height);
      dots(rest, 0, 0, width + GAP, height + GAP, 0, 0, false, false);
    }

    /** The pebbles' patch of the resting grid, rings and all: redrawn every
     *  frame while they run, and once more at rest after the last settles.
     *  Snapped to the grid with its edges between columns, like the live
     *  square, and only as big as the rings can reach. */
    function paintRipples() {
      let next: typeof patch = null;
      for (const drop of drops) {
        const x0 = Math.floor((drop.x - RIPPLE_SPAN) / GAP) * GAP;
        const y0 = Math.floor((drop.y - RIPPLE_SPAN) / GAP) * GAP;
        const x1 = Math.ceil((drop.x + RIPPLE_SPAN) / GAP) * GAP;
        const y1 = Math.ceil((drop.y + RIPPLE_SPAN) / GAP) * GAP;
        next = next
          ? {
              x0: Math.min(next.x0, x0),
              y0: Math.min(next.y0, y0),
              x1: Math.max(next.x1, x1),
              y1: Math.max(next.y1, y1),
            }
          : { x0, y0, x1, y1 };
      }
      /* What it covered last frame as well, so a pebble that has settled is
         put back at rest. */
      const area = next && patch
        ? {
            x0: Math.min(next.x0, patch.x0),
            y0: Math.min(next.y0, patch.y0),
            x1: Math.max(next.x1, patch.x1),
            y1: Math.max(next.y1, patch.y1),
          }
        : next ?? patch;
      patch = next;
      if (!area) return;
      const x0 = Math.max(0, area.x0);
      const y0 = Math.max(0, area.y0);
      const x1 = Math.min(Math.ceil(width / GAP) * GAP, area.x1);
      const y1 = Math.min(Math.ceil(height / GAP) * GAP, area.y1);
      if (x1 < x0 || y1 < y0) return;
      rest.clearRect(x0 - EDGE, y0 - EDGE, x1 - x0 + EDGE * 2, y1 - y0 + EDGE * 2);
      dots(rest, x0, y0, x1, y1, 0, 0, false, true);
    }

    /** And the square that follows the pointer. */
    function paintLive() {
      const half = LIVE / 2;
      /* Snapped to the grid and pulled back by EDGE, so the square's edges fall
         between two columns of dots. */
      const originX = Math.round((x - half) / GAP) * GAP - EDGE;
      const originY = Math.round((y - half) / GAP) * GAP - EDGE;

      live.clearRect(0, 0, LIVE, LIVE);
      /* What it is sitting on, so the resting dots underneath are hidden
         rather than added to. */
      live.fillStyle = ground;
      live.fillRect(0, 0, LIVE, LIVE);
      dots(
        live,
        originX + EDGE,
        originY + EDGE,
        originX + LIVE,
        originY + LIVE,
        originX,
        originY,
        true,
        true,
      );
      liveCanvas.style.transform = `translate3d(${originX}px, ${originY}px, 0)`;
      if (!showing) {
        liveCanvas.style.visibility = "visible";
        showing = true;
      }
    }

    /**
     * Hiding the live square needs no redraw: the resting grid was only
     * covered.
     */
    function hideLive() {
      if (!showing) return;
      liveCanvas.style.visibility = "hidden";
      showing = false;
    }

    function step(now: number) {
      frame = 0;
      const delta = Math.min(now - (last || now), 64);
      last = now;
      clock = now;
      while (drops.length && now - drops[0].at >= KEPT_MS) drops.shift();
      const rippling = drops.length > 0;
      if (rippling || patch) paintRipples();

      if (seen > 0) {
        toX = sumX / seen;
        toY = sumY / seen;
        sumX = 0;
        sumY = 0;
        seen = 0;
      }

      const wasX = x;
      const wasY = y;
      const wasStrength = strength;
      /* The position is taken directly, not chased: smoothing a position is lag
         (an exponential follow trails by its time constant). Jitter from uneven
         pointer events per frame is removed by averaging the frame's events
         above. The push's fade in and out keeps its time constant, which is a
         chosen duration. */
      x = toX;
      y = toY;
      strength += (want - strength) * (1 - Math.exp(-delta / TAU_STRENGTH));

      /* Two separate questions. Is there anywhere left to go? That decides
         whether the loop stops, so a resting pointer does not repaint the
         canvas every frame; the remaining distance is snapped once tiny. Did
         anything move? That only decides whether this frame draws; it cannot be
         the stopping rule, because the first frame after waking has no delta
         yet. */
      const moved =
        Math.abs(x - wasX) > 0.05 ||
        Math.abs(y - wasY) > 0.05 ||
        Math.abs(strength - wasStrength) > 0.0005;
      /* Which leaves the fade as the only thing with anywhere left to go, and
         the pointer as the only thing that can give it somewhere new. */
      const arrived = Math.abs(want - strength) <= 0.0005;
      if (arrived) strength = want;

      if (strength <= 0.001) hideLive();
      else if (moved || arrived || rippling) paintLive();
      if (!arrived || rippling) frame = requestAnimationFrame(step);
    }

    function wake() {
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(step);
      }
    }

    function onMove(event: PointerEvent) {
      /* The canvas box is read when it changes, not on every move:
         `getBoundingClientRect` forces layout. */
      const atX = event.clientX - box.left;
      const atY = event.clientY - box.top;
      sumX += atX;
      sumY += atY;
      seen += 1;
      // First contact starts the pointer where it is rather than sweeping it in
      // from the corner, which would shove a stripe across the page.
      if (want === 0) {
        toX = atX;
        toY = atY;
        x = atX;
        y = atY;
      }
      want = 1;
      wake();
    }

    /** Whether a press landed on the ground itself: not a control, and nothing
     *  painted between it and the page the field belongs to (a card, a bar). */
    function onGround(target: Element | null) {
      if (!target || target.closest("a, button, input, textarea, select, label, summary, [role], [contenteditable]")) {
        return false;
      }
      for (let node: Element | null = target; node && !node.contains(host); node = node.parentElement) {
        const paint = getComputedStyle(node).backgroundColor;
        if (paint && paint !== "transparent" && !/^rgba?\([^)]*,\s*0(\.0+)?\)$/.test(paint)) return false;
      }
      return true;
    }

    function drop(atX: number, atY: number) {
      drops.push({ x: atX - box.left, y: atY - box.top, at: performance.now() });
      if (drops.length > RIPPLES) drops.shift();
      wake();
    }

    function onDown(event: PointerEvent) {
      if (event.button !== 0 || !onGround(event.target as Element | null)) return;
      /* A finger going down may be a scroll starting; it waits to be a tap. */
      if (event.pointerType === "touch") {
        touch = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() };
        return;
      }
      if (!still) want = 1;
      drop(event.clientX, event.clientY);
    }

    function onUp(event: PointerEvent) {
      const start = touch;
      touch = null;
      if (!start || event.pointerId !== start.id) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > TAP_SLOP || performance.now() - start.at > TAP_MS) return;
      drop(start.x, start.y);
    }

    function onGone() {
      want = 0;
      wake();
    }

    /* Leaving the window: `pointerleave` on the document does not fire in every
       browser, and `pointerout` with no related target is the one that does. */
    function onOut(event: PointerEvent) {
      if (!event.relatedTarget) onGone();
    }

    function measure() {
      const rect = host.getBoundingClientRect();
      box.left = rect.left;
      box.top = rect.top;
      /* Exactly one canvas pixel per CSS pixel. Cost scales with the backing
         store's area, so 2x on high-DPI screens dropped frames; below 1 is
         slower too, because a non-integer ratio is resampled. The dots are
         small and faint, so the lost sharpness is invisible. */
      const ratio = Math.min(window.devicePixelRatio || 1, 1);
      width = rect.width;
      height = rect.height;
      if (!width || !height) return;

      restCanvas.width = Math.round(width * ratio);
      restCanvas.height = Math.round(height * ratio);
      rest.setTransform(ratio, 0, 0, ratio, 0, 0);
      /* The live square never changes size. That is the whole of the fix: the
         field costs the same on a laptop and on a 4K monitor. */
      liveCanvas.width = Math.round(LIVE * ratio);
      liveCanvas.height = Math.round(LIVE * ratio);
      liveCanvas.style.width = `${LIVE}px`;
      liveCanvas.style.height = `${LIVE}px`;
      live.setTransform(ratio, 0, 0, ratio, 0, 0);

      readTheme();
      setVeil();
      paintRest();
      if (strength > 0) wake();
    }

    measure();

    const resize = new ResizeObserver(measure);
    resize.observe(host);

    // The palette flips under the appearance toggle, and the dots are drawn in
    // it rather than styled with it, so the canvas has to be told.
    const repaint = () => {
      readTheme();
      setVeil();
      paintRest();
      if (showing) paintLive();
    };
    const themed = new MutationObserver(repaint);
    themed.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const scheme = window.matchMedia("(prefers-color-scheme: light)");
    scheme.addEventListener("change", repaint);

    if (!still) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerout", onOut);
      document.addEventListener("pointerleave", onGone);
      document.addEventListener("mouseleave", onGone);
      window.addEventListener("blur", onGone);
    }
    /* Pebbles for every pointer, a finger included; only not under reduced
       motion. */
    if (!reduced) {
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      themed.disconnect();
      scheme.removeEventListener("change", repaint);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerleave", onGone);
      document.removeEventListener("mouseleave", onGone);
      window.removeEventListener("blur", onGone);
    };
  }, []);

  return (
    /* The host keeps the class, so every caller's `position`, `inset` and
       tokens go on working unchanged; the two surfaces sit inside it. */
    <div ref={hostRef} className={`g-dots ${className ?? ""}`} aria-hidden="true">
      <canvas ref={restRef} className="g-dots-rest" />
      <canvas ref={liveRef} className="g-dots-live" />
    </div>
  );
}
