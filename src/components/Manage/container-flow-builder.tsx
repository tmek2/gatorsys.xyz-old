"use client";

import React from "react";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconMessage,
  IconPlus,
  IconShieldCheck,
  IconTicket,
  IconTrash,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { ChannelPicker, ColorPicker, RolePicker, SelectField, TextAreaField, TextField } from "./fields";
import { useOptionalManage } from "./manage-context";
import { PickerPopover } from "./picker-popover";

/**
 * The steps a button runs when pressed. Shapes mirror the bot's
 * `normalize_submission_flow_step` (utils/interactive_forms.py). For container
 * buttons the acting subject is always the clicker.
 */

export interface FlowStep {
  type: string;
  [key: string]: any;
}

const STEP_DEFS: { type: string; label: string; hint: string; icon: React.ReactNode; submissionOnly?: boolean }[] = [
  { type: "send_message", label: "Send Message", hint: "Reply to the clicker or post in a channel", icon: <IconMessage size={15} /> },
  { type: "send_embed", label: "Send Embed", hint: "Send a saved embed template", icon: <IconMessage size={15} /> },
  { type: "add_role", label: "Add Role", hint: "Give the clicker a role", icon: <IconUserPlus size={15} /> },
  { type: "remove_role", label: "Remove Role", hint: "Take a role from the clicker", icon: <IconUserMinus size={15} /> },
  { type: "toggle_role", label: "Toggle Role", hint: "Add the role if missing, remove it if present", icon: <IconUsers size={15} /> },
  { type: "check_role", label: "Require Role", hint: "Stop the flow unless the clicker has a role", icon: <IconShieldCheck size={15} /> },
  { type: "wait", label: "Wait", hint: "Pause before the next step", icon: <IconClock size={15} /> },
  { type: "open_ticket", label: "Open Ticket", hint: "Open a ticket panel for the clicker", icon: <IconTicket size={15} /> },
  { type: "erlc_command", label: "Run ERLC Command", hint: "Run a PRC command with answer variables", icon: <IconShieldCheck size={15} /> },
  { type: "edit_submission_embed", label: "Update Answer Card", hint: "Change the title, status, text, or color", icon: <IconMessage size={15} />, submissionOnly: true },
  { type: "clear_submission_buttons", label: "Remove Review Buttons", hint: "Lock the answer card after a decision", icon: <IconShieldCheck size={15} />, submissionOnly: true },
  { type: "session_information", label: "Show Session Information", hint: "Open live players, staff, queue, or vehicles", icon: <IconUsers size={15} /> },
];

function stepMeta(type: string) {
  return STEP_DEFS.find((d) => d.type === type);
}

const MESSAGE_TARGETS = [
  { value: "clicker_ephemeral", label: "Reply privately to clicker" },
  { value: "clicker_dm", label: "DM the clicker" },
  { value: "submission_channel", label: "Post in the button / submission channel" },
  { value: "selected_channels", label: "Post in selected channels" },
];

const APPLICANT_TARGETS = [
  ...MESSAGE_TARGETS,
  { value: "applicant_dm", label: "DM the form applicant" },
];

const SUBJECT_OPTIONS = [
  { value: "applicant", label: "Form applicant" },
  { value: "clicker", label: "Person pressing the review button" },
];

/**
 * A few words describing a step, for its folded row (more specific than the
 * step type).
 */
export function flowStepSummary(step: FlowStep): string {
  const trim = (value: unknown, max = 44) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };
  const targetLabel = (value: string) =>
    APPLICANT_TARGETS.find((option) => option.value === value)?.label || "";

  switch (step.type) {
    case "send_message": {
      const body = trim(step.template_name || step.content);
      const where = targetLabel(step.target || "clicker_ephemeral");
      if (body && where) return `${where}: “${body}”`;
      return body ? `“${body}”` : where;
    }
    case "send_embed": {
      const where = targetLabel(step.target || "clicker_ephemeral");
      const name = trim(step.template_name);
      return name ? (where ? `${name} → ${where}` : name) : where;
    }
    case "add_role":
    case "remove_role":
    case "toggle_role":
    case "check_role":
      // The id, not the role name: this is also used from the automation
      // canvas, which has no manage provider or role list. The open panel shows
      // the picker with the real name.
      return step.role_id ? `Role ${trim(step.role_id, 22)}` : "No role picked";
    case "wait": {
      const seconds = Number(step.seconds);
      if (!Number.isFinite(seconds) || seconds <= 0) return "";
      return seconds === 1 ? "1 second" : `${seconds} seconds`;
    }
    case "open_ticket":
      return trim(step.panel_name) || "No panel picked";
    case "erlc_command":
      return trim(step.command) || "No command";
    case "edit_submission_embed": {
      const parts = [trim(step.title, 24), trim(step.status, 18)].filter(Boolean);
      return parts.join(" · ");
    }
    case "session_information":
      return trim(step.page);
    default:
      return "";
  }
}

/**
 * What is wrong with a step, shown on the row so a broken step is findable
 * while folded.
 */
export function flowStepErrors(step: FlowStep): string[] {
  const errors: string[] = [];
  switch (step.type) {
    case "send_message":
      if (!String(step.content || "").trim() && !String(step.template_name || "").trim())
        errors.push("This step sends nothing: write a message or pick a template.");
      if (step.target === "selected_channels" && !(step.channel_ids || []).length)
        errors.push("No channels picked, so this posts nowhere.");
      break;
    case "send_embed":
      if (!String(step.template_name || "").trim())
        errors.push("No embed template picked.");
      break;
    case "add_role":
    case "remove_role":
    case "toggle_role":
    case "check_role":
      if (!step.role_id) errors.push("No role picked, so this step does nothing.");
      break;
    case "open_ticket":
      if (!String(step.panel_name || "").trim()) errors.push("No ticket panel picked.");
      break;
    case "erlc_command":
      if (!String(step.command || "").trim()) errors.push("No command to run.");
      break;
    case "wait": {
      const seconds = Number(step.seconds);
      if (!Number.isFinite(seconds) || seconds <= 0)
        errors.push("A wait needs a number of seconds.");
      break;
    }
    default:
      break;
  }
  return errors;
}

/** A step that can end the flow early, so the thread after it is a branch. */
export function flowStepBranches(step: FlowStep): boolean {
  return step.type === "check_role" && (step.on_fail || "stop") === "stop";
}

function StepBody({
  step,
  onChange,
  ticketPanels,
  messageTemplates,
  embedTemplates,
  allowApplicant,
}: {
  step: FlowStep;
  onChange: (patch: any) => void;
  ticketPanels: string[];
  messageTemplates: string[];
  embedTemplates: string[];
  allowApplicant: boolean;
}) {
  // Optional — reachable from the automation canvas, which has no provider.
  const meta = useOptionalManage()?.meta ?? null;
  const roles = meta?.roles || [];
  const channels = meta?.channels || [];

  switch (step.type) {
    case "send_message": {
      const target = step.target || "clicker_ephemeral";
      return (
        <div className="space-y-2">
          <SelectField
            value={target}
            options={allowApplicant ? APPLICANT_TARGETS : MESSAGE_TARGETS}
            onChange={(next) =>
              onChange({
                target: next || "clicker_ephemeral",
                ephemeral: (next || "clicker_ephemeral") === "clicker_ephemeral",
              })
            }
          />
          {target === "selected_channels" ? (
            <ChannelPicker
              channels={channels}
              multi
              value={(step.channel_ids || []).map(String)}
              onChange={(next) => onChange({ channel_ids: Array.isArray(next) ? next : [] })}
            />
          ) : null}
          {messageTemplates.length ? (
            <SelectField
              value={step.template_name || null}
              placeholder="Write a message below or use a saved message template"
              options={messageTemplates.map((name) => ({ value: name, label: name }))}
              onChange={(next) => onChange({ template_name: next || "" })}
            />
          ) : null}
          <TextAreaField
            rows={2}
            value={step.content || ""}
            maxLength={2000}
            placeholder="Message content. Variables like {user} work here"
            onChange={(next) => onChange({ content: next })}
          />
        </div>
      );
    }
    case "send_embed": {
      const target = step.target || "clicker_ephemeral";
      return (
        <div className="space-y-2">
          <SelectField
            value={target}
            options={allowApplicant ? APPLICANT_TARGETS : MESSAGE_TARGETS}
            onChange={(next) => onChange({ target: next || "clicker_ephemeral" })}
          />
          {target === "selected_channels" ? (
            <ChannelPicker
              channels={channels}
              multi
              value={(step.channel_ids || []).map(String)}
              onChange={(next) => onChange({ channel_ids: Array.isArray(next) ? next : [] })}
            />
          ) : null}
          <SelectField
            value={step.template_name || null}
            placeholder={embedTemplates.length ? "Select a saved embed template" : "No saved embed templates available"}
            options={embedTemplates.map((name) => ({ value: name, label: name }))}
            onChange={(next) => onChange({ template_name: next || "" })}
          />
        </div>
      );
    }
    case "add_role":
    case "remove_role":
    case "toggle_role":
      return (
        <div className="space-y-2">
          {allowApplicant ? (
            <SelectField
              value={step.subject || "applicant"}
              options={SUBJECT_OPTIONS}
              onChange={(next) => onChange({ subject: next || "applicant" })}
            />
          ) : null}
          <RolePicker
            roles={roles}
            value={step.role_id ? String(step.role_id) : null}
            placeholder="Pick a role"
            onChange={(next) => onChange({ role_id: next || null, subject: allowApplicant ? (step.subject || "applicant") : "clicker" })}
          />
        </div>
      );
    case "check_role":
      return (
        <div className="space-y-2">
          {allowApplicant ? (
            <SelectField
              value={step.subject || "applicant"}
              options={SUBJECT_OPTIONS}
              onChange={(next) => onChange({ subject: next || "applicant" })}
            />
          ) : null}
          <RolePicker
            roles={roles}
            value={step.role_id ? String(step.role_id) : null}
            placeholder="Role the clicker must have"
            onChange={(next) => onChange({ role_id: next || null, subject: allowApplicant ? (step.subject || "applicant") : "clicker" })}
          />
          <SelectField
            value={step.on_fail || "stop"}
            options={[
              { value: "stop", label: "Stop the flow if missing" },
              { value: "continue", label: "Keep going if missing" },
            ]}
            onChange={(next) => onChange({ on_fail: next || "stop" })}
          />
          <TextAreaField
            rows={2}
            value={step.failure_message || ""}
            maxLength={500}
            placeholder="Message shown when the clicker doesn't have the role (optional)"
            onChange={(next) => onChange({ failure_message: next })}
          />
        </div>
      );
    case "wait":
      return (
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={300}
            value={step.seconds ?? 0}
            onChange={(e) => onChange({ seconds: e.target.value === "" ? 0 : Number(e.target.value) })}
            className="w-24 gator-control rounded-xl px-3 py-2 text-sm text-[#f5f2f2] outline-none focus:border-[rgb(var(--accent-rgb)/0.45)]"
          />
          <span className="cool-text text-xs">seconds (max 300)</span>
        </label>
      );
    case "open_ticket":
      return (
        <SelectField
          value={step.panel_name || null}
          placeholder={ticketPanels.length ? "Select a ticket panel" : "No ticket panels available"}
          options={ticketPanels.map((name) => ({ value: name, label: name }))}
          onChange={(next) => onChange({ panel_name: next || null })}
        />
      );
    case "erlc_command":
      return (
        <div className="space-y-2">
          <TextField
            value={step.command || ""}
            maxLength={1000}
            placeholder=":unban {answers.roblox_username}"
            onChange={(next) => onChange({ command: next })}
          />
          <p className="cool-text text-[11px]">
            Answer variables use the question label, for example {"{answers.roblox_username}"}.
          </p>
        </div>
      );
    case "edit_submission_embed":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField value={step.status || ""} maxLength={100} placeholder="Status, e.g. Accepted" onChange={(next) => onChange({ status: next })} />
          <TextField value={step.title || ""} maxLength={256} placeholder="Replacement title (optional)" onChange={(next) => onChange({ title: next })} />
          <div className="sm:col-span-2">
            <TextAreaField rows={2} value={step.description || ""} maxLength={4000} placeholder="Replacement description (optional)" onChange={(next) => onChange({ description: next })} />
          </div>
          <ColorPicker
            value={step.color || "#57f287"}
            label="Choose answer card colour"
            onChange={(next) => onChange({ color: next })}
          />
        </div>
      );
    case "session_information":
      return (
        <SelectField
          value={step.page || "players"}
          options={[
            { value: "players", label: "Players" },
            { value: "staff", label: "Online staff" },
            { value: "queue", label: "Queue" },
            { value: "vehicles", label: "Vehicles" },
          ]}
          onChange={(next) => onChange({ page: next || "players" })}
        />
      );
    case "clear_submission_buttons":
      return <p className="cool-text text-xs">The answer card becomes read-only after this step.</p>;
    default:
      return null;
  }
}

function AddStepMenu({ onAdd, showSubmissionSteps }: { onAdd: (type: string) => void; showSubmissionSteps: boolean }) {
  const availableSteps = STEP_DEFS.filter((def) => showSubmissionSteps || !def.submissionOnly);
  return (
    <PickerPopover
      title="Choose what happens next"
      description="Steps run top to bottom when the button is pressed."
      searchPlaceholder="Search actions…"
      options={availableSteps.map((def) => ({
        value: def.type,
        label: def.label,
        hint: def.hint,
        icon: def.icon,
      }))}
      onPick={onAdd}
      trigger={
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 gator-control rounded-xl px-3 py-2 text-[13px] font-semibold text-white/75 transition-colors hover:border-[rgb(var(--accent-rgb)/0.35)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)]"
        >
          <IconPlus size={14} />
          Add action
        </button>
      }
    />
  );
}

export function ContainerFlowBuilder({
  flow,
  onChange,
  ticketPanels = [],
  messageTemplates = [],
  embedTemplates = [],
  allowApplicant = false,
  showSubmissionSteps = false,
}: {
  flow: FlowStep[];
  onChange: (next: FlowStep[]) => void;
  ticketPanels?: string[];
  messageTemplates?: string[];
  embedTemplates?: string[];
  allowApplicant?: boolean;
  showSubmissionSteps?: boolean;
}) {
  const steps = Array.isArray(flow) ? flow : [];
  // Folded by index: steps have no stable id, and keeping the fold with the
  // position is what someone dragging a step expects.
  const [collapsed, setCollapsed] = React.useState<Set<number>>(() => new Set());
  const toggleStep = (index: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  function patch(index: number, p: any) {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...p } : s)));
  }
  function move(index: number, dir: -1 | 1) {
    const next = [...steps];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function defaults(type: string): FlowStep {
    if (type === "send_message")
      return { type, target: "clicker_ephemeral", ephemeral: true, content: "" };
    if (type === "send_embed")
      return { type, target: "clicker_ephemeral", template_name: "" };
    if (type === "check_role") return { type, subject: allowApplicant ? "applicant" : "clicker", on_fail: "stop" };
    if (["add_role", "remove_role", "toggle_role"].includes(type))
      return { type, subject: allowApplicant ? "applicant" : "clicker" };
    if (type === "wait") return { type, seconds: 3 };
    if (type === "erlc_command") return { type, command: "" };
    if (type === "edit_submission_embed") return { type, status: "", color: "" };
    if (type === "session_information") return { type, page: "players" };
    return { type };
  }

  return (
    <div className="gator-flow w-full">
      {steps.map((step, index) => {
        const meta = stepMeta(step.type);
        const errors = flowStepErrors(step);
        const summary = flowStepSummary(step);
        const open = !collapsed.has(index);
        const previous = steps[index - 1];
        return (
          <div key={index} className="gator-flow-step">
            {/* The thread between steps, drawn before each step that has one
               above it, and collapsed when the step above is folded. After a
               step that can end the flow early it moves left, since what
               follows is conditional. */}
            {previous ? (
              <span
                aria-hidden="true"
                className="gator-flow-thread"
                data-branch={flowStepBranches(previous) ? "true" : undefined}
                data-collapsed={collapsed.has(index - 1) ? "true" : undefined}
              />
            ) : null}
            <div className="editor-block gator-flow-card">
              <div className="gator-flow-head">
                <button
                  type="button"
                  onClick={() => toggleStep(index)}
                  aria-expanded={open}
                  className="gator-flow-trigger"
                >
                  <IconChevronRight
                    size={14}
                    className={`shrink-0 text-white/30 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                  />
                  <span className="gator-flow-icon">{meta?.icon}</span>
                  <span className="gator-flow-name">
                    {meta?.label || step.type}
                    <span className="gator-flow-ordinal">{index + 1}</span>
                  </span>
                  {errors.length ? (
                    <IconAlertTriangle
                      size={14}
                      className="shrink-0 text-[var(--tone-warn)]"
                      aria-label={errors.join(". ")}
                    />
                  ) : null}
                  {/* What this step is configured to do, so a folded flow stays
                     readable. */}
                  {summary ? (
                    <span className="gator-flow-summary">{summary}</span>
                  ) : null}
                </button>
                <div className="gator-row-actions flex shrink-0 items-center">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label="Move step up"
                    onClick={() => move(index, -1)}
                    className="gator-row-action"
                  >
                    <IconArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={index === steps.length - 1}
                    aria-label="Move step down"
                    onClick={() => move(index, 1)}
                    className="gator-row-action"
                  >
                    <IconArrowDown size={16} />
                  </button>
                  {/* Duplicate a step (flows are built from near-identical
                     steps). */}
                  <button
                    type="button"
                    aria-label="Duplicate step"
                    onClick={() =>
                      onChange([
                        ...steps.slice(0, index + 1),
                        JSON.parse(JSON.stringify(step)),
                        ...steps.slice(index + 1),
                      ])
                    }
                    className="gator-row-action"
                  >
                    <IconCopy size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove step"
                    onClick={() => onChange(steps.filter((_, i) => i !== index))}
                    className="gator-row-action gator-row-action-danger"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
              {open ? (
                <div className="gator-flow-body">
                  {errors.length ? (
                    <p className="gator-flow-error">{errors.join(" ")}</p>
                  ) : null}
                  <StepBody
                    step={step}
                    ticketPanels={ticketPanels}
                    messageTemplates={messageTemplates}
                    embedTemplates={embedTemplates}
                    allowApplicant={allowApplicant}
                    onChange={(next) => patch(index, next)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {steps.length === 0 ? (
        <p className="cool-text text-xs">
          This button does nothing yet. Add steps and they run in order when it's clicked.
        </p>
      ) : null}
      <AddStepMenu
        showSubmissionSteps={showSubmissionSteps}
        onAdd={(type) => onChange([...steps, defaults(type)])}
      />
    </div>
  );
}
