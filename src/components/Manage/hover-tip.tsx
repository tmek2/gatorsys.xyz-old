"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "../motion";

/* Tooltip timing for a group: wait `OPEN` before the first tip; once one has
   shown, the next shows immediately for `SKIP` ms after the last closes;
   `CLOSE` is a short hold so a tip does not flicker crossing a seam between two
   controls. */
const OPEN = 380;
const SKIP = 420;
const CLOSE = 90;
/** When the group last had a tip on screen. Module-level: it is one group. */
let groupLeftAt = 0;

type Side = "top" | "bottom" | "left" | "right";

/** Space kept between a tip and the edge of the screen. */
const GUTTER = 8;
/** Space between a tip and the thing it is about. */
const GAP = 8;

/** Where a tip of this size goes: on the side asked for, unless that side has
    no room and the opposite one does, and slid along to stay on the screen. */
function placeTip(
  trigger: DOMRect,
  width: number,
  height: number,
  side: Side,
  align: "center" | "start" | "end",
): { left: number; top: number; side: Side } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let chosen: Side = side;
  if (side === "bottom" && trigger.bottom + GAP + height > vh - GUTTER && trigger.top - GAP - height > GUTTER) chosen = "top";
  if (side === "top" && trigger.top - GAP - height < GUTTER && trigger.bottom + GAP + height < vh - GUTTER) chosen = "bottom";
  if (side === "right" && trigger.right + GAP + width > vw - GUTTER && trigger.left - GAP - width > GUTTER) chosen = "left";
  if (side === "left" && trigger.left - GAP - width < GUTTER && trigger.right + GAP + width < vw - GUTTER) chosen = "right";

  let left: number;
  let top: number;
  if (chosen === "top" || chosen === "bottom") {
    top = chosen === "bottom" ? trigger.bottom + GAP : trigger.top - GAP - height;
    left =
      align === "start"
        ? trigger.left
        : align === "end"
          ? trigger.right - width
          : trigger.left + trigger.width / 2 - width / 2;
  } else {
    left = chosen === "right" ? trigger.right + GAP : trigger.left - GAP - width;
    top = trigger.top + trigger.height / 2 - height / 2;
  }
  left = Math.min(Math.max(GUTTER, left), vw - width - GUTTER);
  top = Math.min(Math.max(GUTTER, top), vh - height - GUTTER);
  return { left, top, side: chosen };
}

/**
 * The window's tooltip. - Portalled and placed from the trigger's measured box,
 * so `overflow: clip` ancestors cannot cut it off. - Placed on the requested
 * side, flipped when there is no room, and slid along its axis to stay on
 * screen. - Fades in and out on the same curve. - Uses the window's surface, so
 * it follows the theme.
 */
export function HoverTip({
  label,
  children,
  side = "bottom",
  align = "center",
  className = "",
  forceOpen = false,
  suppress = false,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: Side;
  /** For top/bottom tips, pin an edge to the trigger's instead of centring. */
  align?: "center" | "start" | "end";
  className?: string;
  /** Held open regardless of the pointer — a coach mark uses this. */
  forceOpen?: boolean;
  /** Held shut: the control has opened something, and a tip describing the
   *  control would sit on top of what it opened. */
  suppress?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const show = !suppress && (hovered || forceOpen);
  const presence = usePresence(show, { duration: 160 });
  const timer = useRef<number | undefined>(undefined);
  const anchor = useRef<HTMLSpanElement | null>(null);
  const tip = useRef<HTMLSpanElement | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number; side: Side } | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function open() {
    window.clearTimeout(timer.current);
    // Straight in if the group is already warm — moving along a row of
    // controls should not make you wait again at every one.
    const warm = Date.now() - groupLeftAt < SKIP;
    if (warm) {
      setHovered(true);
      return;
    }
    timer.current = window.setTimeout(() => setHovered(true), OPEN);
  }

  function close() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setHovered(false);
      groupLeftAt = Date.now();
    }, CLOSE);
  }

  const measure = useCallback(() => {
    const trigger = anchor.current?.getBoundingClientRect();
    const box = tip.current;
    if (!trigger || !box) return;
    setPlace(placeTip(trigger, box.offsetWidth, box.offsetHeight, side, align));
  }, [side, align]);

  useLayoutEffect(() => {
    if (!presence.mounted) return;
    measure();
  }, [presence.mounted, measure, label]);

  return (
    <span
      ref={anchor}
      className={`relative inline-flex ${className}`}
      onMouseEnter={open}
      onMouseLeave={close}
      /* A keyboard has no dwell to measure, so focus shows it at once. */
      onFocus={() => {
        window.clearTimeout(timer.current);
        setHovered(true);
      }}
      onBlur={close}
    >
      {children}
      {presence.mounted && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tip}
              role="tooltip"
              className="gw-tip"
              data-enter={presence.state}
              data-side={place?.side ?? side}
              style={place ? { left: place.left, top: place.top } : { left: -9999, top: 0 }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

/* ── every other tooltip ──

   Hundreds of controls use `title`, which shows the browser's own tooltip. One
   listener replaces them all: hovering anything with a `title` lifts the
   attribute off while the pointer is there (the browser only shows its tip if
   the attribute is still present when its timer fires) and shows the text in a
   `.gw-tip`, placed and timed like HoverTip. Leaving puts the attribute back,
   so accessible names still work. A press, key or scroll hides the tip. */
export function TitleTips() {
  const [label, setLabel] = useState<string | null>(null);
  const presence = usePresence(label !== null, { duration: 160 });
  const [shown, setShown] = useState("");
  const tip = useRef<HTMLSpanElement | null>(null);
  const owner = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [place, setPlace] = useState<{ left: number; top: number; side: Side } | null>(null);
  // Whether a tip is up right now: moving straight to the next control skips
  // the wait, as it does along a row of HoverTips.
  const live = useRef(false);

  useEffect(() => {
    if (label !== null) setShown(label);
  }, [label]);

  useEffect(() => {
    const giveBack = (element: HTMLElement | null) => {
      if (!element) return;
      const text = element.getAttribute("data-gw-title");
      if (text !== null) {
        element.setAttribute("title", text);
        element.removeAttribute("data-gw-title");
      }
    };
    const show = (text: string) => {
      live.current = true;
      setLabel(text);
    };
    const hide = (warm: boolean) => {
      window.clearTimeout(timer.current);
      giveBack(owner.current);
      owner.current = null;
      if (live.current && warm) groupLeftAt = Date.now();
      live.current = false;
      setLabel(null);
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target as Element | null;
      // The one it is on already has its title lifted, so it is matched by
      // where the title was put.
      const element =
        target?.closest?.<HTMLElement>("[title]:not([data-native-title]), [data-gw-title]") ?? null;
      if (!element) return;
      if (element === owner.current) {
        // Back on it before it let go: keep it, or start its wait again.
        window.clearTimeout(timer.current);
        const text = element.getAttribute("data-gw-title")?.trim();
        if (!live.current && text) {
          timer.current = window.setTimeout(() => {
            if (owner.current === element && element.isConnected) show(text);
          }, OPEN);
        }
        return;
      }
      const text = element.getAttribute("title")?.trim();
      if (!text) return;
      window.clearTimeout(timer.current);
      giveBack(owner.current);
      owner.current = element;
      element.setAttribute("data-gw-title", element.getAttribute("title") || "");
      element.removeAttribute("title");
      if (live.current || Date.now() - groupLeftAt < SKIP) show(text);
      else {
        timer.current = window.setTimeout(() => {
          if (owner.current === element && element.isConnected) show(text);
        }, OPEN);
      }
    };
    const onOut = (event: PointerEvent) => {
      const element = owner.current;
      if (!element) return;
      const next = event.relatedTarget as Node | null;
      if (next && element.contains(next)) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => hide(true), CLOSE);
    };
    const onPress = () => hide(false);
    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("keydown", onPress, true);
    window.addEventListener("scroll", onPress, true);
    return () => {
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("keydown", onPress, true);
      window.removeEventListener("scroll", onPress, true);
      window.clearTimeout(timer.current);
      giveBack(owner.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!presence.mounted || label === null) return;
    const trigger = owner.current?.getBoundingClientRect();
    const box = tip.current;
    if (!trigger || !box) return;
    setPlace(placeTip(trigger, box.offsetWidth, box.offsetHeight, "bottom", "center"));
  }, [presence.mounted, label, shown]);

  if (!presence.mounted || typeof document === "undefined") return null;
  return createPortal(
    <span
      ref={tip}
      role="tooltip"
      className="gw-tip"
      data-enter={presence.state}
      data-side={place?.side ?? "bottom"}
      style={place ? { left: place.left, top: place.top } : { left: -9999, top: 0 }}
    >
      {shown}
    </span>,
    document.body,
  );
}

/* ── coach marks ──

   A small mark on something new, with one line about it (Material's coach mark,
   GitLab's feature-discovery beacon): only for things that are genuinely new or
   non-obvious, a couple per screen at most, each shown once. */
const COACH_PREFIX = "gator-coach:";

function seen(id: string): boolean {
  try {
    return localStorage.getItem(COACH_PREFIX + id) === "1";
  } catch {
    // Storage that throws is a private window; a hint that cannot remember
    // being seen should not be shown at all rather than shown every time.
    return true;
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(COACH_PREFIX + id, "1");
  } catch {
    /* nothing to remember it in */
  }
}

export function CoachMark({
  id,
  tip,
  children,
  side = "bottom",
  align = "center",
  dot = "top-right",
  className = "",
  suppress = false,
}: {
  /** Stable name; seen once, gone for good. */
  id: string;
  tip: React.ReactNode;
  children: React.ReactNode;
  side?: Side;
  align?: "center" | "start" | "end";
  /** Which corner of the trigger the beacon sits on. */
  dot?: "top-right" | "top-left";
  className?: string;
  suppress?: boolean;
}) {
  // Read after mount: the server has no storage, and a hint that renders and
  // then vanishes on hydration is worse than one that arrives a frame late.
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    setFresh(!seen(id));
  }, [id]);

  const retire = useCallback(() => {
    if (!fresh) return;
    markSeen(id);
    setFresh(false);
  }, [fresh, id]);

  return (
    <span
      className={`gw-coach ${className}`}
      data-fresh={fresh ? "true" : undefined}
      data-dot={dot}
      // Captured, so the press that uses the thing retires the hint before the
      // thing reacts (a panel it opens should not arrive with a stale mark on
      // its button).
      onPointerDownCapture={retire}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") retire();
      }}
    >
      <HoverTip
        side={side}
        align={align}
        suppress={suppress}
        label={
          fresh ? (
            <span className="gw-coach-tip">{tip}</span>
          ) : (
            tip
          )
        }
      >
        {children}
      </HoverTip>
      {fresh ? <span className="gw-coach-dot" aria-hidden="true" /> : null}
    </span>
  );
}

/** The same once-and-gone memory, for a hint that is not a tooltip. */
export function useCoach(id: string): [boolean, () => void] {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    setFresh(!seen(id));
  }, [id]);
  const retire = useCallback(() => {
    markSeen(id);
    setFresh(false);
  }, [id]);
  return [fresh, retire];
}

