"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IconRestore } from "@tabler/icons-react";
import { cleanEmbed, setPreviewOverrides, trackFocus, VariableChips } from "./embed-editor";
import { FieldRow, SettingsCard } from "./fields";
import { DiscordJsonBox } from "./discord-json-box";
import { applyMessageShape } from "./discord-json";
import { useManage } from "./manage-context";
import type { CustomMessage, MessageEmbed } from "./types";
import { SaveCloudIcon } from "@/components/Manage/save-cloud-icon";
import { EmbedCanvas } from "./embed-canvas";
import { ContainerCanvas } from "./container-canvas";
import { VariableAutocomplete } from "./variable-autocomplete";
import { SkeletonRows, SkeletonBlock } from "./empty-state";
import { MessageEditorBar } from "./message-chrome";
import { LegacyButtonRowsEditor } from "./message-design/button-editor";
import { containerValidationError, sameMessage } from "./message-design/model";
import { TemplateBar } from "./message-design/template-bar";

/* The parts' public names, so importers keep using this path. */
export {
  CONTAINER_LIMITS,
  containerCharacterCount,
  containerValidationError,
  countContainerComponents,
  duplicateBlock,
  ensureBlockIds,
  injectLegacyModuleButton,
  layoutHasSystemButton,
  toEditorLayout,
} from "./message-design/model";
export type {
  ContainerBlock,
  ContainerRowButton,
  SystemComponentPreview,
} from "./message-design/model";
export { AccentSwatches, accentHex } from "./message-design/accent";
export { ContainerPreview, DcBlockView, PreviewButton } from "./message-design/preview";
export { useButtonTargets } from "./message-design/button-controls";
export { LegacyButtonRowsEditor, RowButtonEditor } from "./message-design/button-editor";
export {
  ButtonRowBody,
  MediaGalleryBody,
  MessageDropdownBody,
  SeparatorBody,
  SystemButtonBody,
} from "./message-design/block-bodies";

export {
  AddBlockMenu,
  CONTAINER_ADDERS,
  CONTAINER_ADDER_LABELS,
  ContainerBlocksEditor,
} from "./message-design/container-editor";
export { TemplateBar } from "./message-design/template-bar";

/* ── Per-module message designer ───────────────────────────────────────── */

export function MessageDesignCard({
  type,
  title,
  hint,
  variables,
  defaults,
  previewOverrides,
  module,
}: {
  type: string;
  title: string;
  hint: string;
  variables: string[];
  defaults: CustomMessage;
  previewOverrides?: Record<string, string>;
  /** The tab's module, which the variable list names its variables after. */
  module?: string;
}) {
  const {
    guildId,
    setNotice,
    registerExternalDraft,
    setExternalDraftDirty,
  } = useManage();
  const cardRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    trackFocus(cardRef.current);
  });
  useEffect(() => {
    setPreviewOverrides(previewOverrides || {});
    return () => setPreviewOverrides({});
  }, [previewOverrides]);
  const [mode, setMode] = useState<"embed" | "container">("embed");
  const [saved, setSaved] = useState<any>(undefined);
  const [draft, setDraft] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** The embed the template bar saves from and loads into: the one last
      opened on the canvas. */
  const [activeEmbed, setActiveEmbed] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/messages?type=${encodeURIComponent(type)}`);
      const json = res.ok ? await res.json() : { message: null };
      const doc = json.message;
      const base = doc
        ? {
            content: doc.content || "",
            embed: doc.embed || {},
            // More than one embed is kept as `embeds`, the first also as
            // `embed`; one is `embed` alone. The same shape the bot stores.
            embeds: Array.isArray(doc.embeds) && doc.embeds.length > 1 ? doc.embeds : undefined,
            components: Array.isArray(doc.components) ? doc.components : [],
            v2_layout: doc.v2_layout || [],
            v2_color: doc.v2_color || "none",
            // Included in the baseline, or the saved copy could never match a
            // draft that has it and the editor would stay dirty.
            v2_explicit_layout: Boolean(doc.v2_explicit_layout),
            render_mode: doc.render_mode || "legacy",
          }
        : defaultBaseline();
      setSaved(doc ? base : null);
      setDraft(JSON.parse(JSON.stringify(base)));
      setMode(base.render_mode === "v2" ? "container" : "embed");
    } catch {
      setSaved(null);
      // The same baseline the dirty check uses, so a failed read does not leave
      // the editor dirty.
      setDraft(defaultBaseline());
      setMode("embed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, type]);

  useEffect(() => {
    load();
  }, [load]);

  /* What an unsaved message looks like. Used both to seed the draft and as the
     dirty check's baseline, so the two cannot differ (a mismatch left the
     editor dirty on servers that had never customised the message). */
  function defaultBaseline() {
    return JSON.parse(
      JSON.stringify({
        ...defaults,
        components: defaults.components || [],
        v2_layout: [],
        v2_color: "none",
        v2_explicit_layout: false,
        render_mode: "legacy",
      }),
    );
  }

  const dirty = useMemo(() => {
    // Not dirty while loading (the draft is `{}` until the read returns).
    if (loading) return false;
    const baseline = saved ?? defaultBaseline();
    // Compared by value with `sameMessage`, not by JSON text.
    return !sameMessage(
      { ...draft, render_mode: mode === "container" ? "v2" : "legacy" },
      baseline,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saved, defaults, mode, loading]);

  const editorKey = `message-design:${type}`;

  /* Every embed in the draft: `embeds` when there is more than one, `embed`
     alone otherwise. */
  const draftEmbeds: MessageEmbed[] =
    Array.isArray(draft.embeds) && draft.embeds.length > 1 ? draft.embeds : [draft.embed || {}];
  const shownEmbed = Math.min(activeEmbed, draftEmbeds.length - 1);
  const writeDraftEmbeds = (next: MessageEmbed[]) =>
    setDraft({ ...draft, embed: next[0] || {}, embeds: next.length > 1 ? next : undefined });

  async function persist(): Promise<boolean> {
    if (mode === "container") {
      const validationError = containerValidationError(draft.v2_layout || []);
      if (validationError) {
        setNotice({ kind: "error", text: validationError });
        return false;
      }
    }
    setSaving(true);
    try {
      const data = mode === "container"
          ? {
              content: draft.content?.trim() || undefined,
              render_mode: "v2",
              v2_layout: draft.v2_layout || [],
              v2_color: draft.v2_color || "none",
              // Saved with the layout. Without it the bot and the preview read
              // the layout as the legacy "one box around everything", and an
              // unwrapped container would come back wrapped.
              v2_explicit_layout: true,
            }
          : {
              content: draft.content?.trim() || undefined,
              embed: cleanEmbed(draftEmbeds[0] || {}),
              embeds: draftEmbeds.length > 1 ? draftEmbeds.map((embed) => cleanEmbed(embed)) : undefined,
              components: draft.components || [],
              render_mode: "legacy",
            };
      const res = await fetch(`/api/manage/${guildId}/messages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      if (!res.ok) throw new Error();
      await load();
      return true;
    } catch {
      setNotice({ kind: "error", text: `Could not save ${title.toLowerCase()}` });
      return false;
    } finally {
      setSaving(false);
    }
  }

  const persistRef = React.useRef(persist);
  persistRef.current = persist;
  const discardRef = React.useRef<() => void>(() => undefined);
  discardRef.current = () => {
    const baseline = saved ?? defaultBaseline();
    setDraft(JSON.parse(JSON.stringify(baseline)));
    setMode(baseline.render_mode === "v2" ? "container" : "embed");
  };

  useEffect(
    () =>
      registerExternalDraft(editorKey, {
        save: () => persistRef.current(),
        discard: () => discardRef.current(),
      }),
    [editorKey, registerExternalDraft],
  );

  useEffect(() => {
    setExternalDraftDirty(editorKey, dirty);
  }, [dirty, editorKey, setExternalDraftDirty]);

  if (loading) {
    return (
      <SettingsCard title={title} description={hint}>
        <div className="grid min-h-[320px] grid-cols-1 gap-5 xl:grid-cols-2">
          <SkeletonRows rows={3} lead={false} label="Loading message…" />
          <SkeletonBlock height="13rem" label="Loading preview…" />
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title={title} description={hint}>
      <div className="gw-md">
      <MessageEditorBar containerRef={cardRef} mode={mode} onMode={setMode} />
      <VariableAutocomplete containerRef={cardRef} variables={variables} module={module} />
      <div className="designer-shell gw-md-grid" ref={cardRef}>
        {/* Keyed on the mode: switching kinds is one editor giving way to
            the other, not a cut. */}
        <div className="designer-tools gw-md-tools gw-md-mode" key={mode}>
          {mode === "embed" ? (
            <>
              {/* The message itself, edited where it is read. */}
              <EmbedCanvas
                embeds={draftEmbeds}
                onEmbeds={writeDraftEmbeds}
                onActiveEmbed={setActiveEmbed}
                content={draft.content || ""}
                onContent={(next) => setDraft({ ...draft, content: next })}
                variables={variables}
                buttons={draft.components || []}
              />
              <FieldRow
                label="Button rows"
                description="Buttons and dropdowns under the message."
              >
                <LegacyButtonRowsEditor
                  components={draft.components || []}
                  onChange={(components) => setDraft({ ...draft, components })}
                />
              </FieldRow>
            </>
          ) : (
            <ContainerCanvas
              blocks={draft.v2_layout || []}
              explicitLayout={Boolean(draft.v2_explicit_layout)}
              fallbackColor={draft.v2_color || "none"}
              content={draft.content || ""}
              onContent={(next) => setDraft({ ...draft, content: next })}
              // Written on every edit, so a layout saved from here says whether
              // its containers are its own.
              onChange={(next) =>
                setDraft({ ...draft, v2_layout: next, v2_explicit_layout: true })
              }
            />
          )}
        </div>
        <div className="designer-preview gw-md-preview">
          <VariableChips variables={variables} containerRef={cardRef} />
          <TemplateBar
            mode={mode}
            embed={draftEmbeds[shownEmbed] || {}}
            container={{
              layout: draft.v2_layout || [],
              color: draft.v2_color || "none",
              content: draft.content,
            }}
            onLoadEmbed={(embed) =>
              writeDraftEmbeds(draftEmbeds.map((item, index) => (index === shownEmbed ? embed : item)))
            }
            onLoadContainer={(template) =>
              // Explicit, like every other layout this editor writes: a
              // template's blocks are where its author put them.
              setDraft({
                ...draft,
                v2_layout: template.layout,
                v2_color: template.color || "none",
                v2_explicit_layout: true,
              })
            }
          />
          <DiscordJsonBox
            value={draft}
            // Replaced, not merged: pasting an embed over a container must drop
            // the container's blocks.
            onApply={(next) => setDraft(applyMessageShape(draft, next))}
          />
          <div className="flex items-center justify-end gap-2">
            {saved ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  // The third copy of the default, and it disagreed with both
                  // of the others. Same function as the dirty check now.
                  setDraft(defaultBaseline());
                  setMode("embed");
                }}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-white/50 hover:text-white disabled:opacity-40"
              >
                <IconRestore size={13} />
                Reset to default
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => persist()}
              className="hidden"
            >
              <SaveCloudIcon size={14} state={saving ? "saving" : "idle"} />
              {saving ? "Saving…" : "Save design"}
            </button>
          </div>
        </div>
      </div>
      </div>
    </SettingsCard>
  );
}
