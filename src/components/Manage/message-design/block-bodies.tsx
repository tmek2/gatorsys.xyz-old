"use client";

import React from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { CharacterCount } from "../embed-editor";
import { OptionCard, SelectField, TextAreaField, TextField } from "../fields";
import { type BlockPath } from "../block-tree";
import { PresenceList } from "@/components/motion";
import { Segments } from "../segments";
import { ButtonTargets } from "./button-controls";
import { RowButtonEditor } from "./button-editor";
import { CONTAINER_LIMITS, ContainerBlock, SystemComponentPreview } from "./model";
import { SystemControlsPreview } from "./preview";

/* The fields for each kind of block, one component per type. */

/**
 * A block type's own fields as a component. The row around it (fold, drag,
 * summary, errors, actions) is shared; this dispatcher picks the type's editor
 * from `BLOCK_BODY_EDITORS`, so a new type is a component plus a registry line.
 *
 * `patch` is already bound to this block, so a type editor never sees an index
 * and cannot write to the wrong block.
 */
export interface BlockBodyProps {
  block: ContainerBlock;
  patch: (next: Partial<ContainerBlock>) => void;
  /** The variable/emoji inserter, for types with a text field. */
  insertMenu?: React.ReactNode;
  /** Saved panels, forms and templates a button can point at. */
  targets?: ButtonTargets;
  /** The module's own action button(s), for the placeholder block. */
  systemButtons?: SystemComponentPreview[];
  /** Components in the whole message, so a nested editor enforces the
   *  message's ceiling rather than its own container's. */
  totalCount?: number;
  /** Whether the module button is already placed somewhere in this message —
   *  a whole-tree fact, so a container body does not offer a second one. */
  systemButtonPlaced?: boolean;
  /**
   * The kind of the block directly above, read-only, for types that depend on
   * what they sit under.
   */
  previousType?: string;
  /** This block's address in the message. Only the container body uses it, to
   *  tell its own nested editor where in the tree its list begins. */
  path?: BlockPath;
}

/** The markdown field three types share, rather than three copies of it. */
function ContentField({ block, patch, insertMenu }: BlockBodyProps) {
  return (
    <div className="space-y-1">
      <TextAreaField
        rows={2}
        value={block.content || ""}
        maxLength={CONTAINER_LIMITS.text}
        trailing={insertMenu}
        placeholder="Markdown supported: **bold**, ### heading, > quote"
        onChange={(next) => patch({ content: next })}
      />
      <div className="flex justify-end">
        <CharacterCount value={block.content} limit={CONTAINER_LIMITS.text} />
      </div>
    </div>
  );
}

export function TextBody(props: BlockBodyProps) {
  return <ContentField {...props} />;
}

export function TextButtonBody(props: BlockBodyProps) {
  const { block, patch, targets } = props;
  return (
    <>
      <ContentField {...props} />
      <div className="mt-2">
        {block.button ? (
          <RowButtonEditor
            button={block.button}
            targets={targets}
            onChange={(next) => patch({ button: next })}
            onRemove={() => patch({ button: null })}
          />
        ) : (
          <button
            type="button"
            onClick={() => patch({ button: { type: "link", label: "", url: "" } })}
            className="gw-btn"
          >
            <IconPlus size={12} />
            Attach button
          </button>
        )}
      </div>
    </>
  );
}

/** Discord's two separator settings: whether the line is drawn, and how much
 *  room it leaves (small or large). */
export function SeparatorBody({ block, patch }: BlockBodyProps) {
  return (
    <div className="gw-sep-tools">
      <OptionCard
        compact
        label="Divider line"
        checked={block.divider !== false}
        onChange={(next) => patch({ divider: next })}
      />
      <div className="gw-sep-space">
        <span className="gw-cv-label">Spacing</span>
        <Segments
          label="Spacing"
          value={block.spacing === "large" ? "large" : "small"}
          options={[
            { value: "small", label: "Small" },
            { value: "large", label: "Large" },
          ]}
          onChange={(next) => patch({ spacing: next })}
        />
      </div>
    </div>
  );
}

export function SectionBody(props: BlockBodyProps) {
  const { block, patch } = props;
  return (
    <>
      <ContentField {...props} />
      <div className="mt-2">
        <TextField
          value={block.thumbnail_url || ""}
          placeholder="Thumbnail URL"
          onChange={(next) => patch({ thumbnail_url: next })}
        />
      </div>
    </>
  );
}

export function MediaGalleryBody({ block, patch }: BlockBodyProps) {
  const urls = block.urls || [];
  return (
    <div className="space-y-2">
      {urls.map((url, i) => (
        <div key={i} className="flex gap-2">
          <TextField
            value={url}
            placeholder="https://… image URL"
            onChange={(next) => {
              const copy = [...urls];
              copy[i] = next;
              patch({ urls: copy });
            }}
          />
          <button
            type="button"
            onClick={() => patch({ urls: urls.filter((_, ui) => ui !== i) })}
            className="shrink-0 px-1 text-white/35 hover:text-[var(--tone-bad)]"
            aria-label="Remove image"
          >
            <IconTrash size={16} />
          </button>
        </div>
      ))}
      {/* Discord's own ceiling on a gallery. */}
      {urls.length < CONTAINER_LIMITS.galleryItems ? (
        <button
          type="button"
          onClick={() => patch({ urls: [...urls, ""] })}
          className="gw-btn"
        >
          <IconPlus size={12} />
          Add image
        </button>
      ) : null}
    </div>
  );
}

export function ButtonRowBody({ block, patch, targets }: BlockBodyProps) {
  const buttons = block.buttons || [];
  return (
    <div className="space-y-2">
      <PresenceList
        items={buttons}
        className="space-y-2"
        render={(button, i) => (
        <RowButtonEditor
          button={button}
          targets={targets}
          onChange={(next) => {
            const copy = [...buttons];
            copy[i] = next;
            patch({ buttons: copy });
          }}
          onRemove={() => patch({ buttons: buttons.filter((_, bi) => bi !== i) })}
        />
        )}
      />
      {/* Discord fits five components across one action row. */}
      {buttons.length < CONTAINER_LIMITS.rowWidth ? (
        <button
          type="button"
          onClick={() =>
            patch({ buttons: [...buttons, { type: "link", label: "", url: "" }] })
          }
          className="gw-btn self-start"
        >
          <IconPlus size={13} aria-hidden="true" />
          Add button
        </button>
      ) : null}
    </div>
  );
}

export function SystemButtonBody({ block, patch, systemButtons, previousType }: BlockBodyProps) {
  return (
    <div className="space-y-2 rounded-xl border border-[var(--accent-peach)]/30 bg-[rgb(var(--accent-rgb)/0.08)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <SystemControlsPreview
          controls={systemButtons && systemButtons.length ? systemButtons : [{ label: "Button" }]}
          compact
        />
        <span className="cool-text text-[11px]">
          Live feature controls. Drag this block to move them.
        </span>
      </div>
      {/* Lets the module button(s) share the row of the block directly above
          (e.g. a custom Button Row), matching the /config freedom. */}
      {previousType === "button_row" ? (
        <OptionCard
          compact
          label="Put in the same row as the button row above"
          checked={Boolean(block.inline)}
          onChange={(next) => patch({ inline: next })}
        />
      ) : null}
    </div>
  );
}

export function MessageDropdownBody({ block, patch }: BlockBodyProps) {
  return (
    <div className="space-y-2">
      <TextField
        value={block.placeholder || ""}
        maxLength={150}
        placeholder="Dropdown placeholder, e.g. Choose a message"
        onChange={(next) => patch({ placeholder: next })}
      />
      <div className="space-y-2">
        {(block.templates || []).map((template, i) => (
          <div key={i} className="flex gap-2">
            <TextField
              value={template.name || ""}
              placeholder="Saved template name"
              onChange={(next) => {
                const templates = [...(block.templates || [])];
                templates[i] = { ...template, name: next };
                patch({ templates });
              }}
            />
            <div className="w-36 shrink-0">
              <SelectField
                value={template.type || "template"}
                options={[
                  { value: "template", label: "Embed/Container" },
                  { value: "message", label: "Message" },
                ]}
                onChange={(next) => {
                  const templates = [...(block.templates || [])];
                  templates[i] = { ...template, type: next || "template" };
                  patch({ templates });
                }}
              />
            </div>
            <button
              type="button"
              onClick={() =>
                patch({
                  templates: (block.templates || []).filter((_, ti) => ti !== i),
                })
              }
              className="shrink-0 px-1 text-white/35 hover:text-[var(--tone-bad)]"
              aria-label="Remove option"
            >
              <IconTrash size={16} />
            </button>
          </div>
        ))}
        {(block.templates || []).length < CONTAINER_LIMITS.selectOptions ? (
          <button
            type="button"
            onClick={() =>
              patch({
                templates: [...(block.templates || []), { name: "", type: "template" }],
              })
            }
            className="gw-btn"
          >
            <IconPlus size={12} />
            Add option
          </button>
        ) : null}
      </div>
      <OptionCard
        compact
        label="Send the chosen message privately (ephemeral)"
        checked={block.ephemeral !== false}
        onChange={(next) => patch({ ephemeral: next })}
      />
    </div>
  );
}
