"use client";

import React, { useEffect, useRef } from "react";
import {
  setPreviewOverrides,
  trackFocus,
  VariableChips,
} from "./embed-editor";
import { FieldRow, SettingsCard } from "./fields";
import { DiscordJsonBox } from "./discord-json-box";
import { applyMessageShape } from "./discord-json";
import { MessageEditorBar } from "./message-chrome";
import {
  ensureBlockIds,
  LegacyButtonRowsEditor,
  TemplateBar,
  injectLegacyModuleButton,
  type ContainerBlock,
  type SystemComponentPreview,
} from "./message-design";
import { EmbedCanvas } from "./embed-canvas";
import { ContainerCanvas } from "./container-canvas";
import { VariableAutocomplete } from "./variable-autocomplete";
import { useManage } from "./manage-context";
import { messagesEqual } from "./config-compare";
import type { MessageEmbed } from "./types";

export interface MessageObjectValue {
  content?: string;
  embed?: MessageEmbed;
  embeds?: MessageEmbed[];
  render_mode?: "legacy" | "v2";
  v2_layout?: ContainerBlock[];
  v2_color?: string;
  components?: any[];
  [key: string]: any;
}

/**
 * Controlled message editor with two modes, an embed builder and a Components
 * v2 container builder, plus a live preview and clickable variables. Backs any
 * message stored as a {content, embed} / v2 object.
 */
export function MessageObjectEditor({
  value,
  onChange,
  variables,
  hideContent = false,
  previewButtons,
  systemButtons: systemButtonsProp,
  module,
}: {
  value: MessageObjectValue;
  onChange: (next: MessageObjectValue) => void;
  variables: string[];
  hideContent?: boolean;
  previewButtons?: { label?: string; url?: string; emoji?: string }[];
  /** The module's own action button(s) (Open, Join, Close + Claim…) — enables
   *  the drag-to-place placeholder. Falls back to the preview buttons. */
  systemButtons?: SystemComponentPreview[];
  /** The module this message belongs to, for the variable list's tags. */
  module?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeEmbed, setActiveEmbed] = React.useState(0);
  useEffect(() => {
    trackFocus(containerRef.current);
  });

  const mode: "embed" | "container" = value.render_mode === "v2" ? "container" : "embed";
  const embeds: MessageEmbed[] = Array.isArray(value.embeds) && value.embeds.length
    ? value.embeds
    : [value.embed || {}];
  const safeEmbedIndex = Math.min(activeEmbed, embeds.length - 1);
  const currentEmbed = embeds[safeEmbedIndex] || {};
  function writeEmbeds(next: MessageEmbed[], nextIndex = safeEmbedIndex) {
    const cleaned = next.length ? next.slice(0, 10) : [{}];
    setActiveEmbed(Math.max(0, Math.min(nextIndex, cleaned.length - 1)));
    onChange({ ...value, embed: cleaned[0], embeds: cleaned.length > 1 ? cleaned : undefined });
  }
  const rawBlocks: ContainerBlock[] = Array.isArray(value.v2_layout) ? value.v2_layout : [];
  // A module's own action button(s) can be positioned inside the container via a
  // draggable placeholder — explicit prop wins, else the preview buttons.
  const systemButtons =
    systemButtonsProp || (previewButtons && previewButtons.length ? previewButtons : undefined);
  // Show placements made via the Discord /config editor (stored as an integer
  // v2_button_after + v2_button_inline) as a draggable placeholder.
  const blocks = injectLegacyModuleButton(
    rawBlocks,
    systemButtons,
    value.v2_button_after,
    Boolean(value.v2_button_inline),
  );
  // When a placeholder is present the layout is the source of truth — drop the
  // legacy index and mirror the inline flag onto it.
  function writeLayout(next: ContainerBlock[]) {
    // Saving marks the layout explicit (`v2_explicit_layout`), so "no
    // container" can be expressed. The bot reads the same flag rather than
    // inspecting the tree (as Discord's IsComponentsV2 works), so preview and
    // sent message agree.
    const patch: MessageObjectValue = {
      ...value,
      // Ids are minted here rather than on read: minting on read would hand
      // out a new key every render and rebuild the row under the caret.
      v2_layout: ensureBlockIds(next),
      v2_explicit_layout: true,
    };
    const placeholder = next.find((block) => block.type === "system_button");
    if (placeholder) {
      patch.v2_button_after = undefined;
      patch.v2_button_inline = Boolean(placeholder.inline) || undefined;
    }
    onChange(patch);
  }

  return (
    <div className="gw-md">
      <MessageEditorBar
        containerRef={containerRef}
        mode={mode}
        onMode={(option) =>
          onChange({ ...value, render_mode: option === "container" ? "v2" : "legacy" })
        }
      />
      {/* `{` in any field of this editor offers this message's variables. */}
      <VariableAutocomplete containerRef={containerRef} variables={variables} module={module} />
      <div className="gw-md-grid" ref={containerRef}>
        {/* Keyed on the mode, so switching between an embed and a container
            is the one editor giving way to the other rather than a cut. */}
        <div className="gw-md-tools gw-md-mode" key={mode}>
          {/* Embeds only: a components-v2 message cannot carry `content`
             (discord.py sends both and Discord rejects the pair). Text above a
             container is a Text block placed before it. */}
          {mode === "container" ? (
            <ContainerCanvas
              blocks={blocks}
              explicitLayout={Boolean(value.v2_explicit_layout)}
              onChange={writeLayout}
              fallbackColor={value.v2_color || "none"}
              systemButtons={systemButtons}
            />
          ) : (
            <>
              {/* The message itself, edited where it is read. */}
              {/* Every embed on the one canvas, added from the end of the
                  message; the template bar works on the one you are in. */}
              <EmbedCanvas
                embeds={embeds}
                onEmbeds={(next) => writeEmbeds(next)}
                onActiveEmbed={setActiveEmbed}
                content={value.content || ""}
                onContent={hideContent ? undefined : (next) => onChange({ ...value, content: next })}
                hideContent={hideContent}
                variables={variables}
                buttons={
                  Array.isArray(value.components) && value.components.length
                    ? value.components
                    : previewButtons
                }
              />
              <FieldRow label="Buttons" description="Buttons and dropdowns under the message.">
                <LegacyButtonRowsEditor
                  components={Array.isArray(value.components) ? value.components : []}
                  onChange={(components) => onChange({ ...value, components })}
                />
              </FieldRow>
            </>
          )}
        </div>
        <div className="gw-md-preview">
          {/* Both kinds are edited on the message itself, on the left, so
              this column is what helps you write it. */}
          {variables.length ? (
            <VariableChips variables={variables} containerRef={containerRef} />
          ) : null}
          <TemplateBar
            mode={mode}
            embed={currentEmbed}
            container={{
              layout: blocks,
              color: value.v2_color || "none",
              content: value.content,
            }}
            onLoadEmbed={(embed) => writeEmbeds(embeds.map((item, index) => index === safeEmbedIndex ? embed : item))}
            onLoadContainer={(template) =>
              onChange({
                ...value,
                v2_layout: template.layout,
                v2_color: template.color || "none",
                v2_explicit_layout: true,
              })
            }
          />
          {/* Discord's JSON shape in both directions, shared with the Message
             Designer so a message is portable between editors. */}
          <DiscordJsonBox
            value={value}
            onApply={(next) => {
              // `render_mode` comes from the payload when present, so pasting a
              // container message switches this editor to container mode.
              onChange(applyMessageShape(value, next));
              setActiveEmbed(0);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Message editor bound to a Config dot-path: edits stage into the save prompt
 * like any other setting.
 */
export function ConfigMessageCard({
  path,
  title,
  hint,
  variables,
  defaults,
  hideContent = false,
  previewOverrides,
  module,
}: {
  path: string;
  title: string;
  hint: string;
  variables: string[];
  defaults: MessageObjectValue;
  hideContent?: boolean;
  previewOverrides?: Record<string, string>;
  /** The tab's module, which the variable list names its variables after. */
  module?: string;
}) {
  const { value, stage, config } = useManage();
  const current = value(path);
  const asDraft = (stored: unknown): MessageObjectValue =>
    stored && typeof stored === "object"
      ? (stored as MessageObjectValue)
      : typeof stored === "string" && stored.trim()
        ? { ...defaults, content: stored }
        : defaults;
  const draft = asDraft(current);
  /* What is saved, as the editor showed it when the tab opened. An edit back to
     it stages the saved value itself (no change), so undoing by hand clears the
     save prompt. */
  const saved = path
    .split(".")
    .reduce<any>((node, key) => (node == null ? undefined : node[key]), config);
  const previewButtons = path === "Giveaways.message"
    ? [
        {
          label: String(value("Giveaways.buttons.join_label") || "Enter"),
          emoji: String(value("Giveaways.buttons.join_emoji") || "") || undefined,
        },
        ...(value("Giveaways.buttons.participants_enabled")
          ? [{
              label: "0 entries",
              emoji: String(value("Giveaways.buttons.participants_emoji") || "") || undefined,
            }]
          : []),
      ]
    : undefined;
  useEffect(() => {
    setPreviewOverrides(previewOverrides || {});
    return () => setPreviewOverrides({});
  }, [previewOverrides]);

  return (
    <SettingsCard title={title} description={hint}>
      <MessageObjectEditor
        value={draft}
        onChange={(next) => stage(path, messagesEqual(next, asDraft(saved)) ? saved : next)}
        variables={variables}
        hideContent={hideContent}
        previewButtons={previewButtons}
        module={module}
      />
    </SettingsCard>
  );
}
