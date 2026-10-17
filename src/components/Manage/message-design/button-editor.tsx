"use client";

import React, { useState } from "react";
import {
  IconBolt,
  IconCheck,
  IconChevronDown,
  IconClipboardText,
  IconExternalLink,
  IconForms,
  IconGift,
  IconGripVertical,
  IconPlus,
  IconTicket,
  IconTrash,
} from "@tabler/icons-react";
import { EmojiPickerButton } from "../emoji-picker";
import { OptionCard, OptionCards, Reveal, RolePicker, SelectField, TextField } from "../fields";
import { useOptionalManage } from "../manage-context";
import { ContainerFlowBuilder } from "../container-flow-builder";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PresenceList } from "@/components/motion";
import { ButtonColorSwatches, ButtonTargets, useButtonTargets } from "./button-controls";
import { InlineFormBuilder } from "./form-builder";
import { CONTAINER_LIMITS, ContainerRowButton } from "./model";
import { PreviewButton } from "./preview";

/* Editing one button (its type, label, colour and target) and the legacy rows of buttons. */

/** Every button behaviour the bot's container builder supports — labels and
 *  order mirror the bot's own button-type menu. */
/**
 * What each button type is and does, with an icon and one line, so the choice
 * can be made from the menu.
 */
const ROW_BUTTON_TYPES: {
  value: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "link",
    label: "Link",
    hint: "Opens a link.",
    icon: <IconExternalLink size={15} />,
  },
  // The ordinary Discord button.
  {
    value: "button",
    label: "Button",
    hint: "The ordinary button. Runs the steps you build: reply, give a role, post a message.",
    icon: <IconBolt size={15} />,
  },
  {
    value: "ticket",
    label: "Ticket",
    hint: "Opens a ticket on one of your panels.",
    icon: <IconTicket size={15} />,
  },
  {
    value: "form",
    label: "Form",
    hint: "Pops a modal and posts the answers where you choose.",
    icon: <IconForms size={15} />,
  },
  {
    value: "application",
    label: "Application",
    hint: "Starts an application from your applications list.",
    icon: <IconClipboardText size={15} />,
  },
  {
    value: "package",
    label: "Package",
    hint: "Sells a Roblox item and delivers the reward on purchase.",
    icon: <IconGift size={15} />,
  },
];

const PACKAGE_REWARD_TYPES = [
  { value: "package", label: "Send saved package in DMs" },
  { value: "roles", label: "Give Discord roles" },
];

/** The button's type, as a menu that says what each type does. Same shape as
 *  `AddBlockMenu`, for the same reason: the names alone do not carry it. */
function ButtonTypeMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = ROW_BUTTON_TYPES.find((option) => option.value === (value || "link"));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="gator-control inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold text-white/80 transition-colors hover:border-[rgb(var(--accent-rgb)/0.35)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)]"
        >
          <span className="text-white/45">{current?.icon}</span>
          {current?.label || "Link"}
          <IconChevronDown size={12} className="text-white/35" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="z-[220] max-h-[min(28rem,calc(100vh-1.5rem))] w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.08] bg-[#131415] p-2 text-white shadow-[0_24px_70px_rgba(0,0,0,0.72)]"
      >
        <div className="grid grid-cols-1 gap-1">
          {ROW_BUTTON_TYPES.map((option) => {
            const selected = option.value === (value || "link");
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--gator-accent)] ${
                  selected ? "bg-[rgb(var(--accent-rgb)/0.12)]" : "hover:bg-white/[0.06]"
                }`}
              >
                <span className={selected ? "text-[var(--accent-peach)]" : "text-white/45"}>
                  {option.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-white/85">
                    {option.label}
                  </span>
                  <span className="cool-text block text-[11px]">{option.hint}</span>
                </span>
                {selected ? (
                  <IconCheck size={14} className="shrink-0 text-[var(--accent-peach)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * One button's fields, headed by the live `PreviewButton` (the component the
 * message preview uses), so label, emoji, colour and the disabled state show as
 * they will in Discord while typing.
 */
export function RowButtonEditor({
  button,
  onChange,
  onRemove,
  targets,
}: {
  button: ContainerRowButton;
  onChange: (next: ContainerRowButton) => void;
  onRemove: () => void;
  targets?: ButtonTargets;
}) {
  const { meta } = useOptionalManage() ?? { meta: null };
  const patchButton = (patch: Partial<ContainerRowButton>) => onChange({ ...button, ...patch });
  return (
    <div className="editor-block p-3">
      {/* Drawn by the same component as the message preview, so the two cannot
         disagree. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 gw-dc-strip">
        <PreviewButton button={button} />
        <div className="flex shrink-0 items-center gap-2">
          <OptionCard
            compact
            label="Enabled"
            checked={!Boolean(button.disabled)}
            onChange={(enabled) => patchButton({ disabled: !enabled })}
          />
          <button
            type="button"
            onClick={onRemove}
            className="px-1 text-white/35 transition-colors hover:text-[var(--tone-bad)]"
            aria-label="Remove button"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Every container supports every button type, matching the bot's
            editor. */}
        <ButtonTypeMenu
          value={button.type || "link"}
          onChange={(next) => patchButton({ type: next })}
        />
        <div className="min-w-[120px] flex-1">
          <TextField
            value={button.label}
            maxLength={80}
            placeholder="Label"
            onChange={(next) => patchButton({ label: next })}
          />
        </div>
        <EmojiPickerButton
          value={button.emoji}
          onChange={(next) => patchButton({ emoji: next })}
        />
        {/* Discord draws link buttons grey only, so no colour choice for them. */}
        {button.type !== "link" ? (
          <ButtonColorSwatches
            value={button.color || "Grey"}
            onChange={(next) => patchButton({ color: next })}
          />
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {button.type === "link" || !button.type ? (
          <div className="min-w-[200px] flex-1">
            <TextField
              value={button.url || ""}
              placeholder="https://…"
              onChange={(next) => patchButton({ url: next })}
            />
          </div>
        ) : null}
        {button.type === "button" ? (
          <div className="w-full">
            <p className="gw-caption mb-2">
              What it does
            </p>
            <ContainerFlowBuilder
              flow={Array.isArray(button.flow) ? button.flow : []}
              ticketPanels={targets?.panels || []}
              messageTemplates={targets?.messages || []}
              embedTemplates={targets?.embeds || []}
              onChange={(next) => patchButton({ flow: next })}
            />
          </div>
        ) : null}
        {button.type === "package" ? (
          <div className="w-full space-y-2">
            <TextField
              value={button.purchase_url || ""}
              placeholder="Roblox item / game-pass link (https://www.roblox.com/…)"
              onChange={(next) => patchButton({ purchase_url: next })}
            />
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-[140px] flex-1">
                <TextField
                  value={button.purchase_label || ""}
                  placeholder="Purchase button label"
                  onChange={(next) => patchButton({ purchase_label: next })}
                />
              </div>
              <div className="w-56 shrink-0">
                <SelectField
                  value={button.reward_type || "package"}
                  options={PACKAGE_REWARD_TYPES}
                  onChange={(next) => patchButton({ reward_type: next || "package" })}
                />
              </div>
            </div>
            {button.reward_type === "roles" ? (
              <div className="min-w-[180px]">
                <RolePicker
                  roles={meta?.roles || []}
                  multi
                  placeholder="Roles to grant on purchase"
                  value={(button.role_ids || []).map(String)}
                  onChange={(next) =>
                    patchButton({ role_ids: Array.isArray(next) ? next : [] })
                  }
                />
              </div>
            ) : null}
            <p className="text-[11px] text-white/50">
              Renders a single self-serve{" "}
              <span className="text-white/60">Purchase Here</span> button. Clicking it
              verifies the Roblox purchase and delivers the reward automatically (no
              separate Claim button).
            </p>
          </div>
        ) : null}
        {button.type === "form" || button.type === "forum" ? (
          <InlineFormBuilder
            button={button}
            targets={targets || { forms: [], messages: [], embeds: [], panels: [], ticketPanels: [], applications: [] }}
            onChange={onChange}
          />
        ) : null}
        {button.type === "ticket" ? (
          <TicketButtonFields
            button={button}
            panels={targets?.ticketPanels || []}
            patch={patchButton}
          />
        ) : null}
        {button.type === "application" ? (
          <div className="min-w-[200px] flex-1">
            <SelectField
              value={button.application_id || null}
              placeholder={targets?.applications.length ? "Pick an application" : "No applications available"}
              options={(targets?.applications || []).map((app) => ({ value: app.id, label: app.name }))}
              onChange={(next) => patchButton({ application_id: next || "" })}
            />
          </div>
        ) : null}
        {["button", "form", "forum", "ticket", "application"].includes(button.type) ? (
          <div className="gw-tk-fields">
            <p className="gw-caption">Before it opens</p>
            <OptionCards>
              <OptionCard
                compact
                label="Require verification"
                checked={Boolean(button.verification_required)}
                onChange={(checked) => patchButton({ verification_required: checked })}
              />
              {button.type === "ticket" ? (
                <OptionCard
                  compact
                  label="Rules acknowledgement"
                  checked={Boolean(button.require_acknowledgement)}
                  onChange={(checked) => patchButton({ require_acknowledgement: checked })}
                />
              ) : null}
            </OptionCards>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Classic message buttons grouped by their saved action-row number. Existing
 * messages can use all five rows; keeping the rows visible stops an edit from
 * flattening them.
 */
export function LegacyButtonRowsEditor({
  components,
  onChange,
}: {
  components: ContainerRowButton[];
  onChange: (next: ContainerRowButton[]) => void;
}) {
  const targets = useButtonTargets();
  const normalized = (Array.isArray(components) ? components : []).map(
    (button, index) => {
      const parsed = button?.row == null ? Number.NaN : Number(button.row);
      const row = Number.isInteger(parsed) && parsed >= 0 && parsed <= 4
        ? parsed
        : Math.min(4, Math.floor(index / 5));
      return { ...button, row };
    },
  );
  const usedRows = Array.from(
    new Set(normalized.map((button) => Number(button.row) || 0)),
  ).sort((left, right) => left - right);
  const nextRow = [0, 1, 2, 3, 4].find((row) => !usedRows.includes(row));

  function commitRow(row: number, buttons: ContainerRowButton[]) {
    const otherRows = normalized.filter((button) => button.row !== row);
    const next = [
      ...otherRows,
      ...buttons.map((button, index) => ({ ...button, row, ix: index })),
    ].sort((left, right) =>
      (Number(left.row) || 0) - (Number(right.row) || 0)
      || (Number(left.ix) || 0) - (Number(right.ix) || 0),
    );
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {usedRows.map((row) => {
        const buttons = normalized.filter((button) => button.row === row);
        return (
          <div
            key={row}
            className="editor-block p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="gw-caption inline-flex items-center gap-2">
                <IconGripVertical size={16} /> Row {row + 1}
                <span className="font-medium normal-case tracking-normal text-white/25">
                  {buttons.length}/{CONTAINER_LIMITS.rowWidth} buttons
                </span>
              </span>
              <div className="flex items-center gap-2">
                {buttons.length < CONTAINER_LIMITS.rowWidth ? (
                  <button
                    type="button"
                    onClick={() =>
                      commitRow(row, [
                        ...buttons,
                        { type: "link", label: "", url: "", row },
                      ])
                    }
                    className="gw-btn"
                  >
                    <IconPlus size={11} /> Button
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => commitRow(row, [])}
                  className="rounded-xl p-2 text-white/25 hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
                  aria-label={`Remove row ${row + 1}`}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            </div>
            <PresenceList
              items={buttons}
              className="space-y-2"
              render={(button, index) => (
                <RowButtonEditor
                  button={button}
                  targets={targets}
                  onChange={(nextButton) => {
                    const next = [...buttons];
                    next[index] = { ...nextButton, row };
                    commitRow(row, next);
                  }}
                  onRemove={() =>
                    commitRow(
                      row,
                      buttons.filter((_, buttonIndex) => buttonIndex !== index),
                    )
                  }
                />
              )}
            />
          </div>
        );
      })}
      {nextRow !== undefined ? (
        <button
          type="button"
          onClick={() =>
            commitRow(nextRow, [
              { type: "link", label: "", url: "", row: nextRow },
            ])
          }
          className="gw-btn"
        >
          <IconPlus size={12} /> Add button row
        </button>
      ) : null}
      {!normalized.length ? (
        <p className="cool-text text-xs">
          No button rows. Add one without changing the message above it.
        </p>
      ) : null}
    </div>
  );
}

const questionLabel = (question: any) => String(question?.label || question?.question || "Question");

/** What a ticket button opens: the subjects it offers, and which of their
 *  questions the modal asks. The questions roll open once a subject is chosen,
 *  and each one arrives and leaves as subjects are added and removed. */
function TicketButtonFields({
  button,
  panels,
  patch,
}: {
  button: ContainerRowButton;
  panels: Record<string, any>[];
  patch: (next: Partial<ContainerRowButton>) => void;
}) {
  const chosen = button.ticket_panels || [];
  const asked = button.ticket_questions || [];
  const questions = panels
    .filter((panel) => chosen.includes(String(panel.name || "")))
    .flatMap((panel) => panel.Questions || [])
    .filter((question, index, all) => all.findIndex((item) => questionLabel(item) === questionLabel(question)) === index)
    .slice(0, 4);
  return (
    <div className="gw-tk-fields">
      <p className="gw-caption">Ticket subjects</p>
      <OptionCards>
        {panels.map((panel) => {
          const name = String(panel.name || "");
          const on = chosen.includes(name);
          return (
            <OptionCard
              key={name}
              compact
              label={name}
              checked={on}
              onChange={(next) =>
                patch({
                  multi_panel: null,
                  ticket_panels: next ? [...chosen, name] : chosen.filter((item) => item !== name),
                })
              }
            />
          );
        })}
      </OptionCards>
      <Reveal when={questions.length > 0}>
        <p className="gw-caption">Questions in the modal</p>
        <PresenceList
          items={questions}
          keys={questions.map(questionLabel)}
          className="gw-opts"
          render={(question) => {
            const label = questionLabel(question);
            const on = asked.some((item: any) => questionLabel(item) === label);
            return (
              <OptionCard
                compact
                label={label}
                checked={on}
                onChange={(next) =>
                  patch({
                    ticket_questions: next
                      ? [...asked, question]
                      : asked.filter((item: any) => questionLabel(item) !== label),
                  })
                }
              />
            );
          }}
        />
      </Reveal>
    </div>
  );
}
