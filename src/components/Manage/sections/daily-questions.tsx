"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IconRotate } from "@tabler/icons-react";
import { ChannelPicker, FieldRow, RolePicker, SettingsCard, Toggle } from "../fields";
import { configValuesEqual, useManage } from "../manage-context";
import { SchemaSection } from "../schema-section";
import { ModuleGate } from "../module-gate";
import { findSection } from "../schema";
import { SectionHeader } from "../section-header";
import { SaveCloudIcon } from "@/components/Manage/save-cloud-icon";

interface QotdDoc {
  channel_id?: string | null;
  pingrole?: string | null;
  qotdthread?: boolean;
  nextdate?: string | null;
}

/**
 * Daily Questions lives in its own `qotd` collection on the bot, so this
 * section saves through the qotd endpoint (webhook settings stay in the main
 * config and use the schema renderer below).
 */
/* "Go back" goes to the module list, not `history.back()` (which could return
   to this same gate). */
export function DailyQuestionsSection({ onNavigate }: { onNavigate?: (next: string) => void } = {}) {
  const { guildId, meta, setNotice, registerExternalDraft, setExternalDraftDirty } = useManage();
  const [saved, setSaved] = useState<QotdDoc | null>(null);
  const [draft, setDraft] = useState<QotdDoc>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/manage/${guildId}/qotd`);
      if (!res.ok) throw new Error("Could not load Daily Questions.");
      const json = await res.json();
      if (!json || !Object.prototype.hasOwnProperty.call(json, "qotd"))
        throw new Error("The Daily Questions response was incomplete.");
      const doc: QotdDoc = {
        channel_id: json.qotd?.channel_id != null ? String(json.qotd.channel_id) : null,
        pingrole: json.qotd?.pingrole != null ? String(json.qotd.pingrole) : null,
        qotdthread: json.qotd?.qotdthread ?? true,
        nextdate: json.qotd?.nextdate ?? null,
      };
      setSaved(doc);
      setDraft(doc);
    } catch {
      setLoadError("Could not load the saved settings. Retry before editing or saving.");
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () =>
      !loading && saved !== null && !configValuesEqual(
        { ...draft, nextdate: null },
        { ...(saved || {}), nextdate: null },
      ),
    [draft, saved, loading]
  );

  async function persist(): Promise<boolean> {
    if (loading || loadError || saved === null || saving) return false;
    setSaving(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/qotd`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          set: {
            channel_id: draft.channel_id || null,
            pingrole: draft.pingrole || null,
            qotdthread: draft.qotdthread ?? true,
          },
        }),
      });
      if (!res.ok) throw new Error();
      setNotice({ kind: "saved", text: "Daily Questions saved" });
      await load();
      return true;
    } catch {
      setNotice({ kind: "error", text: "Could not save Daily Questions" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  const persistRef = React.useRef(persist);
  persistRef.current = persist;
  const discardRef = React.useRef(() => setDraft(saved || {}));
  discardRef.current = () => setDraft(saved || {});

  useEffect(
    () => registerExternalDraft("daily-questions", {
      save: () => persistRef.current(),
      discard: () => discardRef.current(),
      label: "Daily Questions",
    }),
    [registerExternalDraft],
  );
  useEffect(() => {
    setExternalDraftDirty("daily-questions", dirty);
  }, [dirty, setExternalDraftDirty]);

  const webhookSection = findSection("daily-questions");

  return (
    <ModuleGate moduleKey="QOTD" moduleLabel="Daily Questions" onGoBack={() => onNavigate?.("modules")}>
    <div className="space-y-5" inert={saving}>
      <SectionHeader
        title="Daily Questions"
      />


      {loading ? (
        <div className="glass-panel rounded-2xl py-12 text-center">
          <p className="cool-text text-sm">Loading…</p>
        </div>
      ) : loadError ? (
        <SettingsCard title="Posting">
          <p role="alert" className="cool-text text-sm">{loadError}</p>
          <button type="button" className="gw-btn mt-3" onClick={() => void load()}>
            Retry loading settings
          </button>
        </SettingsCard>
      ) : (
        <SettingsCard
          title="Posting"
          description={
            saved?.nextdate
              ? `Next question is scheduled and currently running.`
              : "Daily questions are currently stopped. Start them from Discord when you're ready."
          }
          actions={
            <div className="flex items-center gap-2">
              {dirty ? (
                <button
                  type="button"
                  onClick={() => setDraft(saved || {})}
                  className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-white/50 hover:text-white"
                >
                  <IconRotate size={13} />
                  Discard
                </button>
              ) : null}
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => void persist()}
                className="btn-pop btn-peach inline-flex h-8 items-center gap-2 px-3 text-xs disabled:opacity-50"
              >
                <SaveCloudIcon size={14} state={saving ? "saving" : "idle"} />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          }
        >
          <FieldRow label="Question channel">
            <ChannelPicker
              channels={meta?.channels || []}
              value={draft.channel_id || null}
              onChange={(next) =>
                setDraft({ ...draft, channel_id: (next as string | null) || null })
              }
            />
          </FieldRow>
          <FieldRow label="Ping role" description="Pinged with each daily question.">
            <RolePicker
              roles={meta?.roles || []}
              value={draft.pingrole || null}
              onChange={(next) =>
                setDraft({ ...draft, pingrole: (next as string | null) || null })
              }
            />
          </FieldRow>
          <FieldRow
            label="Create threads"
            description="Open a discussion thread under each question."
            inline
          >
            <Toggle
              checked={draft.qotdthread ?? true}
              onChange={(next) => setDraft({ ...draft, qotdthread: next })}
            />
          </FieldRow>
        </SettingsCard>
      )}

      {webhookSection ? (
        <div className="[&>div>*:first-child]:hidden">
          <SchemaSection section={{ ...webhookSection, moduleKey: undefined }} />
        </div>
      ) : null}
    </div>
    </ModuleGate>
  );
}
