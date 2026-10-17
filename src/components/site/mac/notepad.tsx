"use client";

/* A TextEdit window: opens over the Finder, draggable by its title bar, closed
   by its close button or Escape. Focus moves into the window on open and back
   to the file on close, and it is a labelled `dialog`. The body is monospaced
   and preformatted (a plain text file).

   Closing is a state, not an unmount: every way out sets `closing`, the exit
   animation plays, and the parent is told when it finishes. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "next-view-transitions";
import type { TextFile } from "./content";
import { IconX } from "@tabler/icons-react";

/** How long the window takes to leave. The stylesheet's `g-note-out` and this
 *  are one number in two places, and they have to stay one number. */
const EXIT_MS = 170;

export function Notepad({
  file,
  onClose,
}: {
  file: TextFile;
  onClose: () => void;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  /* The one number the animation and the component both have to agree on. */
  const requestClose = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setClosing(true);
  }, [onClose]);

  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(onClose, EXIT_MS);
    return () => window.clearTimeout(id);
  }, [closing, onClose]);

  useEffect(() => {
    frame.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    },
    [offset],
  );

  const moveDrag = useCallback((event: React.PointerEvent) => {
    const from = drag.current;
    if (!from) return;
    setOffset({
      x: from.ox + (event.clientX - from.x),
      y: from.oy + (event.clientY - from.y),
    });
  }, []);

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  const bytes = file.lines.reduce((n, line) => n + line.length + 1, 0);

  return (
    <div className="g-note-layer" data-closing={closing ? "true" : undefined}>
      {/* Clicking the desk behind the window closes it. A plain surface, hidden
         from assistive tech. */}
      <div className="g-note-desk" onClick={requestClose} aria-hidden="true" />

      <div
        className="g-note"
        role="dialog"
        aria-modal="true"
        aria-label={file.name}
        tabIndex={-1}
        ref={frame}
        /* Two custom properties rather than a transform, so the open and close
           keyframes can include the drag offset (an animation overrides a
           written transform). */
        style={{
          ["--nx" as string]: `${offset.x}px`,
          ["--ny" as string]: `${offset.y}px`,
        }}
      >
        <div
          className="g-win-bar g-note-bar"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="g-win-title">{file.name}</span>
          {/* One control: closing is the only thing this window does. */}
          <span className="g-win-acts">
            <button
              className="g-win-act g-win-act-close"
              type="button"
              onClick={requestClose}
              aria-label={`Close ${file.name}`}
            >
              <IconX size={16} stroke={2} />
            </button>
          </span>
        </div>

        <div className="g-note-body">
          <pre>{file.lines.join("\n")}</pre>
          {file.source ? (
            <p className="g-note-source">
              <Link href={file.source.href}>{file.source.label}</Link>
            </p>
          ) : null}
        </div>

        <div className="g-note-status">
          <span>Plain Text</span>
          <span>
            {file.lines.length} lines · {(bytes / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>
    </div>
  );
}
