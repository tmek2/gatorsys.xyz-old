"use client";

import { useCallback, useRef } from "react";

/**
 * Pull down to put a sheet or toast away. The node follows the finger
 * (resisting the wrong way); released past the threshold or flicked, it is
 * dismissed, otherwise it springs back. The transform is written straight to
 * the node while dragging (no render per frame) and removed in the frame the
 * caller closes, so the caller's exit starts from where the finger left it. The
 * caller must set `touch-action: none` on the handle, or the browser takes the
 * gesture as a scroll.
 */
export function useDragDismiss<T extends HTMLElement>({
  onDismiss,
  threshold = 72,
  disabled = false,
}: {
  onDismiss: (distance: number) => void;
  /** How far down counts as "away", in pixels. */
  threshold?: number;
  disabled?: boolean;
}) {
  const target = useRef<T | null>(null);
  const drag = useRef<{
    id: number;
    y: number;
    at: number;
    dy: number;
    moving: boolean;
  } | null>(null);
  /** True from the end of a drag until the click it causes, so the caller can
   *  tell a drag from a tap. */
  const moved = useRef(false);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (disabled || event.button !== 0) return;
      // Controls inside the handle are still controls.
      if ((event.target as HTMLElement).closest("input, textarea, select, [data-no-drag]")) return;
      drag.current = {
        id: event.pointerId,
        y: event.clientY,
        at: event.timeStamp,
        dy: 0,
        moving: false,
      };
      moved.current = false;
    },
    [disabled],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const state = drag.current;
    const node = target.current;
    if (!state || state.id !== event.pointerId || !node) return;
    const dy = event.clientY - state.y;
    if (!state.moving) {
      if (Math.abs(dy) < 6) return;
      state.moving = true;
      moved.current = true;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      node.style.transition = "none";
    }
    state.dy = dy;
    // Down is the way out. Up is resisted -- it moves, so the sheet does not
    // feel stuck, but a fifth as far as the finger.
    const shown = dy > 0 ? dy : dy / 5;
    node.style.transform = `translate3d(0, ${shown}px, 0)`;
  }, []);

  const finish = useCallback(
    (event: React.PointerEvent, cancelled: boolean) => {
      const state = drag.current;
      const node = target.current;
      drag.current = null;
      if (!state || state.id !== event.pointerId || !state.moving || !node) return;
      const elapsed = Math.max(1, event.timeStamp - state.at);
      const speed = state.dy / elapsed;
      const away =
        !cancelled && (state.dy > threshold || (state.dy > 24 && speed > 0.45));
      if (away) {
        // Both at once, before the next style pass: the node leaves from where
        // it is, not from where it started.
        node.style.transition = "";
        node.style.transform = "";
        onDismiss(state.dy);
        return;
      }
      node.style.transition = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";
      node.style.transform = "";
      const settle = () => {
        node.style.transition = "";
        node.removeEventListener("transitionend", settle);
      };
      node.addEventListener("transitionend", settle);
    },
    [onDismiss, threshold],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => finish(event, false),
    [finish],
  );
  const onPointerCancel = useCallback(
    (event: React.PointerEvent) => finish(event, true),
    [finish],
  );

  /** Swallow the click a drag ends in. */
  const wasDrag = useCallback(() => {
    const was = moved.current;
    moved.current = false;
    return was;
  }, []);

  return {
    target,
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    wasDrag,
  };
}
