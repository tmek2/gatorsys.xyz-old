"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal, flushSync } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { FOLDERS, MODULE_BY_KEY } from "../modules";
import { FolderTile } from "./folder-tile";
import { boundedPosition, moveItem } from "./drag-geometry";

const HOLD_MS = 260;
type Gesture = {
  key: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  w: number;
  h: number;
  active: boolean;
  original: string[];
};

/** A viewport-layer copy follows the pointer; the pane cannot clip the card.
 * React owns the order and Motion owns only the neighbouring transforms. */
export function ModuleWallGrid({
  picked,
  onPick,
  onOpen,
}: {
  picked: string | null;
  onPick: (key: string) => void;
  onOpen: (key: string) => void;
}) {
  const [order, setOrder] = useState<string[]>(() => FOLDERS.map((f) => f.key));
  const orderRef = useRef(order);
  const grid = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressed = useRef(false);
  const [carried, setCarried] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [ghostTheme, setGhostTheme] = useState<CSSProperties>({});
  const settling = useRef<Animation | null>(null);
  const reduced = useReducedMotion();
  const clearHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const reorder = (next: string[]) => {
    orderRef.current = next;
    setOrder(next);
  };
  function finish(cancel = false) {
    clearHold();
    const g = gesture.current;
    if (g && carried) {
      if (cancel) flushSync(() => reorder(g.original));
      setAnnouncement(
        cancel
          ? "Rearrangement cancelled."
          : `${MODULE_BY_KEY.get(g.key)?.name ?? g.key} moved to position ${orderRef.current.indexOf(g.key) + 1}.`,
      );
    }
    if (!g) return;
    g.active = false;
    settling.current?.cancel();
    const release = () => {
      gesture.current = null;
      setCarried(null);
      settling.current = null;
    };
    const destination = grid.current?.querySelector<HTMLElement>(
      `[data-module="${g.key}"]`,
    );
    if (!reduced && ghost.current && destination && carried) {
      const base = grid.current!.getBoundingClientRect();
      const to = `translate3d(${base.left + destination.offsetLeft}px, ${base.top + destination.offsetTop}px, 0)`;
      settling.current = ghost.current.animate(
        [{ transform: ghost.current.style.transform }, { transform: to }],
        { duration: 170, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" },
      );
      settling.current.onfinish = release;
    } else release();
  }
  useEffect(() => {
    if (!carried) return;
    const pane = grid.current?.closest<HTMLElement>(".g-mac-pane");
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        finish(true);
      }
    };
    const blur = () => finish(true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", blur);
    let raf = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const g = gesture.current;
      if (!g?.active || !grid.current || !pane) return;
      const bounds = pane.getBoundingClientRect();
      const left = boundedPosition(
        g.x,
        g.dx,
        g.w,
        bounds.left + 12,
        bounds.right - 12,
      );
      const top = boundedPosition(
        g.y,
        g.dy,
        g.h,
        bounds.top + 12,
        bounds.bottom - 12,
      );

      /* When the card is stopped at the wall's edge, the grip point slides
         instead, so the pointer stays against the card's edge and moving back
         moves the card on the next frame (otherwise there is a dead band the
         size of the overshoot). Clamped to the card's width and height. */
      g.dx = Math.max(0, Math.min(g.w, g.dx + (g.x - g.dx - left)));
      g.dy = Math.max(0, Math.min(g.h, g.dy + (g.y - g.dy - top)));
      if (ghost.current)
        ghost.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      const step = Math.min(now - previous, 32) * 0.42;
      previous = now;
      const speed =
        g.y < bounds.top + 42 ? -step : g.y > bounds.bottom - 42 ? step : 0;
      if (speed) pane.scrollTop += speed;
      const base = grid.current.getBoundingClientRect();
      // Layout offsets exclude neighbouring cards' in-flight transforms.
      const target = (
        Array.from(grid.current.children) as HTMLElement[]
      ).findIndex((el) => {
        const x = base.left + el.offsetLeft,
          y = base.top + el.offsetTop;
        return (
          g.x >= x &&
          g.x <= x + el.offsetWidth &&
          g.y >= y &&
          g.y <= y + el.offsetHeight
        );
      });
      const from = orderRef.current.indexOf(g.key);
      if (target >= 0 && target !== from)
        reorder(moveItem(orderRef.current, from, target));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", blur);
    };
    // The gesture and order refs stay current for the entire pickup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carried]);
  useEffect(() => {
    const cancelPending = () => {
      if (gesture.current && !gesture.current.active && !settling.current) {
        clearHold();
        gesture.current = null;
      }
    };
    const preventHeldScroll = (e: TouchEvent) => {
      if (gesture.current?.active) e.preventDefault();
    };
    const node = grid.current;
    window.addEventListener("pointerup", cancelPending);
    window.addEventListener("blur", cancelPending);
    node?.addEventListener("touchmove", preventHeldScroll, { passive: false });
    return () => {
      clearHold();
      settling.current?.cancel();
      window.removeEventListener("pointerup", cancelPending);
      window.removeEventListener("blur", cancelPending);
      node?.removeEventListener("touchmove", preventHeldScroll);
    };
  }, []);
  const tile = (key: string, preview = false) => {
    const f = FOLDERS.find((item) => item.key === key)!;
    const m = MODULE_BY_KEY.get(key);
    return (
      <FolderTile
        moduleKey={key}
        label={f.label}
        hue={f.hue}
        say={m?.purpose}
        meta={m?.group}
        selected={picked === key}
        dragged={() => preview || suppressed.current}
        onSelect={() => onPick(key)}
        onOpen={() => onOpen(key)}
      />
    );
  };
  return (
    <>
      <div
        ref={grid}
        className="g-wall-grid g-module-grid"
        data-holding={carried ? "true" : "false"}
        onPointerDownCapture={(e) => {
          if (e.button !== 0 || !e.isPrimary || gesture.current?.active) return;
          const item = (e.target as HTMLElement).closest<HTMLElement>(
            "[data-module]",
          );
          if (!item) return;
          clearHold();
          settling.current?.cancel();
          settling.current = null;
          setCarried(null);
          suppressed.current = false;
          const box = item.getBoundingClientRect();
          const g: Gesture = {
            key: item.dataset.module!,
            x: e.clientX,
            y: e.clientY,
            dx: e.clientX - box.left,
            dy: e.clientY - box.top,
            w: box.width,
            h: box.height,
            active: false,
            original: [...orderRef.current],
          };
          gesture.current = g;
          const pointer = e.pointerId;
          timer.current = setTimeout(() => {
            timer.current = null;
            if (gesture.current !== g) return;
            g.active = true;
            suppressed.current = true;
            const style = getComputedStyle(item);
            setGhostTheme(
              Object.fromEntries(
                [
                  "--mac-chrome",
                  "--mac-label",
                  "--mac-label-dim",
                  "--mac-hair",
                  "--mac-raise",
                  "--mac-raise-2",
                  "--mac-pane-bg",
                ].map((name) => [name, style.getPropertyValue(name)]),
              ),
            );
            grid.current?.setPointerCapture(pointer);
            setCarried(g.key);
            setAnnouncement(
              `${MODULE_BY_KEY.get(g.key)?.name ?? g.key} picked up. Drag to move; Escape cancels.`,
            );
          }, HOLD_MS);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          if (!g.active && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 7) {
            clearHold();
            suppressed.current = true;
            gesture.current = null;
            return;
          }
          g.x = e.clientX;
          g.y = e.clientY;
          if (g.active) e.preventDefault();
        }}
        onPointerUp={() => finish()}
        onPointerCancel={() => finish(true)}
        onPointerLeave={() => {
          if (gesture.current && !gesture.current.active && !settling.current) {
            clearHold();
            gesture.current = null;
          }
        }}
        onLostPointerCapture={() => {
          if (gesture.current?.active) finish(true);
        }}
        onKeyDown={(e) => {
          if (
            !e.altKey ||
            !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          )
            return;
          const item = (e.target as HTMLElement).closest<HTMLElement>(
            "[data-module]",
          );
          if (!item) return;
          e.preventDefault();
          e.stopPropagation();
          const from = orderRef.current.indexOf(item.dataset.module!);
          const next = moveItem(
            orderRef.current,
            from,
            from + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1),
          );
          reorder(next);
          setAnnouncement(
            `Moved to position ${next.indexOf(item.dataset.module!) + 1}.`,
          );
        }}
      >
        {order.map((key) => (
          <motion.div
            layout="position"
            key={key}
            data-module={key}
            className="g-module-slot"
            transition={{
              duration: reduced ? 0 : 0.24,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ opacity: carried === key ? 0.18 : 1 }}
          >
            {tile(key)}
          </motion.div>
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {carried &&
        gesture.current &&
        createPortal(
          <div
            ref={ghost}
            className="g-root g-module-ghost"
            aria-hidden="true"
            inert
            style={{
              ...ghostTheme,
              width: gesture.current.w,
              height: gesture.current.h,
              transform: `translate3d(${gesture.current.x - gesture.current.dx}px,${gesture.current.y - gesture.current.dy}px,0)`,
            }}
          >
            {tile(carried, true)}
          </div>,
          document.body,
        )}
    </>
  );
}
