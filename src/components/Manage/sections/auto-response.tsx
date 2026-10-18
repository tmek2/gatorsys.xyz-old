"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PresenceList } from "@/components/motion";
import { IconChevronDown, IconMessageBolt, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import {
  ChannelPicker,
  ColorPicker,
  FieldRow,
  NumberField,
  RolePicker,
  SelectField,
  SettingsCard,
  TextField,
} from "../fields";
import { MessageObjectEditor } from "../config-message";
import { useManage } from "../manage-context";
import { ModuleGate } from "../module-gate";
import { SectionHeader } from "../section-header";
import type { AutoResponder, AutoResponderAction } from "../types";
import { EmptyState, SkeletonRows } from "../empty-state";

// {user} is the member a {user} trigger mentioned (the action target);
// {author} is whoever sent the message.
const RESPONSE_VARIABLES = [
  "{user.mention}",
  "{user.name}",
  "{author.mention}",
  "{author.name}",
  "{guild.name}",
  "{channel.mention}",
  "{timestamp}",
];

const ACTION_TYPES = [
  { value: "add_role", label: "Add role" },
  { value: "remove_role", label: "Remove role" },
  { value: "toggle_role", label: "Toggle role" },
  { value: "remove_all_roles", label: "Remove all roles" },
  { value: "create_role", label: "Create role & assign" },
  { value: "set_nickname", label: "Change nickname" },
  { value: "send_message", label: "Send message" },
  { value: "reply_message", label: "Reply to trigger" },
  { value: "dm_user", label: "DM the user" },
  { value: "wait", label: "Wait" },
  { value: "add_reaction", label: "Add reaction" },
  { value: "clear_reactions", label: "Clear reactions" },
  { value: "create_thread", label: "Start thread" },
  { value: "pin_message", label: "Pin trigger message" },
  { value: "unpin_message", label: "Unpin trigger message" },
  { value: "publish_message", label: "Publish announcement" },
  { value: "delete_message", label: "Delete trigger message" },
  { value: "timeout", label: "Timeout" },
  { value: "clear_timeout", label: "Clear timeout" },
  { value: "kick", label: "Kick" },
  { value: "ban", label: "Ban" },
];

const REQUIREMENT_TYPES = [
  { value: "has_role", label: "Has role" },
  { value: "missing_role", label: "Missing role" },
];

const ROLE_ACTIONS = new Set(["add_role", "remove_role", "toggle_role"]);
const MESSAGE_ACTIONS = new Set(["send_message", "reply_message", "dm_user"]);
const MODERATION_ACTIONS = new Set(["kick", "ban", "timeout"]);
const SIMPLE_ACTIONS = new Set([
  "delete_message",
  "remove_all_roles",
  "clear_reactions",
  "pin_message",
  "unpin_message",
  "publish_message",
  "clear_timeout",
]);

const ACTION_LABELS = new Map(ACTION_TYPES.map((action) => [action.value, action.label]));
const SIMILARITY_LEVELS = [1, 2, 3, 4, 5] as const;

function similarityLevel(value: number | null | undefined): number {
  return Math.min(5, Math.max(1, Math.round((value ?? 100) / 20)));
}

function actionSummary(step: AutoResponderAction): string {
  if (step.type === "wait") return `Wait ${step.seconds ?? 1}s`;
  if (step.type === "add_reaction" && step.emoji) return `React ${step.emoji}`;
  if (step.type === "create_thread" && step.thread_name) return `Thread: ${step.thread_name}`;
  return ACTION_LABELS.get(step.type) || step.type.replaceAll("_", " ");
}

function responderPreview(responder: AutoResponder): string {
  const richContent = String(responder.response_message?.content || "").trim();
  if (richContent) return richContent;
  if (responder.response?.trim()) return responder.response.trim();
  if (responder.response_message?.render_mode === "v2") return "Components message";
  if (responder.response_message?.embed) return "Embed response";
  return "Configured response";
}

/** True when a message object would actually send something. */
function messageHasContent(payload: Record<string, any> | undefined): boolean {
  if (!payload) return false;
  if (String(payload.content || "").trim()) return true;
  const embed = payload.embed || {};
  if (Object.values(embed).some((value) => value != null && value !== "" && !(Array.isArray(value) && !value.length))) return true;
  return payload.render_mode === "v2" && Array.isArray(payload.v2_layout) && payload.v2_layout.length > 0;
}

function ActionEditor({
  step,
  onChange,
  onRemove,
}: {
  step: AutoResponderAction;
  onChange: (next: AutoResponderAction) => void;
  onRemove: () => void;
}) {
  const { meta } = useManage();
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-48">
          <SelectField
            value={step.type}
            options={ACTION_TYPES}
            onChange={(next) => onChange({ type: next || "add_role" })}
          />
        </div>
        {ROLE_ACTIONS.has(step.type) ? (
          <div className="min-w-[200px] flex-1">
            <RolePicker
              roles={meta?.roles || []}
              value={step.role_id != null ? String(step.role_id) : null}
              onChange={(next) => onChange({ ...step, role_id: next as string | null })}
            />
          </div>
        ) : null}
        {step.type === "send_message" ? (
          <div className="min-w-[200px] flex-1">
            <ChannelPicker
              channels={meta?.channels || []}
              value={step.channel_id != null ? String(step.channel_id) : null}
              onChange={(next) => onChange({ ...step, channel_id: next as string | null })}
              placeholder="Same channel (default)"
            />
          </div>
        ) : null}
        {step.type === "create_role" ? (
          <>
            <div className="min-w-[160px] flex-1">
              <TextField
                value={step.role_name || ""}
                maxLength={100}
                placeholder="Role name to create & assign"
                onChange={(next) => onChange({ ...step, role_name: next })}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <ColorPicker
                value={`#${String((step as any).role_color || "99aab5").replace(/^#/, "")}`}
                label="Choose role color"
                onChange={(next) =>
                  onChange({ ...step, role_color: next.slice(1) } as AutoResponderAction)
                }
              />
            </div>
            <div className="w-52 shrink-0">
              <SelectField
                value={(step as any).role_position || "bottom"}
                options={[
                  { value: "top", label: "Top of their roles" },
                  { value: "bottom", label: "Bottom of the role list" },
                ]}
                onChange={(next) =>
                  onChange({ ...step, role_position: next || "bottom" } as AutoResponderAction)
                }
              />
            </div>
          </>
        ) : null}
        {step.type === "set_nickname" ? (
          <div className="min-w-[200px] flex-1">
            <TextField
              value={step.nickname || ""}
              maxLength={32}
              placeholder="New nickname (supports variables)"
              onChange={(next) => onChange({ ...step, nickname: next })}
            />
          </div>
        ) : null}
        {step.type === "timeout" ? (
          <div className="flex items-center gap-2">
            <NumberField
              value={step.minutes ?? 5}
              min={1}
              max={40320}
              onChange={(next) => onChange({ ...step, minutes: next === "" ? 5 : next })}
            />
            <span className="cool-text text-xs">minutes</span>
          </div>
        ) : null}
        {step.type === "wait" ? (
          <div className="flex items-center gap-2">
            <NumberField
              value={step.seconds ?? 1}
              min={1}
              max={300}
              onChange={(next) => onChange({ ...step, seconds: next === "" ? 1 : next })}
            />
            <span className="cool-text text-xs">seconds</span>
          </div>
        ) : null}
        {step.type === "add_reaction" ? (
          <div className="min-w-[180px] flex-1">
            <TextField
              value={step.emoji || ""}
              maxLength={100}
              placeholder="Emoji, e.g. ✅ or :wave:"
              onChange={(next) => onChange({ ...step, emoji: next })}
            />
          </div>
        ) : null}
        {step.type === "create_thread" ? (
          <>
            <div className="min-w-[220px] flex-1">
              <TextField
                value={step.thread_name || ""}
                maxLength={100}
                placeholder="Thread name (supports variables)"
                onChange={(next) => onChange({ ...step, thread_name: next })}
              />
            </div>
            <div className="w-48 shrink-0">
              <SelectField
                value={String(step.auto_archive_duration ?? 1440)}
                options={[
                  { value: "60", label: "Close after 1 hour" },
                  { value: "1440", label: "Close after 1 day" },
                  { value: "4320", label: "Close after 3 days" },
                  { value: "10080", label: "Close after 7 days" },
                ]}
                onChange={(next) =>
                  onChange({ ...step, auto_archive_duration: Number(next || 1440) })
                }
              />
            </div>
          </>
        ) : null}
        {MODERATION_ACTIONS.has(step.type) ? (
          <div className="min-w-[180px] flex-1">
            <TextField
              value={step.reason || ""}
              maxLength={400}
              placeholder="Reason (optional)"
              onChange={(next) => onChange({ ...step, reason: next })}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto shrink-0 text-white/35 hover:text-[var(--tone-bad)]"
          aria-label="Remove action"
        >
          <IconTrash size={14} />
        </button>
      </div>
      {MESSAGE_ACTIONS.has(step.type) ? (
        <div className="mt-3 border-t border-white/[0.08] pt-3">
          <MessageObjectEditor
            module="Auto Response"
            value={step.message || {}}
            onChange={(next) => onChange({ ...step, message: next })}
            variables={RESPONSE_VARIABLES}
          />
        </div>
      ) : null}
    </div>
  );
}

function ResponderEditor({
  editing,
  setEditing,
  isNew,
  busy,
  onCancel,
  onSave,
}: {
  editing: AutoResponder;
  setEditing: (next: AutoResponder) => void;
  isNew: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { meta } = useManage();
  const [responseOpen, setResponseOpen] = useState(true);

  return (
    <SettingsCard
      title={isNew ? "New auto response" : `Edit “${editing.trigger}”`}
      actions={
        <button
          type="button"
          onClick={onCancel}
          className="text-white/40 hover:text-white"
          aria-label="Close editor"
        >
          <IconX size={16} />
        </button>
      }
    >
      <FieldRow
        label="Trigger"
        description="The phrase to match. {user} targets a mentioned member instead of the sender."
      >
        <TextField
          value={editing.trigger}
          placeholder="e.g. warn {user}"
          onChange={(next) => setEditing({ ...editing, trigger: next })}
        />
      </FieldRow>
      <FieldRow
        label="Requirements"
        description="Only run this response when the target member meets every requirement."
      >
        <div className="space-y-2">
          {(editing.requirements || []).map((req, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <SelectField
                  value={req.type}
                  options={REQUIREMENT_TYPES}
                  onChange={(next) => {
                    const requirements = [...(editing.requirements || [])];
                    requirements[index] = { ...req, type: next || "has_role" };
                    setEditing({ ...editing, requirements });
                  }}
                />
              </div>
              <div className="min-w-[200px] flex-1">
                <RolePicker
                  roles={meta?.roles || []}
                  value={req.role_id != null ? String(req.role_id) : null}
                  onChange={(next) => {
                    const requirements = [...(editing.requirements || [])];
                    requirements[index] = { ...req, role_id: next as string | null };
                    setEditing({ ...editing, requirements });
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    requirements: (editing.requirements || []).filter((_, i) => i !== index),
                  })
                }
                className="text-white/35 hover:text-[var(--tone-bad)]"
                aria-label="Remove requirement"
              >
                <IconTrash size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={(editing.requirements || []).length >= 10}
            onClick={() =>
              setEditing({
                ...editing,
                requirements: [...(editing.requirements || []), { type: "has_role", role_id: null }],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-peach)] hover:opacity-80 disabled:opacity-40"
          >
            <IconPlus size={12} />
            Add requirement
          </button>
        </div>
      </FieldRow>
      {/* Collapsible so a long message editor is easy to get past. */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setResponseOpen(!responseOpen)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[#f5f2f2]">Response</span>
            <span className="cool-text text-[13px]">
              The reply the bot sends: plain text, an embed, or a container.
            </span>
          </span>
          <IconChevronDown
            size={15}
            className={`shrink-0 text-white/35 transition-transform ${responseOpen ? "rotate-180" : ""}`}
          />
        </button>
        {responseOpen ? (
          <div className="border-t border-white/[0.08] p-3">
            <MessageObjectEditor
              module="Auto Response"
              value={
                editing.response_message && Object.keys(editing.response_message).length
                  ? editing.response_message
                  : { content: editing.response || "" }
              }
              onChange={(next) => setEditing({ ...editing, response_message: next })}
              variables={RESPONSE_VARIABLES}
            />
          </div>
        ) : null}
      </div>
      <FieldRow
        label="Actions"
        description="What runs when the trigger matches."
      >
        <div className="space-y-2">
          {(editing.actions || []).map((step, index) => (
            <ActionEditor
              key={index}
              step={step}
              onChange={(next) => {
                const actions = [...(editing.actions || [])];
                actions[index] = next;
                setEditing({ ...editing, actions });
              }}
              onRemove={() =>
                setEditing({
                  ...editing,
                  actions: (editing.actions || []).filter((_, i) => i !== index),
                })
              }
            />
          ))}
          <button
            type="button"
            disabled={(editing.actions || []).length >= 10}
            onClick={() =>
              setEditing({
                ...editing,
                actions: [...(editing.actions || []), { type: "add_role", role_id: null }],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-peach)] hover:opacity-80 disabled:opacity-40"
          >
            <IconPlus size={12} />
            Add action
          </button>
        </div>
      </FieldRow>
      <FieldRow
        label="Similarity"
        description="1 is broad, 5 is exact. {user} triggers are always exact."
      >
        <div className="max-w-md">
          <div
            className="grid grid-cols-5 gap-2"
            role="group"
            aria-label="Similarity from 1 broad to 5 exact"
          >
            {SIMILARITY_LEVELS.map((level) => {
              const selected = similarityLevel(editing.similarity) === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setEditing({ ...editing, similarity: level * 20 })}
                  className={`min-h-11 rounded-xl border text-sm font-black transition-[background-color,border-color,color,transform] active:scale-[0.97] ${
                    selected
                      ? "border-[var(--accent-peach)] bg-[var(--accent-peach)] text-[#1c0f14]"
                      : "border-white/12 bg-white/[0.04] text-white/65 hover:border-[var(--accent-peach)]/45 hover:text-white"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-semibold text-white/45">
            <span>1 · Broad</span>
            <span>5 · Exact</span>
          </div>
        </div>
      </FieldRow>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-white/50 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={
            busy ||
            !editing.trigger.trim() ||
            !(
              messageHasContent(editing.response_message) ||
              Boolean(editing.response?.trim())
            )
          }
          onClick={onSave}
          className="btn-pop btn-peach h-9 px-4 text-sm disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save response"}
        </button>
      </div>
    </SettingsCard>
  );
}

/* "Go back" goes to the module list, not `history.back()` (which could return
   to this same gate). */
export function AutoResponseSection({ onNavigate }: { onNavigate?: (next: string) => void } = {}) {
  const { guildId, setNotice } = useManage();
  const [responders, setResponders] = useState<AutoResponder[] | null>(null);
  const [editing, setEditing] = useState<AutoResponder | null>(null);
  // The trigger the open editor started from (null while creating), so
  // renaming a trigger updates the saved responder instead of cloning it.
  const [originalTrigger, setOriginalTrigger] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isNew = editing !== null && originalTrigger === null;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/manage/${guildId}/autoresponders`);
      if (res.ok) {
        const json = await res.json();
        setResponders(json.responders || []);
      } else {
        setResponders([]);
      }
    } catch {
      setResponders([]);
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/autoresponders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setResponders(json.responders || []);
      setNotice({ kind: "saved", text: "Auto responses updated" });
      setEditing(null);
      setOriginalTrigger(null);
    } catch {
      setNotice({ kind: "error", text: "Could not update auto responses" });
    } finally {
      setBusy(false);
    }
  }

  function saveEditing() {
    if (!editing) return;
    const payload = editing.response_message;
    mutate({
      action: "upsert",
      trigger: editing.trigger.trim(),
      original_trigger: originalTrigger || undefined,
      response: (payload?.content || editing.response || "").trim(),
      response_message: messageHasContent(payload) ? payload : undefined,
      similarity: editing.similarity ?? 100,
      actions: (editing.actions || []).filter(
        (step) =>
          (ROLE_ACTIONS.has(step.type) && step.role_id) ||
          (MESSAGE_ACTIONS.has(step.type) && messageHasContent(step.message)) ||
          MODERATION_ACTIONS.has(step.type) ||
          SIMPLE_ACTIONS.has(step.type) ||
          step.type === "wait" ||
          (step.type === "add_reaction" && step.emoji?.trim()) ||
          (step.type === "create_thread" && step.thread_name?.trim()) ||
          (step.type === "create_role" && step.role_name?.trim()) ||
          step.type === "set_nickname"
      ),
      requirements: (editing.requirements || []).filter((req) => req.role_id),
    });
  }

  function closeEditor() {
    setEditing(null);
    setOriginalTrigger(null);
  }

  return (
    <ModuleGate moduleKey="Auto Responder" moduleLabel="Auto Response" onGoBack={() => onNavigate?.("modules")}>
    <div className="space-y-5">
      <SectionHeader
        title="Auto Response"
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing({ trigger: "", response: "", similarity: 100, actions: [] });
              setOriginalTrigger(null);
            }}
            className="btn-pop btn-peach inline-flex h-9 items-center gap-2 px-4 text-sm"
          >
            <IconPlus size={15} />
            New response
          </button>
        }
      />

      {isNew && editing ? (
        <ResponderEditor
          editing={editing}
          setEditing={setEditing}
          isNew
          busy={busy}
          onCancel={closeEditor}
          onSave={saveEditing}
        />
      ) : null}

      {responders === null ? (
        <SkeletonRows rows={3} label="Loading responses…" />
      ) : responders.length === 0 && !editing ? (
        <EmptyState
          title="No auto responses yet"
          hint="Add a trigger to reply automatically when a message matches it."
        />
      ) : (
        <PresenceList
          items={responders}
          keys={responders.map((responder) => responder.trigger)}
          className="space-y-3"
          render={(responder) =>
            // Editing expands the responder in place, pushing the rest down.
            editing && originalTrigger === responder.trigger ? (
              <ResponderEditor
                key={responder.trigger}
                editing={editing}
                setEditing={setEditing}
                isNew={false}
                busy={busy}
                onCancel={closeEditor}
                onSave={saveEditing}
              />
            ) : (
            <div
              key={responder.trigger}
              className="glass-panel group flex items-stretch overflow-hidden rounded-2xl"
            >
              <button
                type="button"
                onClick={() => {
                  setEditing({ ...responder, actions: [...(responder.actions || [])] });
                  setOriginalTrigger(responder.trigger);
                }}
                className="min-w-0 flex-1 p-4 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-peach)]"
                aria-label={`Edit ${responder.trigger}`}
              >
                <p className="flex items-center gap-2 text-sm font-bold text-[#f5f2f2]">
                  <IconMessageBolt size={15} className="shrink-0 text-[var(--accent-peach)]" />
                  <span className="truncate">{responder.trigger}</span>
                  {responder.similarity != null && responder.similarity < 100 ? (
                    <span className="cool-text shrink-0 text-xs font-normal">
                      · level {similarityLevel(responder.similarity)}/5
                    </span>
                  ) : null}
                </p>
                <p className="cool-text mt-1 line-clamp-2 text-[13px] leading-relaxed">
                  {responderPreview(responder)}
                </p>
                <span className="mt-3 flex flex-wrap items-center gap-2">
                  {(responder.actions || []).slice(0, 4).map((step, index) => (
                    <span
                      key={`${step.type}-${index}`}
                      className="rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white/65"
                    >
                      {actionSummary(step)}
                    </span>
                  ))}
                  {(responder.actions || []).length > 4 ? (
                    <span className="cool-text text-[11px] font-semibold">
                      +{(responder.actions || []).length - 4} more
                    </span>
                  ) : null}
                  <span className="ml-auto text-[11px] font-semibold text-[var(--accent-peach)] opacity-70 transition-opacity group-hover:opacity-100">
                    Click anywhere to edit
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 items-start p-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    mutate({ action: "delete", trigger: responder.trigger })
                  }
                  className="rounded-xl p-3 text-white/40 transition-colors hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tone-bad)]"
                  aria-label={`Delete ${responder.trigger}`}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
            )
          }
        />
      )}
    </div>
    </ModuleGate>
  );
}
