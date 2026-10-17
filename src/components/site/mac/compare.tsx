"use client";

/* The before/after wipe, adapted from Aceternity's Compare: - No particle
   engine and no glow on the seam: one hairline in the accent and a grab handle.
   - Pointer Events with capture: one path for mouse, touch and pen that keeps
   tracking past the edges. - It demonstrates itself once, with a CSS keyframe,
   then stops (nothing on the landing runs on a timer). - It is a real slider:
   `role="slider"`, arrow keys, Home and End. */

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export function Compare({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  start = 55,
  autoplay = true,
  className,
}: {
  before: ReactNode;
  after: ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  /** Where the seam sits at rest, as a percentage from the left. */
  start?: number;
  autoplay?: boolean;
  className?: string;
}) {
  const [at, setAt] = useState(start);
  const [held, setHeld] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const held$ = useRef(false);
  const over$ = useRef(false);

  /* The invitation: one sweep, declared as a keyframe under `[data-invite]`.
     The attribute comes off the moment a pointer or key arrives, handing the
     seam straight to the user. */
  const [invited, setInvited] = useState(autoplay);
  const settle = useCallback(() => setInvited(false), []);

  const place = useCallback((clientX: number) => {
    const node = box.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setAt(Math.max(0, Math.min(100, pct)));
  }, []);

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    settle();
    held$.current = true;
    setHeld(true);
    // Keeps the drag alive past the edges of the element, and past the edge of
    // the window on touch.
    event.currentTarget.setPointerCapture(event.pointerId);
    place(event.clientX);
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!held$.current && event.pointerType !== "mouse") return;
    settle();
    place(event.clientX);
  };
  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    held$.current = false;
    setHeld(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
  };

  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    settle();
    const step = event.shiftKey ? 10 : 4;
    if (event.key === "ArrowLeft") setAt((v) => Math.max(0, v - step));
    else if (event.key === "ArrowRight") setAt((v) => Math.min(100, v + step));
    else if (event.key === "Home") setAt(0);
    else if (event.key === "End") setAt(100);
    else return;
    event.preventDefault();
  };

  return (
    <div
      ref={box}
      className={`g-cmp${held ? " g-cmp-held" : ""} ${className ?? ""}`}
      data-invite={invited ? "true" : undefined}
      style={{ ["--at" as string]: `${at}%` }}
      role="slider"
      tabIndex={0}
      aria-label={`${beforeLabel} and ${afterLabel}. Drag to compare.`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(at)}
      aria-valuetext={`${Math.round(at)}% ${beforeLabel.toLowerCase()}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          over$.current = true;
          settle();
        }
      }}
      onPointerLeave={(e) => {
        over$.current = false;
        if (e.pointerType === "mouse") onUp(e);
      }}
      onKeyDown={onKey}
    >
      {/* After sits underneath and is whole. Before is clipped over it, so the
          seam is one clip-path rather than two elements chasing each other. */}
      <div className="g-cmp-layer g-cmp-after">{after}</div>
      <div className="g-cmp-layer g-cmp-before">{before}</div>

      <span className="g-cmp-tag g-cmp-tag-before" aria-hidden="true">
        {beforeLabel}
      </span>
      <span className="g-cmp-tag g-cmp-tag-after" aria-hidden="true">
        {afterLabel}
      </span>

      <span className="g-cmp-seam" aria-hidden="true">
        <span className="g-cmp-grip">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
            <path
              d="M9.5 7.5 L5.5 12 L9.5 16.5 M14.5 7.5 L18.5 12 L14.5 16.5"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </div>
  );
}
