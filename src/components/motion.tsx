"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from "react";

/**
 * Keeps an element mounted long enough to animate out, and gives it a starting
 * frame to animate in from (mounting straight into the open state skips the
 * entrance).
 *
 *   const { mounted, state } = usePresence(open);
 *   if (!mounted) return null;
 *   return <div data-enter={state} data-enter-from="bottom">…</div>;
 *
 * `data-enter` is styled by styles/motion.css, so callers only choose the
 * direction, never the timing.
 */
export function usePresence(
  open: boolean,
  { duration = 220 }: { duration?: number } = {},
) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"from" | "to">("from");
  const frames = useRef<number[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const clearFrames = () => {
      frames.current.forEach((id) => window.cancelAnimationFrame(id));
      frames.current = [];
    };
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    clearFrames();

    if (open) {
      setMounted(true);
      setState("from");
      // Two frames: one to commit the closed state, one to flip it. A single
      // rAF can still land inside the same paint and skip the transition.
      frames.current.push(
        window.requestAnimationFrame(() => {
          frames.current.push(
            window.requestAnimationFrame(() => setState("to")),
          );
        }),
      );
    } else {
      setState("from");
      // Hold the element while it animates away, then drop it.
      timer.current = window.setTimeout(() => setMounted(false), duration);
    }

    return () => {
      clearFrames();
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [open, duration]);

  return { mounted, state } as const;
}

/**
 * True once the component has been on screen for a frame, for entrance
 * animations that should not run during hydration.
 */
export function useMounted(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  return ready;
}

/**
 * A picture that develops into place once it has loaded: held back blurred and
 * slightly large, then settling, like a photo arriving in Photos. Key it by its
 * source so a new picture starts over; a URL still being typed simply never
 * arrives instead of flashing a broken image.
 */
export function DevelopingImage({
  className,
  onLoad,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  // A cached picture can finish before the listener has anything to report.
  useLayoutEffect(() => {
    const node = ref.current;
    if (node?.complete && node.naturalWidth > 0) setReady(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...props}
      ref={ref}
      data-ready={ready ? "true" : "false"}
      className={`g-develop-load ${className ?? ""}`}
      onLoad={(event) => {
        setReady(true);
        onLoad?.(event);
      }}
    />
  );
}

/**
 * Stable keys for a list whose items have no ids. Items are matched to the last
 * render by identity (an edit replaces one object, a removal keeps the others)
 * and by position where identity is lost (Discard restoring the saved list). An
 * edited row keeps its key, an appended row gets a new one, a removed row's key
 * goes with it.
 */
export function useListKeys<T>(items: readonly T[]): string[] {
  const state = useRef<{ items: readonly T[]; keys: string[]; next: number } | null>(null);
  if (!state.current) {
    state.current = { items, keys: items.map((_, index) => `k${index}`), next: items.length };
    return state.current.keys;
  }
  const memo = state.current;
  if (memo.items === items) return memo.keys;
  const previous = memo.items;
  const used = new Set<number>();
  const keys: string[] = items.map((item) => {
    const at = previous.findIndex((candidate, index) => candidate === item && !used.has(index));
    if (at === -1) return "";
    used.add(at);
    return memo.keys[at];
  });
  for (let index = 0; index < items.length; index += 1) {
    if (keys[index]) continue;
    if (index < previous.length && !used.has(index)) {
      used.add(index);
      keys[index] = memo.keys[index];
    } else {
      keys[index] = `k${memo.next++}`;
    }
  }
  memo.items = items;
  memo.keys = keys;
  return keys;
}

/**
 * A list whose rows unroll in and fold away, however they were added or removed
 * (a delete button, Discard, undo). A removed row is held on screen, inert, for
 * its exit and then dropped. The first render does not animate.
 */
/** How long a row takes to unroll: `g-li-in` in globals.css. */
const ENTER_MS = 400;

export function PresenceList<T>({
  items,
  keys: given,
  render,
  className,
  inline = false,
  exitMs = 260,
  itemStyle,
}: {
  items: readonly T[];
  /** Worked out from the items when they carry no ids of their own. */
  keys?: string[];
  render: (item: T, index: number, leaving: boolean) => React.ReactNode;
  className?: string;
  /** Rows that sit in a line (chips): they shrink away rather than fold. */
  inline?: boolean;
  exitMs?: number;
  /** Style for a row's own wrapper -- a grid column span, say, where the
   *  list is a grid and each row decides its own width. */
  itemStyle?: (item: T, index: number) => React.CSSProperties | undefined;
}) {
  const derived = useListKeys(items);
  const keys = given ?? derived;
  const mounted = useRef(false);
  const shown = useRef<Map<string, { item: T; index: number }>>(new Map());
  const leaving = useRef<Map<string, { item: T; index: number; at: number }>>(new Map());
  /** Rows still unrolling, and when each began. */
  const fresh = useRef<Map<string, number>>(new Map());
  const [, bump] = useState(0);

  // What left since the last render, and what is new.
  const current = new Set(keys);
  for (const [key, entry] of shown.current) {
    if (!current.has(key) && !leaving.current.has(key)) {
      leaving.current.set(key, { ...entry, at: Date.now() });
    }
  }
  for (const key of keys) {
    leaving.current.delete(key);
    if (mounted.current && !shown.current.has(key)) fresh.current.set(key, Date.now());
  }
  const next = new Map<string, { item: T; index: number }>();
  keys.forEach((key, index) => next.set(key, { item: items[index], index }));
  shown.current = next;

  useEffect(() => {
    mounted.current = true;
  }, []);
  /* Rows are marked settled after their entrance, because an entering row clips
     its contents (focus rings, floating toolbars) for the length of the unroll. */
  useEffect(() => {
    if (!fresh.current.size) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      for (const [key, at] of fresh.current) {
        if (now - at >= ENTER_MS) fresh.current.delete(key);
      }
      bump((n) => n + 1);
    }, ENTER_MS);
    return () => window.clearTimeout(timer);
  });
  useEffect(() => {
    if (!leaving.current.size) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      for (const [key, entry] of leaving.current) {
        if (now - entry.at >= exitMs - 20) leaving.current.delete(key);
      }
      bump((n) => n + 1);
    }, exitMs);
    return () => window.clearTimeout(timer);
  });

  const rows: { key: string; item: T; index: number; state: "enter" | "leave" | "idle" }[] = keys.map(
    (key, index) => ({ key, item: items[index], index, state: fresh.current.has(key) ? "enter" : "idle" }),
  );
  for (const [key, entry] of leaving.current) {
    rows.splice(Math.min(entry.index, rows.length), 0, { key, item: entry.item, index: entry.index, state: "leave" });
  }

  return (
    <div className={className}>
      {rows.map((row) => (
        <div
          key={row.key}
          className="g-li"
          data-inline={inline ? "true" : undefined}
          data-state={row.state}
          style={itemStyle?.(row.item, row.index)}
          inert={row.state === "leave" ? true : undefined}
          aria-hidden={row.state === "leave" ? true : undefined}
        >
          <div className="g-li-clip">{render(row.item, row.index, row.state === "leave")}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Folds a row away, then removes it: for lists that cannot use `PresenceList`
 * because something else (a drag) keys off their elements. The row closes
 * through its own height so the rows below rise with it.
 */
export function foldAway(element: Element | null, remove: () => void) {
  const node = element as HTMLElement | null;
  if (
    !node ||
    typeof node.animate !== "function" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    remove();
    return;
  }
  const height = node.getBoundingClientRect().height;
  node.style.overflow = "clip";
  node.style.pointerEvents = "none";
  node
    .animate(
      [
        { height: `${height}px`, opacity: 1, transform: "scale(1)" },
        {
          height: "0px",
          opacity: 0,
          transform: "scale(0.985)",
          marginTop: "0px",
          marginBottom: "0px",
          paddingTop: "0px",
          paddingBottom: "0px",
          borderTopWidth: "0px",
          borderBottomWidth: "0px",
        },
      ],
      { duration: 260, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
    )
    .finished.then(remove, remove);
}

/* ── the sliding selection ──

   A segmented control's thumb moved like iOS 26's: the leading edge leaves
   first and fast, the trailing edge follows on a slower spring, so the thumb
   stretches as it travels and gathers itself as it lands, lifting slightly
   mid-jump. Three slices (two round caps and a bar) so stretching never
   squashes the corners, all moved by transforms on the compositor. */

type Edge = { l: number; r: number; t: number; h: number };

/** A damped spring from 0 to 1, as Apple parameterises them. */
function spring(time: number, response: number, damping: number) {
  const omega = (2 * Math.PI) / response;
  if (damping >= 1) {
    return 1 - Math.exp(-omega * time) * (1 + omega * time);
  }
  const decay = damping * omega;
  const wd = omega * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-decay * time) * (Math.cos(wd * time) + (decay / wd) * Math.sin(wd * time));
}

const JELLY_MS = 560;
const JELLY_STEPS = 42;

/** The thumb's slices. Render it as the first child of the control. */
export function JellyThumb({ className = "" }: { className?: string }) {
  return (
    <span className={`g-jelly ${className}`} aria-hidden="true">
      <i data-p="l" />
      <i data-p="m" />
      <i data-p="r" />
    </span>
  );
}

/**
 * Keeps a control's `JellyThumb` under its selected option, jumping when the
 * selection changes. `selected` is the option's selector (default:
 * `data-on="true"`); `value` is whatever changes with it.
 */
export function useJellyThumb(
  box: React.RefObject<HTMLElement | null>,
  value: unknown,
  selected = '[data-on="true"]',
) {
  const at = useRef<Edge | null>(null);
  const flight = useRef<{ from: Edge; to: Edge; start: number; dir: number } | null>(null);

  useLayoutEffect(() => {
    const node = box.current;
    const thumb = node?.querySelector<HTMLElement>(":scope > .g-jelly");
    if (!node || !thumb) return;
    const [capL, bar, capR] = Array.from(thumb.children) as HTMLElement[];
    const radius = () => capL.offsetWidth || 8;

    const measure = (): Edge | null => {
      const on = node.querySelector<HTMLElement>(selected);
      if (!on) return null;
      return { l: on.offsetLeft, r: on.offsetLeft + on.offsetWidth, t: on.offsetTop, h: on.offsetHeight };
    };
    const frame = (l: number, r: number, lift: number, cap: number) => {
      const width = Math.max(0, r - l - 2 * cap);
      return [
        `translateX(${l}px) scaleY(${lift})`,
        `translateX(${l + cap - 0.5}px) scaleX(${width + 1}) scaleY(${lift})`,
        `translateX(${r - cap}px) scaleY(${lift})`,
      ];
    };
    const rest = (edge: Edge) => {
      const cap = radius();
      thumb.style.top = `${edge.t}px`;
      thumb.style.height = `${edge.h}px`;
      const [a, b, c] = frame(edge.l, edge.r, 1, cap);
      capL.style.transform = a;
      bar.style.transform = b;
      capR.style.transform = c;
      thumb.dataset.ready = "true";
    };
    /* Where the thumb is drawn right now, mid-flight or not, so a second press
       during a jump starts the next one from where the eye is. */
    const now = (): Edge | null => {
      const f = flight.current;
      if (!f) return at.current;
      const t = Math.min(1, (performance.now() - f.start) / JELLY_MS) * (JELLY_MS / 1000);
      const lead = spring(t, 0.34, 0.74);
      const tail = spring(t, 0.46, 0.92);
      const [a, b] = f.dir > 0 ? [tail, lead] : [lead, tail];
      return {
        l: f.from.l + (f.to.l - f.from.l) * a,
        r: f.from.r + (f.to.r - f.from.r) * b,
        t: f.to.t,
        h: f.to.h,
      };
    };

    const next = measure();
    if (!next) {
      thumb.dataset.ready = "false";
      return;
    }
    const from = now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const moved = from && (Math.abs(from.l - next.l) > 0.5 || Math.abs(from.r - next.r) > 0.5);
    if (!from || !moved || reduce || from.t !== next.t) {
      rest(next);
      at.current = next;
      flight.current = null;
    } else {
      const cap = radius();
      const dir = next.l + next.r > from.l + from.r ? 1 : -1;
      const frames: string[][] = [[], [], []];
      const offsets: number[] = [];
      for (let i = 0; i <= JELLY_STEPS; i++) {
        const p = i / JELLY_STEPS;
        const t = p * (JELLY_MS / 1000);
        const lead = spring(t, 0.34, 0.74);
        const tail = spring(t, 0.46, 0.92);
        const [a, b] = dir > 0 ? [tail, lead] : [lead, tail];
        const l = from.l + (next.l - from.l) * a;
        const r = Math.max(l + 2 * cap, from.r + (next.r - from.r) * b);
        // Up on the way, a touch under on landing, then still.
        const lift = p < 0.45 ? 1 + 0.1 * Math.sin((p / 0.45) * Math.PI) : 1 - 0.03 * Math.sin(((p - 0.45) / 0.55) * Math.PI);
        frame(l, r, lift, cap).forEach((transform, slice) => frames[slice].push(transform));
        offsets.push(p);
      }
      thumb.style.top = `${next.t}px`;
      thumb.style.height = `${next.h}px`;
      [capL, bar, capR].forEach((slice, index) => {
        slice.getAnimations().forEach((running) => running.cancel());
        const [a, b, c] = frame(next.l, next.r, 1, cap);
        slice.style.transform = [a, b, c][index];
        slice.animate(
          frames[index].map((transform, k) => ({ transform, offset: offsets[k] })),
          { duration: JELLY_MS, easing: "linear" },
        );
      });
      flight.current = { from, to: next, start: performance.now(), dir };
      at.current = next;
      window.setTimeout(() => {
        if (flight.current?.to === next) flight.current = null;
      }, JELLY_MS);
    }

    // A control that changes width (a count arriving, the window resizing)
    // puts the thumb back under its option, without a jump.
    const watch = new ResizeObserver(() => {
      if (flight.current) return;
      const edge = measure();
      if (!edge) return;
      rest(edge);
      at.current = edge;
    });
    watch.observe(node);
    return () => watch.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selected]);
}
