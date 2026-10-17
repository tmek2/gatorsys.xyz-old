"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconClock,
  IconCopy,
  IconGripVertical,
  IconMessage,
  IconPlus,
  IconSlash,
  IconSparkles,
  IconTemplate,
  IconTrash,
  IconUserMinus,
  IconUserPlus,
  IconUserQuestion,
} from "@tabler/icons-react";
import {
  ChannelPicker,
  FieldRow,
  NumberField,
  RolePicker,
  SelectField,
  SectionLabel,
  SettingsCard,
  TextAreaField,
  TextField,
  Toggle,
} from "../fields";
import { cleanEmbed, DiscordPreview, EmbedForm, trackFocus, VariableChips } from "../embed-editor";
import { variablesForGroups } from "@/config/variable-registry";
import { InsertMenu } from "../insert-menu";
import { EmojiPickerButton } from "../emoji-picker";
import {
  AccentSwatches,
  ContainerBlocksEditor,
  ContainerPreview,
  LegacyButtonRowsEditor,
  TemplateBar,
  containerValidationError,
} from "../message-design";
import { configValuesEqual, useManage } from "../manage-context";
import { ModuleDisabledBanner } from "../schema-section";
import { SectionHeader } from "../section-header";
import {
  NewResourceMenu,
  type NewResourceOption,
} from "../new-resource-menu";
import { ConfirmModal, type ConfirmState } from "@/components/confirm-modal";
import { EmptyState, SkeletonRows } from "../empty-state";
import { DiscordJsonBox } from "../discord-json-box";
import { applyMessageShape } from "../discord-json";
import type {
  CustomCommandDoc,
  CustomCommandFlowStep,
  CustomCommandOption,
  CustomMessage,
  MessageEmbed,
} from "../types";

/**
 * Custom Commands builder: the message editor, drag-and-drop slash options and
 * per-choice workflow steps. Saves go through the bot, which normalises with
 * the same code as /config and re-syncs the slash command immediately.
 */

const OPTION_TYPES = [
  { value: "text", label: "Text" },
  { value: "choice", label: "Choice" },
  { value: "integer", label: "Integer" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "user", label: "User search" },
  { value: "member", label: "Member" },
  { value: "role", label: "Role" },
  { value: "channel", label: "Channel" },
  { value: "attachment", label: "Attachment" },
];

const FLOW_TARGETS = [
  { value: "command_channel", label: "Command send channel" },
  { value: "invoker_dm", label: "Invoker DMs" },
  { value: "invoker_ephemeral", label: "Ephemeral reply" },
];

const FLOW_STEP_TYPES = [
  { value: "wait", label: "Wait", icon: <IconClock size={14} /> },
  { value: "send_message", label: "Send message", icon: <IconMessage size={14} /> },
  { value: "send_embed_template", label: "Send embed template", icon: <IconTemplate size={14} /> },
  { value: "add_role", label: "Add role", icon: <IconUserPlus size={14} /> },
  { value: "remove_role", label: "Remove role", icon: <IconUserMinus size={14} /> },
  { value: "toggle_role", label: "Toggle role", icon: <IconUserQuestion size={14} /> },
];

const CHANNEL_TYPE_OPTIONS = ["text", "voice", "category", "forum", "announcement", "stage"];

function sanitizeCommandName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

/** Reusable HTML5 drag-and-drop ordering for a list. */
function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return {
    overIndex,
    dragProps: (index: number) => ({
      draggable: true,
      onDragStart: (event: React.DragEvent) => {
        setDragIndex(index);
        event.dataTransfer.effectAllowed = "move";
      },
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        if (index !== overIndex) setOverIndex(index);
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        if (dragIndex === null || dragIndex === index) {
          setDragIndex(null);
          setOverIndex(null);
          return;
        }
        const next = [...items];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(index, 0, moved);
        onReorder(next);
        setDragIndex(null);
        setOverIndex(null);
      },
      onDragEnd: () => {
        setDragIndex(null);
        setOverIndex(null);
      },
    }),
  };
}

function FlowStepEditor({
  step,
  onChange,
  onRemove,
  roles,
  embedTemplates,
}: {
  step: CustomCommandFlowStep;
  onChange: (next: CustomCommandFlowStep) => void;
  onRemove: () => void;
  roles: { id: string; name: string; color: string | null; position: number; managed: boolean }[];
  embedTemplates: string[];
}) {
  const definition = FLOW_STEP_TYPES.find((item) => item.value === step.type);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
      <span className="cursor-grab text-white/25">
        <IconGripVertical size={14} />
      </span>
      <span className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-peach)]">
        {definition?.icon}
        {definition?.label || step.type}
      </span>
      {step.type === "wait" ? (
        <span className="flex items-center gap-2 text-xs text-white/60">
          <NumberField
            value={step.seconds ?? 0}
            min={0}
            max={300}
            onChange={(next) =>
              onChange({ ...step, seconds: next === "" ? 0 : next })
            }
          />
          seconds (max 300)
        </span>
      ) : null}
      {step.type === "send_message" ? (
        <>
          <div className="min-w-[180px]">
            <SelectField
              value={step.target || "command_channel"}
              options={FLOW_TARGETS}
              onChange={(next) =>
                onChange({ ...step, target: next || "command_channel" })
              }
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <TextField
              value={step.content || ""}
              maxLength={1000}
              placeholder="Message content"
              onChange={(next) => onChange({ ...step, content: next })}
            />
          </div>
        </>
      ) : null}
      {step.type === "send_embed_template" ? (
        <>
          <div className="min-w-[180px]">
            <SelectField
              value={step.target || "command_channel"}
              options={FLOW_TARGETS}
              onChange={(next) =>
                onChange({ ...step, target: next || "command_channel" })
              }
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <SelectField
              value={step.template_name || null}
              placeholder={embedTemplates.length ? "Choose an embed template" : "No embed templates saved"}
              options={embedTemplates.map((name) => ({ value: name, label: name }))}
              onChange={(next) => onChange({ ...step, template_name: next || "" })}
            />
          </div>
        </>
      ) : null}
      {["add_role", "remove_role", "toggle_role"].includes(step.type) ? (
        <div className="min-w-[220px] flex-1">
          <RolePicker
            roles={roles}
            value={step.role_id != null ? String(step.role_id) : null}
            onChange={(next) => onChange({ ...step, role_id: next as string | null })}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        className="ml-auto text-white/35 hover:text-[var(--tone-bad)]"
        aria-label="Remove step"
      >
        <IconTrash size={14} />
      </button>
    </div>
  );
}

function ChoiceFlowEditor({
  option,
  onChange,
  roles,
  embedTemplates,
}: {
  option: CustomCommandOption;
  onChange: (next: CustomCommandOption) => void;
  roles: { id: string; name: string; color: string | null; position: number; managed: boolean }[];
  embedTemplates: string[];
}) {
  const [activeChoice, setActiveChoice] = useState<string | null>(
    option.choices[0] || null
  );
  const flows = option.choice_flows || {};
  const conditions = option.choice_conditions || {};
  const steps: CustomCommandFlowStep[] =
    (activeChoice && flows[activeChoice]) || [];

  const { dragProps, overIndex } = useDragReorder(steps, (next) => {
    if (!activeChoice) return;
    onChange({
      ...option,
      choice_flows: { ...flows, [activeChoice]: next },
    });
  });

  if (option.choices.length === 0) {
    return (
      <p className="cool-text text-[13px]">
        Add choices above to attach workflows and conditions to them.
      </p>
    );
  }

  function setSteps(next: CustomCommandFlowStep[]) {
    if (!activeChoice) return;
    const nextFlows = { ...flows };
    if (next.length === 0) delete nextFlows[activeChoice];
    else nextFlows[activeChoice] = next;
    onChange({ ...option, choice_flows: nextFlows });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {option.choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => setActiveChoice(choice)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              activeChoice === choice
                ? "border-[rgb(var(--accent-rgb)/0.45)] bg-[rgb(var(--accent-rgb)/0.12)] text-[#f5f2f2]"
                : "border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/20"
            }`}
          >
            {choice}
            {(flows[choice] || []).length > 0 ? (
              <span className="cool-text"> · {(flows[choice] || []).length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {activeChoice ? (
        <>
          <FieldRow
            label={`Condition for “${activeChoice}”`}
            description="Only members with this role can pick this choice. Leave empty for everyone."
          >
            <RolePicker
              roles={roles}
              value={
                conditions[activeChoice]?.required_role_id != null
                  ? String(conditions[activeChoice].required_role_id)
                  : null
              }
              onChange={(next) => {
                const nextConditions = { ...conditions };
                if (next) {
                  nextConditions[activeChoice] = {
                    required_role_id: next as string,
                  };
                } else {
                  delete nextConditions[activeChoice];
                }
                onChange({ ...option, choice_conditions: nextConditions });
              }}
            />
          </FieldRow>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#f5f2f2]">
                Workflow for “{activeChoice}”
              </p>
              <div className="flex flex-wrap gap-2">
                {FLOW_STEP_TYPES.map((stepType) => (
                  <button
                    key={stepType.value}
                    type="button"
                    disabled={steps.length >= 25}
                    onClick={() =>
                      setSteps([
                        ...steps,
                        stepType.value === "wait"
                          ? { type: "wait", seconds: 5 }
                          : stepType.value === "send_message"
                            ? { type: "send_message", target: "command_channel", content: "" }
                            : stepType.value === "send_embed_template"
                              ? { type: "send_embed_template", target: "command_channel", template_name: "" }
                              : { type: stepType.value, role_id: null },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-white/70 transition-colors hover:border-[rgb(var(--accent-rgb)/0.35)] hover:text-white disabled:opacity-40"
                  >
                    <IconPlus size={11} />
                    {stepType.label}
                  </button>
                ))}
              </div>
            </div>
            {steps.length === 0 ? (
              <p className="cool-text text-[13px]">
                No steps yet. Add one above. Steps run top to bottom; drag to
                reorder.
              </p>
            ) : (
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    {...dragProps(index)}
                    className={overIndex === index ? "opacity-60" : ""}
                  >
                    <FlowStepEditor
                      step={step}
                      roles={roles}
                      embedTemplates={embedTemplates}
                      onChange={(next) => {
                        const nextSteps = [...steps];
                        nextSteps[index] = next;
                        setSteps(nextSteps);
                      }}
                      onRemove={() =>
                        setSteps(steps.filter((_, i) => i !== index))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function OptionEditor({
  option,
  onChange,
  onRemove,
  roles,
  dragHandleProps,
  embedTemplates,
}: {
  option: CustomCommandOption;
  onChange: (next: CustomCommandOption) => void;
  onRemove: () => void;
  roles: { id: string; name: string; color: string | null; position: number; managed: boolean }[];
  dragHandleProps: Record<string, unknown>;
  embedTemplates: string[];
}) {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
      {...dragHandleProps}
    >
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-2 cursor-grab text-white/25" title="Drag to reorder">
          <IconGripVertical size={15} />
        </span>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
          <TextField
            value={option.name}
            maxLength={32}
            placeholder="field name"
            onChange={(next) =>
              onChange({ ...option, name: sanitizeCommandName(next) })
            }
          />
          <SelectField
            value={option.type}
            options={OPTION_TYPES}
            onChange={(next) => onChange({ ...option, type: next || "text" })}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 text-white/35 hover:text-[var(--tone-bad)]"
          aria-label="Remove field"
        >
          <IconTrash size={15} />
        </button>
      </div>
      <div className="space-y-3 pl-7">
        <TextField
          value={option.description}
          maxLength={100}
          placeholder="Field description shown in Discord"
          onChange={(next) => onChange({ ...option, description: next })}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-xs text-white/60">
            <Toggle
              checked={option.required}
              onChange={(next) => onChange({ ...option, required: next })}
            />
            Required
          </label>
          {option.type === "channel" ? (
            <label className="flex items-center gap-2 text-xs text-white/60">
              <Toggle
                checked={option.use_for_send}
                onChange={(next) => onChange({ ...option, use_for_send: next })}
              />
              Use as send target
            </label>
          ) : null}
          {option.type === "user" ? (
            <div className="flex items-center gap-2 text-xs text-white/60">
              Search
              <div className="min-w-[160px]">
                <SelectField
                  value={option.user_source || "discord"}
                  options={[
                    { value: "discord", label: "Discord users" },
                    { value: "roblox", label: "Roblox users" },
                  ]}
                  onChange={(next) =>
                    onChange({ ...option, user_source: next || "discord" })
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
        {option.type === "channel" ? (
          <FieldRow
            label="Allowed channel types"
            description="Leave empty to allow any channel."
          >
            <div className="flex flex-wrap gap-2">
              {CHANNEL_TYPE_OPTIONS.map((channelType) => {
                const active = option.channel_types.includes(channelType);
                return (
                  <button
                    key={channelType}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...option,
                        channel_types: active
                          ? option.channel_types.filter((item) => item !== channelType)
                          : [...option.channel_types, channelType].slice(0, 6),
                      })
                    }
                    className={`rounded-xl border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      active
                        ? "border-[rgb(var(--accent-rgb)/0.45)] bg-[rgb(var(--accent-rgb)/0.12)] text-[#f5f2f2]"
                        : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/20"
                    }`}
                  >
                    {channelType}
                  </button>
                );
              })}
            </div>
          </FieldRow>
        ) : null}
        {option.type === "choice" ? (
          <>
            <FieldRow label="Choices" description="One per line, up to 25.">
              <TextAreaField
                rows={3}
                value={option.choices.join("\n")}
                placeholder={"Yes\nNo\nMaybe"}
                onChange={(next) =>
                  onChange({
                    ...option,
                    choices: next
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 25),
                  })
                }
              />
            </FieldRow>
            <ChoiceFlowEditor
              option={option}
              onChange={onChange}
              roles={roles}
              embedTemplates={embedTemplates}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function AiSuggestCard({
  command,
  onApply,
}: {
  command: CustomCommandDoc;
  onApply: (suggestion: {
    name?: string;
    description?: string;
    category?: string;
    content?: string;
    embed?: MessageEmbed;
    command_options?: CustomCommandOption[];
    components?: any[];
    render_mode?: string;
    v2_layout?: any[];
    /** Whether the layout places its own containers. See `toEditorLayout`. */
    v2_explicit_layout?: boolean;
    v2_color?: string;
    permissionroles?: string[];
    ping?: string | null;
    target_channel_id?: string | null;
  }) => void;
}) {
  const { guildId, setNotice } = useManage();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  async function suggest() {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/customcommandai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          command,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.detail || json.message || "AI suggestion failed");
      }
      if (json.suggestion) {
        onApply(json.suggestion);
        setNotice({
          kind: "saved",
          text: "AI draft applied across the command. Review it, then save.",
        });
      } else {
        throw new Error("The AI response did not include a draft");
      }
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "AI suggestion failed. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[rgb(var(--accent-rgb)/0.18)] bg-[rgb(var(--accent-rgb)/0.045)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <IconSparkles size={15} className="shrink-0 text-[var(--accent-peach)]" />
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">
          Build with AI
        </span>
        <span className="cool-text text-[11px]">
          message, fields, buttons, forms, and workflows
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              suggest();
            }
          }}
          placeholder="Describe the outcome; AI will draft the command, message, forms, buttons, and workflows…"
          className="gator-control min-w-[240px] flex-1 px-3 text-sm text-[#f5f2f2] placeholder:text-white/30"
        />
        <button
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={suggest}
          className="btn-pop btn-peach h-8 px-4 text-xs disabled:opacity-50"
        >
          {busy ? "Building…" : "Build draft"}
        </button>
      </div>
    </div>
  );
}

function emptyCommand(): CustomCommandDoc {
  return {
    name: "",
    description: "Custom server command",
    category: "Uncategorized",
    content: "",
    embed: {},
    command_options: [],
    permissionroles: [],
    ping: null,
    target_channel_id: null,
    disabled: false,
    render_mode: "legacy",
    v2_layout: [],
    v2_color: "none",
  };
}

/**
 * The `+ New` menu on this page: the same component as Resources with its own
 * list.
 */
const COMMAND_OPTIONS: NewResourceOption[] = [
  {
    kind: "command",
    label: "Slash command",
    description: "A /command of your own. Syncs to Discord the moment you save.",
    icon: IconSlash,
  },
  {
    kind: "template",
    label: "Message template",
    description: "A saved message to drop into command rows and buttons.",
    icon: IconTemplate,
  },
];

export function CustomCommandsSection() {
  const {
    guildId,
    meta,
    setNotice,
    value,
    stage,
    registerExternalDraft,
    setExternalDraftDirty,
  } = useManage();
  const [commands, setCommands] = useState<CustomCommandDoc[] | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [embedTemplates, setEmbedTemplates] = useState<string[]>([]);
  const [editing, setEditing] = useState<CustomCommandDoc | null>(null);
  const [originalName, setOriginalName] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [editorStep, setEditorStep] = useState<"setup" | "inputs" | "response">("setup");
  const [templateChannels, setTemplateChannels] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const isTemplate = Boolean((editing as any)?.__template);
  const editorRef = useRef<HTMLDivElement>(null);
  const enabled = Boolean(value("Modules.customcommands"));

  const load = useCallback(async () => {
    try {
      const [cmdRes, tplRes] = await Promise.all([
        fetch(`/api/manage/${guildId}/customcommands`),
        fetch(`/api/manage/${guildId}/templates`),
      ]);
      const cmdJson = cmdRes.ok ? await cmdRes.json() : { commands: [] };
      setCommands(cmdJson.commands || []);
      const tplJson = tplRes.ok ? await tplRes.json() : { messages: [] };
      setTemplates(Array.isArray(tplJson.messages) ? tplJson.messages : []);
      setEmbedTemplates(
        Array.isArray(tplJson.embeds)
          ? tplJson.embeds.map((item: any) => String(item?.name || "")).filter(Boolean)
          : [],
      );
    } catch {
      setCommands([]);
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (editing) trackFocus(editorRef.current);
  }, [editing]);

  const roles = meta?.roles || [];
  const dirty = useMemo(
    () => (editing && baseline ? !configValuesEqual(editing, JSON.parse(baseline)) : false),
    [editing, baseline]
  );
  const editorKey = "custom-command-editor";
  const saveRef = useRef<() => Promise<boolean>>(async () => true);
  const discardRef = useRef<() => void>(() => undefined);
  saveRef.current = isTemplate ? saveTemplate : saveCommand;
  discardRef.current = () => {
    if (!editing || !baseline) return;
    setEditing(JSON.parse(baseline));
  };

  useEffect(
    () =>
      registerExternalDraft(editorKey, {
        save: () => saveRef.current(),
        discard: () => discardRef.current(),
        label: "a custom command",
      }),
    [registerExternalDraft],
  );

  useEffect(() => {
    setExternalDraftDirty(editorKey, Boolean(editing && dirty));
  }, [dirty, editing, setExternalDraftDirty]);

  const { dragProps, overIndex } = useDragReorder(
    editing?.command_options || [],
    (next) => {
      if (!editing) return;
      setEditing({
        ...editing,
        command_options: next.map((option, index) => ({ ...option, ix: index + 1 })),
      });
    }
  );

  function openEditor(command: CustomCommandDoc | null) {
    const draft: CustomCommandDoc = command
      ? JSON.parse(JSON.stringify(command))
      : emptyCommand();
    draft.embed = draft.embed || {};
    draft.command_options = draft.command_options || [];
    setEditing(draft);
    setOriginalName(command ? command.name : null);
    setBaseline(JSON.stringify(draft));
    setEditorStep("setup");
  }

  function openTemplate(template: any | null) {
    const message = template?.message || {};
    const draft: any = {
      ...emptyCommand(),
      __template: true,
      name: template?.name || "",
      description: template?.description || "",
      emoji: template?.emoji || "",
      content: message.content ?? template?.content ?? "",
      embed: message.embed || {},
      render_mode: message.render_mode === "v2" ? "v2" : "legacy",
      v2_layout: message.v2_layout || [],
      v2_explicit_layout: Boolean(message.v2_explicit_layout),
      v2_color: message.v2_color || "none",
      components: message.components || [],
    };
    setEditing(draft);
    setOriginalName(template ? template.name : null);
    setBaseline(JSON.stringify(draft));
    setEditorStep("setup");
  }

  function applyMessageTemplate(name: string | null) {
    if (!editing || !name) return;
    const template = templates.find((item) => String(item?.name || "") === name);
    if (!template) return;
    const message = template.message || {};
    setEditing({
      ...editing,
      content: message.content ?? template.content ?? "",
      embed: message.embed || {},
      render_mode: message.render_mode === "v2" ? "v2" : "legacy",
      v2_layout: message.v2_layout || [],
      v2_color: message.v2_color || "none",
      components: message.components || [],
    });
    setNotice({ kind: "saved", text: `Loaded message template “${name}”` });
  }

  async function saveTemplate(): Promise<boolean> {
    if (!editing) return true;
    if (!editing.name.trim()) {
      setNotice({ kind: "error", text: "Add a template name before saving" });
      return false;
    }
    const isV2 = editing.render_mode === "v2";
    if (isV2) {
      const validationError = containerValidationError(editing.v2_layout || []);
      if (validationError) {
        setNotice({ kind: "error", text: validationError });
        return false;
      }
    }
    const message = {
      content: editing.content?.trim() || "",
      embed: isV2 ? undefined : cleanEmbed(editing.embed || {}),
      render_mode: isV2 ? "v2" : "legacy",
      v2_layout: editing.v2_layout || [],
      v2_color: editing.v2_color || "none",
      components: editing.components || [],
    };
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          type: "message",
          name: editing.name.trim(),
          description: (editing as any).description || "",
          emoji: (editing as any).emoji || "",
          content: editing.content?.trim() || " ",
          message,
        }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.detail || errorBody?.message || "Request failed");
      }
      await load();
      setNotice({ kind: "saved", text: `Saved template “${editing.name.trim()}”` });
      setEditing(null);
      setOriginalName(null);
      return true;
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Request failed",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(name: string) {
    await fetch(`/api/manage/${guildId}/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", type: "message", name }),
    }).catch(() => undefined);
    await load();
  }

  async function sendTemplate(name: string) {
    const channelId = templateChannels[name];
    if (!channelId) {
      setNotice({ kind: "error", text: "Choose a channel first" });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          type: "message",
          name,
          channel_id: channelId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || "Could not send template");
      setNotice({ kind: "saved", text: `Sent “${name}” to Discord` });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not send template",
      });
    } finally {
      setBusy(false);
    }
  }

  async function mutate(
    body: Record<string, unknown>,
    successText: string,
    announceSuccess = true,
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/customcommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.detail || "Request failed");
      }
      const json = await res.json();
      setCommands(json.commands || []);
      if (announceSuccess) setNotice({ kind: "saved", text: successText });
      return true;
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Request failed",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveCommand(): Promise<boolean> {
    if (!editing) return true;
    if (!editing.name.trim()) {
      setNotice({ kind: "error", text: "Add a command name before saving" });
      return false;
    }
    if (editing.render_mode === "v2") {
      const validationError = containerValidationError(editing.v2_layout || []);
      if (validationError) {
        setNotice({ kind: "error", text: validationError });
        return false;
      }
    }
    const payload: CustomCommandDoc = {
      ...editing,
      name: editing.name.trim(),
      content: editing.content?.trim() || null,
      embed: editing.render_mode === "v2" ? undefined : cleanEmbed(editing.embed || {}),
      render_mode: editing.render_mode === "v2" ? "v2" : "legacy",
      v2_layout: editing.v2_layout || [],
      v2_color: editing.v2_color || "none",
    };
    const ok = await mutate(
      { action: "save", original_name: originalName, command: payload },
      `Saved /${sanitizeCommandName(editing.name)} and synced it to Discord`,
      false,
    );
    if (ok) {
      setEditing(null);
      setOriginalName(null);
    }
    return ok;
  }

  function closeEditor() {
    if (!dirty) {
      setEditing(null);
      return;
    }
    setConfirm({
      title: "Discard these changes?",
      body: "Your unsaved edits will be lost. The last saved command or template will stay unchanged.",
      confirmLabel: "Discard changes",
      danger: true,
      onConfirm: () => {
        setEditing(null);
        setOriginalName(null);
      },
    });
  }

  return (
    <div className="space-y-5 pb-24">
      <SectionHeader
        title="Commands & Templates"
        actions={
          !editing ? (
            <NewResourceMenu<"command" | "template">
              options={COMMAND_OPTIONS}
              onCreate={(kind) =>
                kind === "template" ? openTemplate(null) : openEditor(null)
              }
            />
          ) : undefined
        }
      />

      {!enabled ? (
        <ModuleDisabledBanner
          moduleLabel="Custom Commands"
          onEnable={() => stage("Modules.customcommands", true)}
        />
      ) : null}

      {/* No filter tabs: commands and templates are both listed, each under its
         own heading. */}

      {editing ? (
        <div ref={editorRef} className="space-y-4">
          {/* A large back control. */}
          <div className="sticky top-14 z-30 flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#08090a]/95 px-1 py-2 backdrop-blur-xl">
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-white/65 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <IconArrowLeft size={16} />
              Back to {isTemplate ? "templates" : "commands"}
            </button>
            <div className="flex items-center gap-2">
              {dirty ? (
                <span className="hidden text-xs text-[var(--accent-peach)] sm:inline">Unsaved changes</span>
              ) : null}
              {/* Duplicate and Delete live in the editor, next to what they act
                 on. */}
              {originalName && !isTemplate ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    title="Duplicate this command"
                    onClick={() => {
                      const clone: CustomCommandDoc = JSON.parse(
                        JSON.stringify(editing),
                      );
                      clone.name = `${clone.name}-copy`.slice(0, 48);
                      delete (clone as unknown as Record<string, unknown>)._id;
                      openEditor(clone);
                      setOriginalName(null);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <IconCopy size={15} />
                    <span className="hidden sm:inline">Duplicate</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({
                        title: `Delete /${editing?.Command || editing?.name}?`,
                        body: "This removes the command from Discord and deletes its saved setup. This cannot be undone.",
                        confirmLabel: "Delete command",
                        danger: true,
                        onConfirm: () => {
                          void mutate(
                            { action: "delete", name: originalName },
                            `Deleted /${editing?.Command || editing?.name}`,
                          ).then((ok) => {
                            if (ok) closeEditor();
                          });
                        },
                      })
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-white/45 transition-colors hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
                  >
                    <IconTrash size={15} />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </>
              ) : null}
              {originalName && isTemplate ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      title: `Delete \u201c${originalName}\u201d?`,
                      body: "This permanently deletes the message template. Commands or buttons that refer to it may stop sending that message.",
                      confirmLabel: "Delete template",
                      danger: true,
                      onConfirm: () => {
                        void deleteTemplate(originalName);
                        closeEditor();
                      },
                    })
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-white/45 transition-colors hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
                >
                  <IconTrash size={15} />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={() => void (isTemplate ? saveTemplate() : saveCommand())}
                className="btn-pop btn-peach h-9 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Saving…" : `Save ${isTemplate ? "template" : "command"}`}
              </button>
            </div>
          </div>
          <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0d0e0f] p-1">
            {([
              ["setup", "1", "Setup", isTemplate ? "Name and description" : "Name and access"],
              ["inputs", "2", "Inputs", "Slash fields and flows"],
              ["response", isTemplate ? "2" : "3", "Response", "Message and buttons"],
            ] as const)
              .filter(([value]) => !(isTemplate && value === "inputs"))
              .map(([value, number, label, description]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEditorStep(value)}
                  className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-left transition-colors ${
                    editorStep === value
                      ? "border-[rgb(var(--accent-rgb)/0.32)] bg-[rgb(var(--accent-rgb)/0.1)]"
                      : "border-transparent hover:bg-white/[0.035]"
                  }`}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-[var(--accent-peach)]">
                    {number}
                  </span>
                  <span className="text-sm font-bold text-white">{label}</span>
                  <span className="sr-only">{description}</span>
                </button>
              ))}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            {editorStep === "setup" ? (
            <SettingsCard
              title={
                isTemplate
                  ? originalName
                    ? `Edit template “${originalName}”`
                    : "New message template"
                  : originalName
                    ? `Edit /${originalName}`
                    : "New command"
              }
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldRow
                  label={isTemplate ? "Template name" : "Command name"}
                  description={
                    isTemplate
                      ? "Shown when picking this template."
                      : editing.name
                        ? `Runs as /${sanitizeCommandName(editing.name)}`
                        : "Lowercase, no spaces."
                  }
                >
                  <TextField
                    value={editing.name}
                    maxLength={48}
                    placeholder={isTemplate ? "welcome-message" : "welcome-pack"}
                    onChange={(next) => setEditing({ ...editing, name: next })}
                  />
                </FieldRow>
                {isTemplate ? (
                  <FieldRow label="Emoji" description="Optional icon for the template.">
                    <EmojiPickerButton
                      value={(editing as any).emoji || undefined}
                      onChange={(next) =>
                        setEditing({ ...(editing as any), emoji: next || "" })
                      }
                    />
                  </FieldRow>
                ) : (
                  <FieldRow label="Category">
                    <TextField
                      value={editing.category || ""}
                      maxLength={48}
                      placeholder="Uncategorized"
                      onChange={(next) =>
                        setEditing({ ...editing, category: next })
                      }
                    />
                  </FieldRow>
                )}
              </div>
              <FieldRow label="Description">
                <TextField
                  value={editing.description || ""}
                  maxLength={isTemplate ? 200 : 100}
                  onChange={(next) =>
                    setEditing({ ...editing, description: next })
                  }
                />
              </FieldRow>
              {!isTemplate ? (
                <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldRow
                  label="Permission roles"
                  description="Only these roles can use it. Leave empty for everyone."
                >
                  <RolePicker
                    roles={roles}
                    multi
                    value={(editing.permissionroles || []).map(String)}
                    onChange={(next) =>
                      setEditing({
                        ...editing,
                        permissionroles: (next as string[]) || [],
                      })
                    }
                  />
                </FieldRow>
                <FieldRow label="Ping role" description="Pinged when the command runs.">
                  <RolePicker
                    roles={roles}
                    value={editing.ping ? String(editing.ping) : null}
                    onChange={(next) =>
                      setEditing({ ...editing, ping: (next as string) || null })
                    }
                  />
                </FieldRow>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldRow
                  label="Send to channel"
                  description="Where the reply goes. Leave empty to reply where it's used."
                >
                  <ChannelPicker
                    channels={meta?.channels || []}
                    value={
                      editing.target_channel_id
                        ? String(editing.target_channel_id)
                        : null
                    }
                    onChange={(next) =>
                      setEditing({
                        ...editing,
                        target_channel_id: (next as string) || null,
                      })
                    }
                  />
                </FieldRow>
                <FieldRow
                  label="Disabled"
                  description="Keeps the command saved but unusable."
                  inline
                >
                  <Toggle
                    checked={Boolean(editing.disabled)}
                    onChange={(next) =>
                      setEditing({ ...editing, disabled: next })
                    }
                  />
                </FieldRow>
              </div>
                </>
              ) : null}
            </SettingsCard>
            ) : null}

            {!isTemplate && editorStep === "inputs" ? (
            <SettingsCard
              title="Slash fields"
              description="Up to 5 inputs asked when the command is used. Drag to reorder."
              actions={
                <button
                  type="button"
                  disabled={(editing.command_options || []).length >= 5}
                  onClick={() =>
                    setEditing({
                      ...editing,
                      command_options: [
                        ...(editing.command_options || []),
                        {
                          ix: (editing.command_options || []).length + 1,
                          name: `field${(editing.command_options || []).length + 1}`,
                          description: "Custom command field",
                          type: "text",
                          required: false,
                          choices: [],
                          channel_types: [],
                          user_source: "discord",
                          use_for_send: false,
                        },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#f5f2f2] transition-colors hover:border-[rgb(var(--accent-rgb)/0.35)] disabled:opacity-40"
                >
                  <IconPlus size={13} />
                  Add field
                </button>
              }
            >
              {(editing.command_options || []).length === 0 ? (
                <p className="cool-text text-sm">
                  No fields, so the command will run without inputs.
                </p>
              ) : (
                (editing.command_options || []).map((option, index) => (
                  <div
                    key={index}
                    className={overIndex === index ? "opacity-60" : ""}
                  >
                    <OptionEditor
                      option={option}
                      roles={roles}
                      embedTemplates={embedTemplates}
                      dragHandleProps={dragProps(index)}
                      onChange={(next) => {
                        const options = [...(editing.command_options || [])];
                        options[index] = next;
                        setEditing({ ...editing, command_options: options });
                      }}
                      onRemove={() =>
                        setEditing({
                          ...editing,
                          command_options: (editing.command_options || []).filter(
                            (_, i) => i !== index
                          ),
                        })
                      }
                    />
                  </div>
                ))
              )}
            </SettingsCard>
            ) : null}

            {!isTemplate ? (
            <AiSuggestCard
              command={editing}
              onApply={(suggestion) =>
                setEditing({
                  ...editing,
                  name:
                    typeof suggestion.name === "string"
                      ? sanitizeCommandName(suggestion.name)
                      : editing.name,
                  description:
                    typeof suggestion.description === "string"
                      ? suggestion.description
                      : editing.description,
                  category:
                    typeof suggestion.category === "string"
                      ? suggestion.category
                      : editing.category,
                  content:
                    typeof suggestion.content === "string"
                      ? suggestion.content
                      : editing.content,
                  embed: suggestion.embed || editing.embed,
                  command_options: Array.isArray(suggestion.command_options)
                    ? suggestion.command_options
                    : editing.command_options,
                  components: Array.isArray(suggestion.components)
                    ? suggestion.components
                    : (editing as any).components,
                  render_mode:
                    suggestion.render_mode === "v2" ? "v2" : editing.render_mode,
                  v2_layout: Array.isArray(suggestion.v2_layout)
                    ? suggestion.v2_layout
                    : editing.v2_layout,
                  // A generated layout is read as written. Otherwise the model
                  // asking for a bare Text block gets a box around it.
                  v2_explicit_layout: Array.isArray(suggestion.v2_layout)
                    ? true
                    : editing.v2_explicit_layout,
                  v2_color:
                    typeof suggestion.v2_color === "string"
                      ? suggestion.v2_color
                      : editing.v2_color,
                  permissionroles: Array.isArray(suggestion.permissionroles)
                    ? suggestion.permissionroles
                    : editing.permissionroles,
                  ping:
                    typeof suggestion.ping === "string"
                      ? suggestion.ping
                      : editing.ping,
                  target_channel_id:
                    typeof suggestion.target_channel_id === "string"
                      ? suggestion.target_channel_id
                      : editing.target_channel_id,
                })
              }
            />
            ) : null}

            {editorStep === "response" ? (
            <>
            <SettingsCard
              title="Response message"
              description="What the bot sends. Fields are available as {field_name}."
              actions={
                <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                  {(["embed", "container"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          render_mode: option === "container" ? "v2" : "legacy",
                        })
                      }
                      className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                        (editing.render_mode === "v2") === (option === "container")
                          ? "bg-[rgb(var(--accent-rgb)/0.15)] text-[#f5f2f2]"
                          : "text-white/50 hover:text-white"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              }
            >
              {!isTemplate ? (
                <FieldRow label="Reusable message template">
                  <SelectField
                    value={null}
                    placeholder={
                      templates.length
                        ? "Choose a saved message template"
                        : "No message templates saved"
                    }
                    options={templates.map((template) => ({
                      value: String(template.name || ""),
                      label: String(template.name || "Untitled template"),
                    }))}
                    onChange={applyMessageTemplate}
                  />
                </FieldRow>
              ) : null}
              <FieldRow label="Content">
                <TextAreaField
                  rows={3}
                  value={editing.content || ""}
                  placeholder="Optional message content"
                  trailing={<InsertMenu containerRef={editorRef} />}
                  onChange={(next) => setEditing({ ...editing, content: next })}
                />
              </FieldRow>
              <TemplateBar
                mode={editing.render_mode === "v2" ? "container" : "embed"}
                embed={editing.embed || {}}
                container={{
                  layout: editing.v2_layout || [],
                  color: editing.v2_color || "none",
                  content: editing.content || "",
                }}
                onLoadEmbed={(embed) =>
                  setEditing({ ...editing, embed, render_mode: "legacy" })
                }
                onLoadContainer={(template) =>
                  setEditing({
                    ...editing,
                    render_mode: "v2",
                    v2_layout: template.layout,
                    v2_color: template.color || "none",
                    v2_explicit_layout: true,
                  })
                }
              />
            </SettingsCard>
            {editing.render_mode === "v2" ? (
              <SettingsCard
                title="Container blocks"
                description="Text, dividers, pictures and buttons. Drag to reorder."
              >
                <FieldRow label="Accent color">
                  <AccentSwatches
                    value={editing.v2_color || "none"}
                    onChange={(next) => setEditing({ ...editing, v2_color: next || "none" })}
                  />
                </FieldRow>
                <ContainerBlocksEditor
                  blocks={editing.v2_layout || []}
                  explicitLayout={Boolean(editing.v2_explicit_layout)}
                  insertMenu={<InsertMenu containerRef={editorRef} />}
                  onChange={(next) =>
                    setEditing({ ...editing, v2_layout: next, v2_explicit_layout: true })
                  }
                />
              </SettingsCard>
            ) : (
              <>
                <EmbedForm
                  embed={editing.embed || {}}
                  insertMenu={<InsertMenu containerRef={editorRef} />}
                  onChange={(patch: Partial<MessageEmbed>) =>
                    setEditing({
                      ...editing,
                      embed: { ...(editing.embed || {}), ...patch },
                    })
                  }
                />
                <SettingsCard
                  title="Button rows"
                  description="Up to five buttons per row."
                >
                  <LegacyButtonRowsEditor
                    components={editing.components || []}
                    onChange={(next) =>
                      setEditing({ ...editing, components: next })
                    }
                  />
                </SettingsCard>
              </>
            )}
            </>
            ) : null}
          </div>

          <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            {/* The same `SettingsCard` as the left column. */}
            <SettingsCard
              title={`Live preview · /${sanitizeCommandName(editing.name) || "command"}`}
            >
              {editing.render_mode === "v2" ? (
                <ContainerPreview
                  blocks={editing.v2_layout || []}
                  color={editing.v2_color || "none"}
                  content={editing.content || ""}
                  explicitLayout={Boolean(editing.v2_explicit_layout)}
                />
              ) : (
                <DiscordPreview
                  message={{
                    content: editing.content || "",
                    embed: editing.embed || {},
                  }}
                  buttons={editing.components || []}
                />
              )}
            </SettingsCard>
            {/* Smart, context-aware variables: global + custom-command tokens,
                plus a live token for each of THIS command's slash fields. */}
            <SettingsCard
              title="Variables"
              description="Click one to drop it into the field you were typing in."
            >
              <VariableChips
                variables={[
                  ...(editing.command_options || [])
                    .map((option) => `{${String(option.name || "").trim()}}`)
                    .filter((token) => token !== "{}"),
                  ...variablesForGroups(
                    "Custom command",
                    "Server details",
                    "Channel details",
                    "Member details",
                    "Date & time",
                  ),
                ]}
                containerRef={editorRef}
              />
            </SettingsCard>
            {/* The same JSON box as every other message editor.
               `applyMessageShape` replaces the message keys rather than
               merging, so pasting an embed clears an existing container layout.
               The command's own fields (name, options, permissions) are
               untouched. */}
            <DiscordJsonBox
              value={editing as CustomMessage}
              onApply={(next) => setEditing(applyMessageShape(editing, next))}
            />
          </div>
          </div>
        </div>
      ) : commands === null ? (
        <SkeletonRows rows={4} label="Loading commands…" />
      ) : commands.length === 0 ? (
        <EmptyState
          title="No custom commands yet"
                doodle="bulb"
          hint="Build one here and it appears in Discord the moment you save."
        />
      ) : (
        // The same card as a resource: frame, icon well and meta row.
        <div className="resource-grid">
          {commands.map((command) => (
            // The whole card opens the editor. Duplicate and Delete are inside
            // it.
            <button
              key={command.name}
              type="button"
              onClick={() => openEditor(command)}
              className="resource-item card-in text-left"
            >
              {/* The preview is the command as Discord shows it. */}
              <span className="resource-preview resource-preview-command">
                <span className="resource-preview-inner">
                  <span className="resource-preview-slash">
                    /{command.Command || command.name}
                  </span>
                  {(command.command_options || []).slice(0, 3).map((option: any) => (
                    <span key={option.name} className="resource-preview-arg">
                      {option.name}
                      {option.required ? "" : "?"}
                    </span>
                  ))}
                </span>
              </span>
              <span className="resource-item-head">
                <span className="resource-item-icon">
                  <IconSlash size={19} />
                </span>
                <span className="min-w-0">
                  <span className="resource-item-title">
                    /{command.Command || command.name}
                  </span>
                  <span className="resource-item-sub">
                    <IconClock size={12} />
                    {command.category || "Uncategorized"}
                    {(command.command_options || []).length > 0
                      ? ` · ${(command.command_options || []).length} field${
                          (command.command_options || []).length === 1 ? "" : "s"
                        }`
                      : ""}
                    {command.disabled ? " · Disabled" : ""}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!editing && templates.length > 0 ? (
        <div className="space-y-3">
          <SectionLabel>
            Message templates
          </SectionLabel>
          <div className="resource-grid">
            {templates.map((template) => (
              <div key={template.name} className="resource-item card-in">
                {/* Same card, same preview slot. A template is a message, so
                    the preview is the message. */}
                <button
                  type="button"
                  onClick={() => openTemplate(template)}
                  className="resource-preview resource-preview-template text-left"
                >
                  <span className="resource-preview-inner">
                    <span className="resource-preview-title">
                      {template.emoji ? `${template.emoji} ` : ""}
                      {template.name}
                    </span>
                    <span className="resource-preview-body">
                      {template.description || "Message template"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openTemplate(template)}
                  className="resource-item-head text-left"
                >
                  <span className="resource-item-icon">
                    {template.emoji ? (
                      <span>{template.emoji}</span>
                    ) : (
                      <IconTemplate size={19} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="resource-item-title">{template.name}</span>
                    <span className="resource-item-sub">
                      <IconClock size={12} />
                      Message template
                    </span>
                  </span>
                </button>
                {/* Sending is the one thing done to a template without opening
                   it, so it stays on the card. */}
                <div className="mt-auto flex items-center gap-2 border-t border-white/[0.08] pt-3">
                  <div className="min-w-0 flex-1">
                    <ChannelPicker
                      channels={meta?.channels || []}
                      value={templateChannels[template.name] || null}
                      placeholder="Choose a channel"
                      onChange={(next) =>
                        setTemplateChannels((current) => ({
                          ...current,
                          [template.name]: String(next || ""),
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !templateChannels[template.name]}
                    onClick={() => void sendTemplate(template.name)}
                    className="btn-pop btn-peach h-9 shrink-0 px-3 text-xs font-bold disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!editing && templates.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl py-14 text-center">
          <IconTemplate size={38} className="text-white/25" />
          <p className="cool-text max-w-sm text-sm">
            No message templates yet. Save one once, then reuse it in commands and buttons.
          </p>
        </div>
      ) : null}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
