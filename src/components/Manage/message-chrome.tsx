"use client";

import React from "react";
import { MarkdownToolbar } from "./markdown-toolbar";
import { InsertMenu } from "./insert-menu";
import { JellyThumb, useJellyThumb } from "@/components/motion";

export type MessageMode = "embed" | "container";

/**
 * The row over every message editor: formatting buttons on the left, the
 * message kind on the right. It stays at the top of the pane while scrolling,
 * since the buttons act on the field last typed in.
 */
export function MessageEditorBar({
  containerRef,
  mode,
  onMode,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  mode: MessageMode;
  onMode: (next: MessageMode) => void;
}) {
  return (
    <div className="gw-md-bar">
      <MarkdownToolbar containerRef={containerRef} className="gw-md-format" />
      {/* Mentions, times and emoji, inserted into the part last typed in. */}
      <span className="gw-md-insert">
        <InsertMenu containerRef={containerRef} />
      </span>
      <ModeSwitch mode={mode} onChange={onMode} />
    </div>
  );
}

/* Two options and a thumb that slides between them, rather than two buttons
   whose backgrounds swap on the frame you press one. */
export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: MessageMode;
  onChange: (next: MessageMode) => void;
}) {
  const box = React.useRef<HTMLDivElement | null>(null);
  useJellyThumb(box, mode);
  return (
    <div ref={box} className="gw-seg" role="radiogroup" aria-label="Message type" data-value={mode}>
      <JellyThumb />
      {(["embed", "container"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          data-on={mode === option ? "true" : undefined}
          className="gw-seg-opt"
          onClick={() => onChange(option)}
        >
          {option === "embed" ? "Embed" : "Container"}
        </button>
      ))}
    </div>
  );
}
