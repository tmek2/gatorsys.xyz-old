"use client";

import React, { useState } from "react";
import { IconChevronDown, IconExternalLink } from "@tabler/icons-react";
import { isImageToken, PreviewImage, PreviewInline, PreviewText } from "../embed-editor";
import { DiscordFrame } from "../discord-message";
import { accentHex } from "./accent";
import {
  ContainerBlock,
  ContainerRowButton,
  SystemComponentPreview,
  toEditorLayout,
  rowButtonColor,
} from "./model";

/* How a container message looks in Discord: the read-only preview of its blocks and buttons. */

/** Discord's four button colours, by the names this dashboard stores. */
export function dcButtonStyle(style?: string): "primary" | "secondary" | "success" | "danger" {
  const color = rowButtonColor({ style: style ?? "Blue" });
  if (color === "Green") return "success";
  if (color === "Red") return "danger";
  if (color === "Grey") return "secondary";
  return "primary";
}

/**
 * Discord-like controls for the layout canvas and the live preview. They
 * respond to clicks so a dropdown can be checked before publishing, but preview
 * clicks run no bot action.
 */
export function SystemControlsPreview({
  controls,
  compact = false,
}: {
  controls: SystemComponentPreview[];
  compact?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [clicked, setClicked] = useState<string>("");
  return (
    <div className="dc-action-row dc-controls" data-size={compact ? "compact" : undefined}>
      {controls.map((control, index) =>
        control.kind === "select" ? (
          <div key={index} className="dc-select-wrap">
            <button
              type="button"
              disabled={control.disabled}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="dc-select"
              aria-expanded={openIndex === index}
            >
              <span>
                {selected[index] != null
                  ? control.options?.[selected[index]]?.label || "Selected option"
                  : control.placeholder || "Make a selection"}
              </span>
              <IconChevronDown size={16} className="dc-select-caret" data-open={openIndex === index ? "true" : undefined} />
            </button>
            {openIndex === index ? (
              <div className="dc-select-menu">
                {(control.options || []).map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    type="button"
                    onClick={() => {
                      setSelected({ ...selected, [index]: optionIndex });
                      setOpenIndex(null);
                    }}
                    className="dc-select-opt"
                  >
                    {option.emoji ? <span>{option.emoji}</span> : null}
                    <span className="dc-select-opt-say">
                      <span className="dc-select-opt-label">{option.label || "Option"}</span>
                      {option.description ? <span className="dc-select-opt-note">{option.description}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <button
            key={index}
            type="button"
            disabled={control.disabled}
            onClick={() => {
              setClicked(control.label || "Button");
              window.setTimeout(() => setClicked(""), 1400);
            }}
            className="dc-btn"
            data-style={dcButtonStyle(control.style)}
          >
            {control.emoji ? <span>{control.emoji}</span> : null}
            {control.label || "Button"}
          </button>
        ),
      )}
      {clicked ? <span className="dc-note">“{clicked}” previewed. Nothing was sent.</span> : null}
    </div>
  );
}

/** A Discord-styled button used by the container preview: markdown label,
 *  custom/unicode emoji, and link arrow — matching what the bot sends. */
export function PreviewButton({ button }: { button: ContainerRowButton }) {
  const type = button.type || (button.command ? "button" : "link");
  return (
    <span
      className="dc-btn"
      data-style={type === "link" ? "secondary" : dcButtonStyle(rowButtonColor(button))}
      data-disabled={button.disabled ? "true" : undefined}
      aria-disabled={button.disabled ? "true" : undefined}
    >
      {button.emoji ? <PreviewInline text={button.emoji} /> : null}
      <PreviewInline text={button.label || "Button"} />
      {type === "link" ? <IconExternalLink size={14} className="dc-btn-out" aria-hidden="true" /> : null}
    </span>
  );
}

export function ContainerPreview({
  blocks: storedBlocks,
  color,
  content,
  systemButtons,
  explicitLayout,
}: {
  blocks: ContainerBlock[];
  color: string;
  content?: string;
  systemButtons?: SystemComponentPreview[];
  /**
   * Mirrors the message's `v2_explicit_layout` (see toEditorLayout). Required
   * so every editor that renders a container passes it; a missing value would
   * draw a "no container" layout inside a box.
   */
  explicitLayout: boolean;
}) {
  // Normalised at the boundary, so the preview draws the same tree the editor
  // edits — an implicit wrapper shown as the container it actually is.
  const blocks = toEditorLayout(storedBlocks, explicitLayout);
  const accent = accentHex(color);
  return (
    <DiscordFrame>
          {content ? (
            <div className="dc-content">
              <PreviewText text={content} />
            </div>
          ) : null}
          {/* A layout that places its own containers is drawn as it is; one that
             does not keeps its single box. */}
          <div className="dc-blocks">
            {blocks.length === 0 ? (
              <div
                className="dc-container"
                data-accent={accent ? undefined : "none"}
                style={{ ["--container-accent" as string]: accent || undefined }}
              >
                <div className="dc-container-inner">
                  <span className="dc-ghost" aria-hidden="true">
                    <span className="dc-ghost-line" data-line="title" />
                    <span className="dc-ghost-line" data-line="body" />
                  </span>
                </div>
              </div>
            ) : (
              // Drawn exactly as the tree says. `toEditorLayout` has already
              // added any implicit container; `ContainerPreviewBlocks` boxes
              // container blocks and leaves the rest bare, as Discord does.
              <ContainerPreviewBlocks
                blocks={blocks}
                systemButtons={systemButtons}
                fallbackColor={color}
              />
            )}
          </div>
    </DiscordFrame>
  );
}

/** The blocks themselves, wherever they sit — inside a container's box or at
 *  the top level of the message. */
function ContainerPreviewBlocks({
  blocks,
  systemButtons,
  fallbackColor,
  inContainer = false,
}: {
  blocks: ContainerBlock[];
  systemButtons?: SystemComponentPreview[];
  fallbackColor: string;
  /** Whether these blocks are drawn inside a container's box, where Discord
   *  sets text a size smaller (0.875rem against 1rem). */
  inContainer?: boolean;
}) {
  return (
    <>
      {blocks.map((block, index) => (
        <DcBlockView
          key={index}
          block={block}
          systemButtons={systemButtons}
          fallbackColor={fallbackColor}
          inContainer={inContainer}
        />
      ))}
    </>
  );
}

/** One block as Discord draws it, on the surface. Shared by the preview and
 *  the container canvas, which wraps each one in its editing chrome. */
export function DcBlockView({
  block,
  systemButtons,
  fallbackColor,
  inContainer = false,
  children,
}: {
  block: ContainerBlock;
  systemButtons?: SystemComponentPreview[];
  fallbackColor: string;
  inContainer?: boolean;
  /** A container's contents, when the caller draws them itself. */
  children?: React.ReactNode;
}) {
  const size = inContainer ? "small" : undefined;
  if (block.type === "container") {
    const accent = accentHex(block.color || fallbackColor);
    const inner = block.blocks || [];
    return (
      <div
        className="dc-container"
        data-accent={accent ? undefined : "none"}
        style={{ ["--container-accent" as string]: accent || undefined }}
      >
        <div className="dc-container-inner">
          {children ??
            (inner.length === 0 ? (
              <span className="dc-ghost" aria-hidden="true">
                <span className="dc-ghost-line" data-line="title" />
                <span className="dc-ghost-line" data-line="body" />
              </span>
            ) : (
              <ContainerPreviewBlocks
                blocks={inner}
                systemButtons={systemButtons}
                fallbackColor={fallbackColor}
                inContainer
              />
            ))}
        </div>
      </div>
    );
  }
  if (block.type === "system_button") {
    const buttons = systemButtons && systemButtons.length ? systemButtons : [{ label: "Button" }];
    return <SystemControlsPreview controls={buttons} />;
  }
  if (block.type === "text") {
    return (
      <div className="dc-text-display" data-size={size}>
        <PreviewText text={block.content || ""} />
      </div>
    );
  }
  if (block.type === "separator") {
    return (
      <div
        className="dc-separator"
        data-line={block.divider === false ? "false" : undefined}
        data-size={block.spacing === "large" ? "large" : undefined}
      />
    );
  }
  if (block.type === "section") {
    return (
      <div className="dc-section">
        <div className="dc-section-text dc-text-display" data-size={size}>
          <PreviewText text={block.content || ""} />
        </div>
        {block.thumbnail_url ? (
          <PreviewImage
            src={block.thumbnail_url}
            className="dc-section-thumb"
            placeholderClassName="dc-section-thumb dc-img-token"
            label={isImageToken(block.thumbnail_url) ? block.thumbnail_url : "thumbnail"}
          />
        ) : null}
      </div>
    );
  }
  if (block.type === "text_button") {
    return (
      <div className="dc-section">
        <div className="dc-section-text dc-text-display" data-size={size}>
          <PreviewText text={block.content || ""} />
        </div>
        {block.button ? <PreviewButton button={block.button} /> : null}
      </div>
    );
  }
  if (block.type === "media_gallery") {
    const urls = (block.urls || []).slice(0, 10);
    return (
      <div className="dc-gallery" data-count={urls.length > 4 ? "many" : String(urls.length)}>
        {urls.map((url, i) => (
          <div key={i} className="dc-gallery-cell">
            <PreviewImage src={url} className="" placeholderClassName="dc-img-token" label={isImageToken(url) ? url : "image"} />
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "button_row") {
    return (
      <div className="dc-action-row">
        {(block.buttons || []).map((button, i) => (
          <PreviewButton key={i} button={button} />
        ))}
      </div>
    );
  }
  if (block.type === "message_dropdown") {
    return (
      <div className="dc-select">
        <span>{block.placeholder || "Choose a message"}</span>
        <IconChevronDown size={16} className="dc-select-caret" />
      </div>
    );
  }
  return null;
}
