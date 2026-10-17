"use client";

/* Light, dark, auto: one button you press to cycle.

   - All three settings stay. Auto is the absence of a choice: it clears
     `data-theme` so the stylesheet's `prefers-color-scheme` block follows the
     device live. Pressing cycles light, dark, auto, so each is at most two
     presses away.
   - The label says both the current appearance and the next one. It is a real
     element, not `title`.
   - The three icons are always mounted and rotate past each other (swapping the
     child would leave nothing to animate).
   - The page changes with a circular wipe from the button, inside a view
     transition (the technique is Animate UI's theme toggler; theirs sweeps from
     an edge).
   - And a small flourish leaves the button as it does: a few stars twinkle
     out on the way to dark, a ring of short rays on the way to light. Auto
     gets neither; it is not a time of day.

   The value is applied before paint by a script in the document head. This
   component's own state fills in after mount (the server cannot read
   localStorage), and until then no icon is lit. */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { IconDeviceLaptop, IconMoon, IconSun } from "@tabler/icons-react";
import { THEME_KEY, type Theme } from "./theme";
import { useTipSpot } from "./hover-tip";
import "./theme-toggle.css";

export { THEME_KEY, THEME_SCRIPT } from "./theme";
export type { Theme } from "./theme";

const OPTIONS: { value: Theme; label: string; Icon: typeof IconSun }[] = [
  { value: "light", label: "Light mode", Icon: IconSun },
  { value: "dark", label: "Dark mode", Icon: IconMoon },
  { value: "auto", label: "Match device", Icon: IconDeviceLaptop },
];

const ORDER: Theme[] = ["light", "dark", "auto"];

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/** How long the appearance takes to cross the page. */
const WIPE_MS = 560;

/** How long the flourish is on the page; its longest part ends just before. */
const FLOURISH_MS = 900;
/** The stars: where each sits from the button's centre, how big, how late. */
const STARS = [
  { x: -16, y: -11, size: 9, delay: 0 },
  { x: 17, y: -7, size: 7, delay: 70 },
  { x: 6, y: 16, size: 6, delay: 140 },
];
/** The rays: eight, evenly round. */
const RAYS = Array.from({ length: 8 }, (_, index) => index * 45);

/* The switch as a circle opening from a point: `startViewTransition` snapshots
   before and after; the stylesheet turns off the default cross-fade and this
   animates the new snapshot's clip path, from the button until it covers the
   furthest corner. Without view transitions, under reduced motion, or if the
   transition fails, the appearance still changes. */
function wipe(from: { x: number; y: number } | null, change: () => void) {
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!from || reduced || typeof document.startViewTransition !== "function") {
    change();
    return;
  }

  // Scoped, so the rule that kills the cross-fade cannot also flatten the
  // route transitions this site runs on the same pseudo-elements.
  root.setAttribute("data-wipe", "true");

  const transition = document.startViewTransition(() => {
    // Synchronously, or the snapshot is taken before the change lands.
    flushSync(change);
  });

  const done = () => root.removeAttribute("data-wipe");

  transition.ready
    .then(() => {
      const { x, y } = from;
      // The radius that reaches the furthest corner from where it started.
      const far = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      root.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${far}px at ${x}px ${y}px)`],
        },
        {
          duration: WIPE_MS,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(done);

  transition.finished.then(done, done);
}

function nameOf(theme: Theme | null): string {
  return OPTIONS.find((option) => option.value === theme)?.label ?? "";
}

/* The setting without the control around it, shared by the header button and
   the phone menu's segmented control: the value, how to change it, and the
   wipe. `set` takes the pressed element, because the wipe opens from it. */
export function useAppearance() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_KEY);
    } catch {
      // Private windows and blocked storage both throw. Auto is the answer.
    }
    setTheme(stored === "light" || stored === "dark" ? stored : "auto");
  }, []);

  const set = useCallback((value: Theme, from: HTMLElement | null) => {
    const box = from?.getBoundingClientRect();
    const at = box
      ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      : null;

    wipe(at, () => {
      setTheme(value);
      apply(value);
    });

    try {
      if (value === "auto") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, value);
    } catch {
      // The appearance still changed; it just will not survive a reload.
    }
  }, []);

  return { theme, set, options: OPTIONS, order: ORDER };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, set } = useAppearance();
  /* The press animation is a state rather than `:active`, because it has to
     outlast the pointer being lifted — the icon is still turning. */
  const [turning, setTurning] = useState(false);

  const next = theme ? ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] : null;

  const block = useRef<HTMLButtonElement | null>(null);

  /* The flourish, drawn at the end of the document at the button's centre so
     no header clips it. Keyed by when it started, so a quick second press
     starts a fresh one. */
  const [flourish, setFlourish] = useState<{
    id: number;
    kind: "stars" | "rays";
    x: number;
    y: number;
  } | null>(null);
  const flourishTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(flourishTimer.current), []);

  const advance = useCallback(() => {
    if (!next) return;
    set(next, block.current);
    setTurning(true);
    window.setTimeout(() => setTurning(false), 320);

    const box = block.current?.getBoundingClientRect();
    if (next === "auto" || !box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlourish({
      id: Date.now(),
      kind: next === "dark" ? "stars" : "rays",
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    });
    window.clearTimeout(flourishTimer.current);
    flourishTimer.current = window.setTimeout(() => setFlourish(null), FLOURISH_MS);
  }, [next, set]);

  /* Drawn at the end of the document: the header is inside a sticky element, so
     a label hanging under it would be cut off by the landing window's top edge. */
  const tip = useTipSpot();

  return (
    <div
      ref={tip.host as React.RefObject<HTMLDivElement>}
      className={`g-theme ${className ?? ""}`}
      data-ready={theme ? "true" : "false"}
      data-turning={turning ? "true" : "false"}
      {...tip.hostProps}
    >
      <button
        ref={block}
        type="button"
        className="g-theme-block"
        onClick={advance}
        // The visible label is a hover affordance; this is the whole sentence
        // for anybody who is not looking at it.
        aria-label={
          theme
            ? `Appearance: ${nameOf(theme).toLowerCase()}. Press for ${nameOf(next).toLowerCase()}.`
            : "Appearance"
        }
      >
        <span className="g-theme-icons" aria-hidden="true">
          {OPTIONS.map(({ value, Icon }) => (
            <span
              className="g-theme-icon"
              key={value}
              data-on={theme === value ? "true" : "false"}
            >
              <Icon size={16} stroke={1.9} />
            </span>
          ))}
        </span>
      </button>

      {/* Not `title`. In the page, immediate, and under the control it names. */}
      {theme
        ? tip.draw(
            "g-theme-tip",
            <>
              <span className="g-theme-tip-now">{nameOf(theme)}</span>
              <span className="g-theme-tip-next">{nameOf(next)} next</span>
            </>,
          )
        : null}

      {flourish
        ? createPortal(
            <span
              key={flourish.id}
              className="g-theme-burst"
              data-kind={flourish.kind}
              style={{ left: `${flourish.x}px`, top: `${flourish.y}px` }}
              aria-hidden="true"
            >
              {flourish.kind === "stars"
                ? STARS.map((star, index) => (
                    <svg
                      key={index}
                      className="g-theme-star"
                      viewBox="0 0 10 10"
                      style={{
                        ["--x" as string]: `${star.x}px`,
                        ["--y" as string]: `${star.y}px`,
                        ["--s" as string]: `${star.size}px`,
                        animationDelay: `${star.delay}ms`,
                      }}
                    >
                      {/* Four points, pinched in the middle. */}
                      <path d="M5 0 Q5.6 4.4 10 5 Q5.6 5.6 5 10 Q4.4 5.6 0 5 Q4.4 4.4 5 0Z" />
                    </svg>
                  ))
                : RAYS.map((angle) => (
                    <span
                      key={angle}
                      className="g-theme-ray"
                      style={{ ["--a" as string]: `${angle}deg` }}
                    />
                  ))}
            </span>,
            document.body,
          )
        : null}
    </div>
  );
}
