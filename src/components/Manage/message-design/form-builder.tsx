"use client";

import React, { useRef } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  ChannelPicker,
  ColorPicker,
  NumberField,
  OptionCard,
  RolePicker,
  SelectField,
  TextAreaField,
  TextField,
} from "../fields";
import { useOptionalManage } from "../manage-context";
import { ContainerFlowBuilder } from "../container-flow-builder";
import { PresenceList } from "@/components/motion";
import { ButtonColorSwatches, ButtonTargets } from "./button-controls";
import { CONTAINER_LIMITS, ContainerRowButton } from "./model";
import { PreviewButton } from "./preview";

/* The form a button opens: its questions and what happens on review. */

/** Editor for one button — shared by Button Rows and Text + Button blocks.
 *  Mirrors every behaviour the bot's container builder supports. */
/* Question types offered, named for what the bot renders. "Yes/no tick" is
   `discord.ui.Checkbox`, a single tick with no options. Picking several options
   is Multiple choice with a raised limit: `interactive_forms` builds a Select
   and passes `max_values` through. */
const FORM_QUESTION_TYPES = [
  { value: "short_text", label: "Short answer" },
  { value: "paragraph_text", label: "Paragraph" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "role_select", label: "Role picker" },
  { value: "file_upload", label: "File upload" },
  { value: "checkbox", label: "Yes / no tick" },
  { value: "text_display", label: "Information text" },
];

/** Types whose answer is a list the person filling the form picks from. */
const OPTION_QUESTION_TYPES = new Set(["dropdown", "checkboxes"]);

/**
 * Types whose control shows placeholder text; a tick and a file picker have
 * none.
 */
/** Types whose answer is typed, so a length range means something. */
const TYPES_WITH_LENGTH = new Set(["short_text", "paragraph_text"]);

const TYPES_WITH_PLACEHOLDER = new Set([
  "short_text",
  "paragraph_text",
  "dropdown",
  "checkboxes",
  "role_select",
]);

/* Dropdown and Checkboxes are both stored as `multiple_choice`, told apart by
   how many can be picked (`max_values`). Discord has no checkbox-list
   component; a question with choices is a Select. The applications form builder
   maps them the same way. */
function formQuestionUiType(question: Record<string, any>): string {
  const stored = question.question_type || "short_text";
  if (stored !== "multiple_choice") return stored;
  return Number(question.max_values || 1) > 1 ? "checkboxes" : "dropdown";
}

/** The stored fields for a UI type, so the picker writes one shape. */
function formQuestionFromUiType(
  question: Record<string, any>,
  uiType: string,
): Record<string, any> {
  const next = { ...question };
  if (uiType === "dropdown" || uiType === "checkboxes") {
    next.question_type = "multiple_choice";
    next.options = Array.isArray(next.options) ? next.options : [];
    // Checkboxes means "as many as there are", which is the answer that stops
    // being wrong when an option is added later. Dropdown pins it at one.
    next.max_values =
      uiType === "checkboxes" ? Math.max(next.options.length, 1) : 1;
    return next;
  }
  next.question_type = uiType;
  delete next.max_values;
  return next;
}

/**
 * The options of a choice question, edited like the resource form builder: a
 * row per option, Enter adds the next, Backspace on an empty row removes it,
 * and a live "Add option" row at the bottom becomes an option once typed in.
 */
function FormOptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);
  const limit = CONTAINER_LIMITS.selectOptions;
  return (
    <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <p className="gw-caption mb-2">
        Options
      </p>
      {options.length === 0 ? (
        <p className="cool-text px-1 pb-1 text-[11px]">
          A choice question with no options renders as an empty menu. Add at
          least one.
        </p>
      ) : null}
      {options.map((option, optionIndex) => (
        <div key={optionIndex} className="flex items-center gap-2">
          <span className="shrink-0 text-white/25">
            <IconChevronDown size={13} />
          </span>
          <input
            ref={(node) => {
              rowRefs.current[optionIndex] = node;
            }}
            value={option}
            maxLength={100}
            placeholder={`Option ${optionIndex + 1}`}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (options.length >= limit) return;
                const next = [...options];
                next.splice(optionIndex + 1, 0, "");
                onChange(next);
                requestAnimationFrame(() => rowRefs.current[optionIndex + 1]?.focus());
              } else if (event.key === "Backspace" && option === "") {
                event.preventDefault();
                onChange(options.filter((_, i) => i !== optionIndex));
                requestAnimationFrame(() =>
                  rowRefs.current[Math.max(0, optionIndex - 1)]?.focus(),
                );
              }
            }}
            onChange={(event) => {
              const next = [...options];
              next[optionIndex] = event.target.value;
              onChange(next);
            }}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm text-[#f5f2f2] outline-none transition-colors placeholder:text-white/25 hover:border-white/[0.08] focus:border-[rgb(var(--accent-rgb)/0.4)] focus:bg-white/[0.02]"
          />
          <button
            type="button"
            aria-label={`Remove option ${optionIndex + 1}`}
            onClick={() => onChange(options.filter((_, i) => i !== optionIndex))}
            className="shrink-0 rounded p-2 text-white/30 transition-colors hover:text-[var(--tone-bad)]"
          >
            <IconTrash size={14} />
          </button>
        </div>
      ))}
      {options.length < limit ? (
        <div className="flex items-center gap-2 opacity-70 focus-within:opacity-100">
          <span className="shrink-0 text-white/25">
            <IconPlus size={13} />
          </span>
          <input
            value=""
            placeholder="Add option"
            onChange={(event) => {
              if (!event.target.value) return;
              onChange([...options, event.target.value]);
              requestAnimationFrame(() => rowRefs.current[options.length]?.focus());
            }}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm text-white/50 outline-none transition-colors placeholder:text-white/30 hover:border-white/[0.08] focus:border-white/[0.08]"
          />
        </div>
      ) : (
        <p className="px-2 pt-1 text-[11px] font-medium text-white/45">
          Discord shows at most {limit} choices in a menu.
        </p>
      )}
    </div>
  );
}

const REVIEW_PERMISSION_MODES = [
  { value: "staff", label: "Configured staff and admins" },
  { value: "admin", label: "Configured admins only" },
  { value: "roles", label: "Selected roles only" },
  { value: "staff_or_roles", label: "Staff or selected roles" },
  { value: "admin_or_roles", label: "Admins or selected roles" },
  { value: "everyone", label: "Everyone" },
];

function defaultFormQuestion(index: number) {
  return {
    question_type: "short_text",
    label: `Question ${index + 1}`,
    placeholder: "",
    required: true,
    max: 1000,
    options: [],
  };
}

function banAppealActions(): Record<string, any>[] {
  const permissionLock = { mode: "staff_or_roles", role_ids: [] };
  return [
    {
      label: "Accept",
      action_kind: "accept",
      color: "Green",
      permission_lock: permissionLock,
      flow: [
        { type: "erlc_command", command: ":unban {answers.roblox_username}" },
        { type: "edit_submission_embed", status: "Accepted", color: "57F287" },
        { type: "clear_submission_buttons" },
        { type: "send_message", target: "applicant_dm", content: "Your ban appeal for **{guild.name}** has been accepted." },
      ],
    },
    {
      label: "Further Review",
      action_kind: "further_review",
      color: "Blue",
      permission_lock: permissionLock,
      flow: [
        { type: "edit_submission_embed", status: "Further Review", color: "5865F2" },
        { type: "open_ticket", panel_name: "" },
      ],
    },
    {
      label: "Deny",
      action_kind: "deny",
      color: "Red",
      permission_lock: permissionLock,
      prompt_reason: true,
      flow: [
        { type: "edit_submission_embed", status: "Denied: {reason}", color: "ED4245" },
        { type: "clear_submission_buttons" },
        { type: "send_message", target: "applicant_dm", content: "Your ban appeal was denied.\n\nReason: {reason}" },
      ],
    },
    {
      label: "Blacklist",
      action_kind: "blacklist",
      color: "Red",
      permission_lock: permissionLock,
      prompt_reason: true,
      flow: [
        { type: "edit_submission_embed", status: "Blacklisted: {reason}", color: "111111" },
        { type: "clear_submission_buttons" },
        { type: "send_message", target: "applicant_dm", content: "You have been blacklisted from ban appeals.\n\nReason: {reason}" },
      ],
    },
  ];
}

function reviewedFormActions(): Record<string, any>[] {
  const permissionLock = { mode: "staff_or_roles", role_ids: [] };
  return [
    {
      label: "Approve",
      action_kind: "accept",
      color: "Green",
      permission_lock: permissionLock,
      flow: [
        { type: "edit_submission_embed", status: "Approved", color: "57F287" },
        { type: "clear_submission_buttons" },
        { type: "send_message", target: "applicant_dm", content: "Your submission to **{guild.name}** was approved." },
      ],
    },
    {
      label: "Further Review",
      action_kind: "further_review",
      color: "Blue",
      permission_lock: permissionLock,
      flow: [
        { type: "edit_submission_embed", status: "Further Review", color: "5865F2" },
      ],
    },
    {
      label: "Request Changes",
      action_kind: "request_changes",
      color: "Grey",
      permission_lock: permissionLock,
      prompt_reason: true,
      flow: [
        { type: "edit_submission_embed", status: "Changes Requested: {reason}", color: "FEE75C" },
        { type: "send_message", target: "applicant_dm", content: "Your submission needs changes.\n\n{reason}" },
      ],
    },
    {
      label: "Close",
      action_kind: "deny",
      color: "Red",
      permission_lock: permissionLock,
      prompt_reason: true,
      flow: [
        { type: "edit_submission_embed", status: "Closed: {reason}", color: "ED4245" },
        { type: "clear_submission_buttons" },
        { type: "send_message", target: "applicant_dm", content: "Your submission was closed.\n\n{reason}" },
      ],
    },
  ];
}

function InlineFormQuestionEditor({
  question,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  question: Record<string, any>;
  index: number;
  count: number;
  onChange: (next: Record<string, any>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const type = formQuestionUiType(question);
  const options: string[] = Array.isArray(question.options) ? question.options : [];
  // Discord rejects the whole modal if a field's minimum is above its maximum.
  const lengthRangeInvalid =
    typeof question.min === "number" &&
    typeof question.max === "number" &&
    question.min > question.max;
  return (
    <div className="editor-block p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="gw-caption">Question {index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-white/35 hover:bg-white/[0.04] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] disabled:opacity-20" aria-label="Move question up"><IconArrowUp size={15} /></button>
          <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-white/35 hover:bg-white/[0.04] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] disabled:opacity-20" aria-label="Move question down"><IconArrowDown size={15} /></button>
          <button type="button" onClick={onRemove} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-white/35 hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tone-bad)]" aria-label="Remove question"><IconTrash size={15} /></button>
        </div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[180px_1fr]">
        <SelectField
          value={type}
          options={FORM_QUESTION_TYPES}
          onChange={(next) => onChange(formQuestionFromUiType(question, next || "short_text"))}
        />
        <TextField
          value={question.label || ""}
          maxLength={45}
          placeholder="Question"
          onChange={(next) => onChange({ ...question, label: next })}
        />
      </div>
      {/* Two separate fields: the help line under the label and the grey
         placeholder inside the control say different things. */}
      {type === "text_display" ? (
        <div className="mt-2">
          <TextField
            value={question.description || question.placeholder || ""}
            maxLength={100}
            placeholder="Information shown in the form"
            onChange={(next) => onChange({ ...question, description: next })}
          />
        </div>
      ) : (
        <div
          className={`mt-2 grid gap-2 ${
            TYPES_WITH_PLACEHOLDER.has(type) ? "sm:grid-cols-2" : ""
          }`}
        >
          <TextField
            value={question.description || ""}
            maxLength={100}
            placeholder="Help text under the label"
            onChange={(next) => onChange({ ...question, description: next })}
          />
          {/* A tick and a file picker have no placeholder text. */}
          {TYPES_WITH_PLACEHOLDER.has(type) ? (
            <TextField
              value={question.placeholder || ""}
              maxLength={100}
              placeholder={
                OPTION_QUESTION_TYPES.has(type) || type === "role_select"
                  ? "Text inside the menu, e.g. Select ban duration"
                  : "Text inside the box"
              }
              onChange={(next) => onChange({ ...question, placeholder: next })}
            />
          ) : null}
        </div>
      )}
      {OPTION_QUESTION_TYPES.has(type) ? (
        <FormOptionsEditor
          options={options}
          onChange={(next) =>
            onChange({
              ...question,
              options: next.slice(0, CONTAINER_LIMITS.selectOptions),
              // Checkboxes means "any of them", so the maximum follows the
              // number of options.
              ...(type === "checkboxes"
                ? { max_values: Math.max(next.length, 1) }
                : {}),
            })
          }
        />
      ) : null}
      {/* Answer length limits. The bot stores and enforces them
         (`form_question_from_values` writes `min`/`max`; the modal passes them
         as `min_length`/`max_length`). */}
      {TYPES_WITH_LENGTH.has(type) ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberField
            value={typeof question.min === "number" ? question.min : ""}
            min={0}
            max={type === "paragraph_text" ? 4000 : 1000}
            placeholder="Min length"
            onChange={(next) => onChange({ ...question, min: next === "" ? undefined : next })}
          />
          <NumberField
            value={typeof question.max === "number" ? question.max : ""}
            min={1}
            max={type === "paragraph_text" ? 4000 : 1000}
            placeholder="Max length"
            onChange={(next) => onChange({ ...question, max: next === "" ? undefined : next })}
          />
        </div>
      ) : null}
      {lengthRangeInvalid ? (
        <p className="mt-2 text-[11px] font-semibold text-[var(--tone-bad)]">
          Minimum is above the maximum, so Discord will refuse this field.
        </p>
      ) : null}
      {type === "checkbox" ? (
        <p className="cool-text mt-2 text-[11px] leading-relaxed">
          A single checkbox. It has no options.
          For a list to pick from, use <span className="font-semibold text-white/70">Dropdown</span> or{" "}
          <span className="font-semibold text-white/70">Checkboxes</span>.
        </p>
      ) : null}
      {type !== "text_display" ? (
        <div className="mt-2">
          <OptionCard compact label="Required" checked={Boolean(question.required)} onChange={(checked) => onChange({ ...question, required: checked })} />
        </div>
      ) : null}
    </div>
  );
}

function ReviewActionEditor({
  action,
  index,
  targets,
  onChange,
  onRemove,
}: {
  action: Record<string, any>;
  index: number;
  targets: ButtonTargets;
  onChange: (next: Record<string, any>) => void;
  onRemove: () => void;
}) {
  const { meta } = useOptionalManage() ?? { meta: null };
  const lock = action.permission_lock || { mode: "staff", role_ids: [] };
  return (
    <div className="editor-block p-3">
      {/* A review button is an ordinary Discord button with a colour, so its
         header is the live preview. `type` is fixed: a review button always
         comes back to the bot, never a link. */}
      <div className="flex flex-wrap items-center gap-2 gw-dc-strip">
        <span className="gw-caption shrink-0">
          Review button {index + 1}
        </span>
        <PreviewButton button={{ ...action, type: "button", label: action.label || "" }} />
        <div className="ml-auto flex items-center gap-2">
          <OptionCard
            compact
            label="Enabled"
            checked={!Boolean(action.disabled)}
            onChange={(enabled) => onChange({ ...action, disabled: !enabled })}
          />
        </div>
        <button type="button" onClick={onRemove} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-white/35 hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tone-bad)]" aria-label="Remove review button"><IconTrash size={15} /></button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1">
          <TextField value={action.label || ""} maxLength={80} placeholder="Button label" onChange={(next) => onChange({ ...action, label: next })} />
        </div>
        <ButtonColorSwatches
          value={action.color || "Grey"}
          onChange={(next) => onChange({ ...action, color: next })}
        />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <SelectField
          value={lock.mode || "staff"}
          options={REVIEW_PERMISSION_MODES}
          onChange={(next) => onChange({ ...action, permission_lock: { ...lock, mode: next || "staff" } })}
        />
        {["roles", "staff_or_roles", "admin_or_roles"].includes(lock.mode) ? (
          <RolePicker
            roles={meta?.roles || []}
            multi
            value={(lock.role_ids || []).map(String)}
            placeholder="Who can use this button"
            onChange={(next) => onChange({ ...action, permission_lock: { ...lock, role_ids: Array.isArray(next) ? next : [] } })}
          />
        ) : <span />}
      </div>
      <div className="mt-2">
        <OptionCard compact label="Ask the reviewer for a reason" checked={Boolean(action.prompt_reason)} onChange={(checked) => onChange({ ...action, prompt_reason: checked })} />
      </div>
      <div className="mt-3">
        <ContainerFlowBuilder
          flow={Array.isArray(action.flow) ? action.flow : []}
          ticketPanels={targets.panels}
          messageTemplates={targets.messages}
          embedTemplates={targets.embeds}
          allowApplicant
          showSubmissionSteps
          onChange={(next) => onChange({ ...action, flow: next })}
        />
      </div>
    </div>
  );
}

export function InlineFormBuilder({
  button,
  targets,
  onChange,
}: {
  button: ContainerRowButton;
  targets: ButtonTargets;
  onChange: (next: ContainerRowButton) => void;
}) {
  const { meta } = useOptionalManage() ?? { meta: null };
  const questions = Array.isArray(button.questions) ? button.questions : [];
  const actions = Array.isArray(button.answer_actions) ? button.answer_actions : [];
  const patch = (next: Partial<ContainerRowButton>) => onChange({ ...button, ...next });
  const isBanAppeal = button.approval_kind === "ban_appeal";
  const isReviewedForm = button.approval_kind === "reviewed_form";
  return (
    <div className="w-full space-y-3 editor-block p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectField
          value={button.template_name || null}
          placeholder={targets.forms.length ? "Optional saved form template" : "Build the form below"}
          options={targets.forms.map((name) => ({ value: name, label: name }))}
          onChange={(next) => patch({ template_name: next || "" })}
        />
        <ChannelPicker
          channels={meta?.channels || []}
          value={button.target_channel ? String(button.target_channel) : null}
          types={button.type === "forum" ? ["forum"] : ["text", "announcement", "forum"]}
          placeholder="Answers channel"
          onChange={(next) => patch({ target_channel: next || null })}
        />
      </div>
      <p className="cool-text text-[11px]">
        Questions added here override the selected template, so this button can be fully edited without leaving the message.
      </p>
      <div className="space-y-2">
        <PresenceList
          items={questions as Record<string, any>[]}
          className="space-y-2"
          render={(question: Record<string, any>, index: number) => (
          <InlineFormQuestionEditor
            question={question}
            index={index}
            count={questions.length}
            onChange={(next) => patch({ questions: questions.map((item: any, itemIndex: number) => itemIndex === index ? next : item) })}
            onMove={(direction) => {
              const next = [...questions];
              const target = index + direction;
              if (target < 0 || target >= next.length) return;
              [next[index], next[target]] = [next[target], next[index]];
              patch({ questions: next });
            }}
            onRemove={() => patch({ questions: questions.filter((_: any, itemIndex: number) => itemIndex !== index) })}
          />
          )}
        />
        <button
          type="button"
          disabled={questions.length >= 5}
          onClick={() => patch({ questions: [...questions, defaultFormQuestion(questions.length)] })}
          className="gw-btn"
        >
          <IconPlus size={13} /> Add question
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="gw-caption block space-y-1">
          Cooldown in minutes
          <input
            type="number"
            min={0}
            max={525600}
            value={button.cooldown_minutes ?? 0}
            onChange={(event) => patch({ cooldown_minutes: Math.max(0, Number(event.target.value) || 0) })}
            className="gator-control mt-1 w-full px-3 text-sm font-medium normal-case tracking-normal"
          />
        </label>
        <div>
          <p className="gw-caption mb-1">Submission ping roles</p>
          <RolePicker roles={meta?.roles || []} multi value={(button.ping || []).map(String)} placeholder="Roles to ping" onChange={(next) => patch({ ping: Array.isArray(next) ? next : [] })} />
        </div>
        <div className="sm:col-span-2">
          <p className="gw-caption mb-1">Roles blocked from submitting</p>
          <RolePicker roles={meta?.roles || []} multi value={(button.blacklist_role_ids || []).map(String)} placeholder="No blacklist roles" onChange={(next) => patch({ blacklist_role_ids: Array.isArray(next) ? next : [] })} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField value={button.submission_title || ""} maxLength={256} placeholder="Answer card title (optional)" onChange={(next) => patch({ submission_title: next })} />
        <ColorPicker
          value={button.submission_color || "#f7a8c4"}
          label="Choose answer card colour"
          onChange={(next) => patch({ submission_color: next })}
        />
        <div className="sm:col-span-2">
          <TextAreaField rows={2} value={button.submission_intro || ""} maxLength={1800} placeholder="Text shown above the answers (optional)" onChange={(next) => patch({ submission_intro: next })} />
        </div>
        <div className="sm:col-span-2">
          <TextField value={button.submission_footer || ""} maxLength={2048} placeholder="Answer card footer (optional)" onChange={(next) => patch({ submission_footer: next })} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <OptionCard
          label="Reviewed form"
          description="Adds editable Approve, Further Review, Request Changes, and Close buttons to the answer card."
          checked={isReviewedForm}
          onChange={(checked) => patch({
            approval_kind: checked ? "reviewed_form" : "",
            answer_actions: checked ? reviewedFormActions() : isReviewedForm ? [] : actions,
          })}
        />
        <OptionCard
          label="Ban appeal form"
          description="Adds the four review buttons. You can change everything about them."
          checked={isBanAppeal}
          onChange={(checked) => patch({
            approval_kind: checked ? "ban_appeal" : "",
            answer_actions: checked ? banAppealActions() : isBanAppeal ? [] : actions,
          })}
        />
      </div>
      <div>
        <p className="gw-caption mb-2">After the form is submitted</p>
        <ContainerFlowBuilder
          flow={Array.isArray(button.post_submit_flow) ? button.post_submit_flow : []}
          ticketPanels={targets.panels}
          messageTemplates={targets.messages}
          embedTemplates={targets.embeds}
          allowApplicant
          onChange={(next) => patch({ post_submit_flow: next })}
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="gw-caption">Answer review buttons</p>
          <button
            type="button"
            disabled={actions.length >= 5}
            onClick={() => patch({ answer_actions: [...actions, { label: `Action ${actions.length + 1}`, color: "Grey", permission_lock: { mode: "staff", role_ids: [] }, flow: [] }] })}
            className="gw-btn"
          >
            <IconPlus size={12} /> Add action
          </button>
        </div>
        <div className="space-y-2">
          {actions.map((action: Record<string, any>, index: number) => (
            <ReviewActionEditor
              key={index}
              action={action}
              index={index}
              targets={targets}
              onChange={(next) => patch({ answer_actions: actions.map((item: any, itemIndex: number) => itemIndex === index ? next : item) })}
              onRemove={() => patch({ answer_actions: actions.filter((_: any, itemIndex: number) => itemIndex !== index) })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
