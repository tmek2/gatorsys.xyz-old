"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconMessage, IconX } from "@tabler/icons-react";
import { DiscordPreview, EmbedForm } from "../embed-editor";
import {
  ContainerBlocksEditor,
  ContainerPreview,
  AccentSwatches,
  containerValidationError,
  type ContainerBlock,
} from "../message-design";
import { DiscordJsonBox } from "../discord-json-box";
import { applyMessageShape } from "../discord-json";
import { InsertMenu } from "../insert-menu";
import type { CustomMessage, MessageEmbed } from "../types";

/**
 * The message a workflow block sends, edited on the node. It reuses the module
 * message editors (`EmbedForm`, `ContainerBlocksEditor`, `DiscordPreview`,
 * `ContainerPreview`), so limits and previews are identical. Unlike a module
 * message, the value is serialised into the node's own `values` and travels
 * with the graph, which is why this is not `MessageDesignCard` (that card loads
 * and saves against `/api/manage/[id]/messages`).
 */

export type NodeMessage = CustomMessage & {
  v2_layout?: ContainerBlock[];
  v2_color?: string;
  /** Whether the layout places its own containers. See `toEditorLayout`. */
  v2_explicit_layout?: boolean;
  render_mode?: "legacy" | "v2";
};

const EMPTY: NodeMessage = {
  content: "",
  embed: {},
  components: [],
  v2_layout: [],
  v2_color: "none",
  render_mode: "legacy",
};

/**
 * Node values are strings, so the message is stored as JSON. Parsed
 * defensively: an unparseable value becomes an empty message rather than
 * crashing the canvas.
 */
export function parseNodeMessage(raw: string | undefined): NodeMessage {
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY };
    return {
      ...EMPTY,
      ...parsed,
      embed: parsed.embed && typeof parsed.embed === "object" ? parsed.embed : {},
      components: Array.isArray(parsed.components) ? parsed.components : [],
      v2_layout: Array.isArray(parsed.v2_layout) ? parsed.v2_layout : [],
      // Carried across the JSON boundary, or a message saved as "no
      // container" comes back as one.
      v2_explicit_layout: Boolean(parsed.v2_explicit_layout),
    };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * A one-line summary of the message, shown on the collapsed node instead of its
 * JSON.
 */
export function describeNodeMessage(message: NodeMessage): string {
  if (message.render_mode === "v2") {
    const count = (message.v2_layout || []).length;
    return count ? `Container · ${count} block${count === 1 ? "" : "s"}` : "Empty container";
  }
  const embed = message.embed || {};
  const title = typeof embed.title === "string" ? embed.title.trim() : "";
  if (title) return `Embed · ${title}`;
  const content = (message.content || "").trim();
  if (content) return content.length > 42 ? `${content.slice(0, 42)}…` : content;
  const parts = Object.values(embed).filter(
    (value) => value != null && value !== "" && !(Array.isArray(value) && !value.length),
  );
  return parts.length ? "Embed" : "Nothing set";
}

export function MessageValueEditor({
  value,
  onChange,
  onClose,
  title,
}: {
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  title: string;
}) {
  const initial = useMemo(() => parseNodeMessage(value), [value]);
  const [draft, setDraft] = useState<NodeMessage>(initial);
  const [mode, setMode] = useState<"embed" | "container">(
    initial.render_mode === "v2" ? "container" : "embed",
  );
  const surfaceRef = useRef<HTMLDivElement>(null);

  const layout = draft.v2_layout || [];
  const containerError = mode === "container" ? containerValidationError(layout) : null;

  // Escape closes, and the canvas behind stops scrolling while this is up.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  function patch(next: Partial<NodeMessage>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function commit() {
    // The mode is the document's own `render_mode`, not a separate piece of
    // editor state — otherwise a container built here sends as an embed.
    onChange(
      JSON.stringify({ ...draft, render_mode: mode === "container" ? "v2" : "legacy" }),
    );
    onClose();
  }

  /* Portalled to <body>: nodes live in the canvas's transformed pan/zoom layer,
     which would make `position: fixed` resolve against the canvas (and scale
     the panel with the zoom). */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="wf-message-modal" role="dialog" aria-modal="true" aria-label={`Message for ${title}`}>
      <button
        type="button"
        className="wf-message-scrim"
        aria-label="Close without saving"
        onClick={onClose}
      />
      <div className="wf-message-panel" ref={surfaceRef}>
        <header className="wf-message-head">
          <span className="wf-message-head-icon">
            <IconMessage size={16} />
          </span>
          <div className="min-w-0">
            <p className="wf-message-title">{title}</p>
            <p className="wf-message-sub">
              The same editor the feature message cards use, saved into the block
              rather than into a settings page.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </header>

        <div className="wf-message-modes" role="tablist">
          {(
            [
              ["embed", "Embed"],
              ["container", "Container"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`wf-message-mode ${mode === id ? "is-on" : ""}`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="wf-message-body">
          <div className="wf-message-form">
            <label className="wf-message-content">
              <span>Message content</span>
              <textarea
                rows={2}
                value={draft.content || ""}
                placeholder="Text above the embed or container. Optional."
                onChange={(event) => patch({ content: event.target.value })}
              />
            </label>

            {mode === "embed" ? (
              <EmbedForm
                embed={(draft.embed || {}) as MessageEmbed}
                onChange={(embedPatch) =>
                  patch({ embed: { ...(draft.embed || {}), ...embedPatch } })
                }
                insertMenu={<InsertMenu containerRef={surfaceRef} />}
              />
            ) : (
              <>
                <label className="wf-message-content">
                  <span>Accent colour</span>
                  <AccentSwatches
                    value={draft.v2_color || "none"}
                    onChange={(next) => patch({ v2_color: next })}
                  />
                </label>
                <ContainerBlocksEditor
                  blocks={layout}
                  explicitLayout={Boolean(draft.v2_explicit_layout)}
                  // Written as well as read: a node's message is rendered by
                  // the same builder as every other message, so it carries the
                  // same flag.
                  onChange={(next) =>
                    patch({ v2_layout: next, v2_explicit_layout: true })
                  }
                  insertMenu={<InsertMenu containerRef={surfaceRef} />}
                />
                {containerError ? (
                  <p className="wf-message-error">{containerError}</p>
                ) : null}
              </>
            )}
          </div>

          {/* A framed, sticky preview beside the fields. */}
          <aside className="wf-message-preview">
            <p className="wf-message-preview-label">Preview</p>
            <div className="wf-message-preview-stage">
              {mode === "container" ? (
                <ContainerPreview
                  blocks={layout}
                  color={draft.v2_color || "none"}
                  content={draft.content}
                  explicitLayout={Boolean(draft.v2_explicit_layout)}
                />
              ) : (
                <DiscordPreview message={draft as CustomMessage} />
              )}
            </div>
            {/* The same JSON box as every other message editor. `render_mode` is
               separate editor state here (the tab), so a pasted container also
               switches the tab. */}
            <DiscordJsonBox
              value={draft as CustomMessage}
              onApply={(next) => {
                const applied = applyMessageShape(draft, next) as NodeMessage;
                setDraft(applied);
                setMode(applied.render_mode === "v2" ? "container" : "embed");
              }}
            />
          </aside>
        </div>

        <footer className="wf-message-foot">
          <button type="button" className="wf-message-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="wf-message-save"
            disabled={Boolean(containerError)}
            onClick={commit}
          >
            Use this message
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
