"use client";

import React from "react";
import {
  IconBlockquote,
  IconBold,
  IconCode,
  IconEyeOff,
  IconH3,
  IconItalic,
  IconLink,
  IconList,
  IconStrikethrough,
  IconUnderline,
} from "@tabler/icons-react";

/**
 * Discord's markdown as buttons (Discohook has a similar row), so
 * `||spoiler||`, `-# subtext` and `### heading` are discoverable. Wraps a
 * selection, or with nothing selected inserts the markers with the caret
 * between them. Line prefixes (quote, heading, subtext, list) apply to every
 * line the selection touches and toggle off when already present.
 */

type Wrap = { kind: "wrap"; before: string; after: string };
type Prefix = { kind: "prefix"; marker: string };
type Action = Wrap | Prefix;

const ACTIONS: {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: Action;
}[] = [
  { id: "bold", label: "Bold", icon: <IconBold size={14} />, action: { kind: "wrap", before: "**", after: "**" } },
  { id: "italic", label: "Italic", icon: <IconItalic size={14} />, action: { kind: "wrap", before: "*", after: "*" } },
  { id: "underline", label: "Underline", icon: <IconUnderline size={14} />, action: { kind: "wrap", before: "__", after: "__" } },
  { id: "strike", label: "Strikethrough", icon: <IconStrikethrough size={14} />, action: { kind: "wrap", before: "~~", after: "~~" } },
  { id: "spoiler", label: "Spoiler", icon: <IconEyeOff size={14} />, action: { kind: "wrap", before: "||", after: "||" } },
  { id: "code", label: "Code", icon: <IconCode size={14} />, action: { kind: "wrap", before: "`", after: "`" } },
  { id: "link", label: "Link", icon: <IconLink size={14} />, action: { kind: "wrap", before: "[", after: "](https://)" } },
  { id: "heading", label: "Heading", icon: <IconH3 size={14} />, action: { kind: "prefix", marker: "### " } },
  { id: "quote", label: "Quote", icon: <IconBlockquote size={14} />, action: { kind: "prefix", marker: "> " } },
  { id: "list", label: "Bullet list", icon: <IconList size={14} />, action: { kind: "prefix", marker: "- " } },
];

/**
 * Writes to a React-controlled field through the native value setter: assigning
 * `.value` directly is swallowed by React's descriptor, and the following
 * `input` event would carry the stale value. `insertVariable` does the same.
 */
function writeValue(
  target: HTMLTextAreaElement | HTMLInputElement,
  next: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const setter = Object.getOwnPropertyDescriptor(
    target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(target, next);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.focus();
  try {
    target.setSelectionRange(selectionStart, selectionEnd);
  } catch {
    /* a field that does not support selection ranges keeps the caret it had */
  }
}

function applyWrap(target: HTMLTextAreaElement | HTMLInputElement, wrap: Wrap) {
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  const selected = target.value.slice(start, end);
  const before = target.value.slice(0, start);
  const after = target.value.slice(end);

  // Already wrapped: unwrap, so the button toggles rather than nesting markers
  // every time it is pressed.
  if (
    before.endsWith(wrap.before) &&
    after.startsWith(wrap.after) &&
    wrap.after !== "](https://)"
  ) {
    const next =
      before.slice(0, -wrap.before.length) + selected + after.slice(wrap.after.length);
    const caret = start - wrap.before.length;
    writeValue(target, next, caret, caret + selected.length);
    return;
  }

  const next = `${before}${wrap.before}${selected}${wrap.after}${after}`;
  const caret = start + wrap.before.length;
  writeValue(target, next, caret, caret + selected.length);
}

function applyPrefix(target: HTMLTextAreaElement | HTMLInputElement, prefix: Prefix) {
  const value = target.value;
  const start = target.selectionStart ?? value.length;
  const end = target.selectionEnd ?? start;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const allPrefixed = lines.every((line) => line.startsWith(prefix.marker));
  const nextLines = lines.map((line) =>
    allPrefixed ? line.slice(prefix.marker.length) : `${prefix.marker}${line}`,
  );
  const nextBlock = nextLines.join("\n");
  const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
  writeValue(target, next, lineStart, lineStart + nextBlock.length);
}

/**
 * Acts on the last text field focused inside `containerRef`, like the variable
 * chips and insert menu.
 */
export function MarkdownToolbar({
  containerRef,
  className = "",
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  function run(action: Action) {
    const container = containerRef.current;
    if (!container) return;
    const stored = (container as any).__lastFocused as
      | HTMLTextAreaElement
      | HTMLInputElement
      | undefined;
    const target =
      stored && container.contains(stored)
        ? stored
        : container.querySelector<HTMLTextAreaElement>("textarea");
    if (!target) return;
    if (action.kind === "wrap") applyWrap(target, action);
    else applyPrefix(target, action);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${className}`}
      role="toolbar"
      aria-label="Discord formatting"
    >
      {ACTIONS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          aria-label={item.label}
          // `onMouseDown` with the default prevented, not `onClick`: a click
          // blurs the textarea first, losing the selection.
          onMouseDown={(event) => {
            event.preventDefault();
            run(item.action);
          }}
          onClick={(event) => {
            // Keyboard activation has no preceding mouse press.
            if (event.detail === 0) run(item.action);
          }}
          className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
