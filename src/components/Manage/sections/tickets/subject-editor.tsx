"use client";

import React, { useState } from "react";
import { IconChevronDown, IconMessage } from "@tabler/icons-react";
import {
  ChannelPicker,
  NumberField,
  OptionCard,
  OptionCards,
  RolePicker,
  SelectField,
  TextField,
} from "../../fields";
import { useManage } from "../../manage-context";
import { MessageObjectEditor } from "../../config-message";
import { ConfigCard, FieldIcon } from "../../schema-section";
import { Segments } from "../../segments";
import { EmojiPickerButton } from "../../emoji-picker";
import { FormEditor } from "./form-editor";
import {
  BUTTON_STYLES,
  EditorProps,
  ItemFooter,
  PanelQuestion,
  TICKET_MESSAGE_VARIABLES,
  TicketIcon,
  TicketItem,
  usePanelDraft,
} from "./shared";

/* Editing a ticket subject (one reason a ticket can be opened): setup, access, closing, its form and its messages. */

type SubjectPage = "setup" | "access" | "closing" | "form" | "messages";

/**
 * A ticket subject: routing, roles, closing behaviour and an optional form,
 * split into five short pages in setup order.
 */
export function SubjectEditor({ panel, onMutate, busy, open, onToggle }: EditorProps) {
  const { meta } = useManage();
  const { current, dirty, set, rename } = usePanelDraft(panel, onMutate);
  const [page, setPage] = useState<SubjectPage>("setup");
  const button = (current("Button") || {}) as Record<string, any>;
  const questions: PanelQuestion[] = current("Questions") || [];
  const closing = (current("ClosingBehaviour") || {}) as Record<string, boolean>;
  const roleValue = (field: string) =>
    Array.isArray(current(field)) ? current(field).map(String) : [];
  const ownChannel = Boolean(current("AutoCreateChannel") ?? true);
  const savedQuestions = (panel.Questions || []).length;

  return (
    <TicketItem
      title={panel.name}
      subtitle={
        savedQuestions
          ? `${savedQuestions} question${savedQuestions === 1 ? "" : "s"} on the form`
          : "No form"
      }
      dirty={dirty}
      open={open}
      onToggle={onToggle}
    >
      <Segments<SubjectPage>
        className="gw-tk-pages"
        label={`${panel.name} settings`}
        value={page}
        onChange={setPage}
        options={[
          { value: "setup", label: "Setup" },
          { value: "access", label: "Access" },
          { value: "closing", label: "Closing" },
          { value: "form", label: "Form" },
          { value: "messages", label: "Messages" },
        ]}
      />

      <div className="gw-tk-page-body" key={page}>
        {page === "setup" ? (
          <div className="gw-tk-list">
            <ConfigCard icon={<TicketIcon kind="text" />} title="Name">
              <input
                value={current("rename") ?? panel.name}
                onChange={(event) => rename(event.target.value)}
                maxLength={64}
                placeholder="Support"
                aria-label="Subject name"
                className="gw-field w-full"
              />
            </ConfigCard>
            <ConfigCard
              icon={<TicketIcon kind="channel" />}
              title="Category"
              description="Where ticket channels open."
            >
              <ChannelPicker
                channels={meta?.channels || []}
                types={["category"]}
                placeholder="Select a category"
                value={current("Category") != null ? String(current("Category")) : null}
                onChange={(next) => set("Category", next)}
              />
            </ConfigCard>
            <ConfigCard
              icon={<TicketIcon kind="channel" />}
              title="Transcripts"
              description="Where closed tickets are logged."
            >
              <ChannelPicker
                channels={meta?.channels || []}
                value={
                  current("TranscriptChannel") != null
                    ? String(current("TranscriptChannel"))
                    : null
                }
                onChange={(next) => set("TranscriptChannel", next)}
              />
            </ConfigCard>
            <ConfigCard icon={<TicketIcon kind="role" />} title="Ping on open">
              <RolePicker
                roles={meta?.roles || []}
                multi
                value={roleValue("MentionsOnOpen")}
                onChange={(next) => set("MentionsOnOpen", next)}
              />
            </ConfigCard>
            <ConfigCard
              icon={<FieldIcon type="number" />}
              title="Cooldown"
              description="Before the same member can open another."
              trailing={
                <div className="gw-tk-minutes">
                  <NumberField
                    value={
                      current("OpenCooldownMinutes") != null &&
                      current("OpenCooldownMinutes") !== ""
                        ? Number(current("OpenCooldownMinutes"))
                        : ""
                    }
                    min={0}
                    onChange={(next) => set("OpenCooldownMinutes", next === "" ? null : next)}
                  />
                  <span className="gw-tk-unit">min</span>
                </div>
              }
            />
            {/* Only asked for when there is a channel to name. */}
            {ownChannel ? (
              <ConfigCard
                icon={<TicketIcon kind="text" />}
                title="Channel name"
                description="{user}, {user.id} and {ticketid} fill in."
              >
                <TextField
                  value={current("ChannelNameFormat") || ""}
                  placeholder="ticket-{user}"
                  maxLength={90}
                  onChange={(next) => set("ChannelNameFormat", next || null)}
                />
              </ConfigCard>
            ) : null}
          </div>
        ) : null}
        {page === "setup" ? (
          <div className="gw-tk-options">
            <OptionCards>
              <OptionCard
                label="A private channel per ticket"
                description="Off, and tickets run in a thread instead."
                checked={ownChannel}
                onChange={(next) => set("AutoCreateChannel", next)}
              />
              <OptionCard
                label="AI replies first"
                description="It hands over to staff when it can't help."
                checked={Boolean(current("AIEnabled") ?? true)}
                onChange={(next) => set("AIEnabled", next)}
              />
            </OptionCards>
          </div>
        ) : null}

        {page === "access" ? (
          <div className="gw-tk-list">
            <ConfigCard icon={<TicketIcon kind="role" />} title="Can read">
              <RolePicker
                roles={meta?.roles || []}
                multi
                value={roleValue("ReadRoles")}
                onChange={(next) => set("ReadRoles", next)}
              />
            </ConfigCard>
            <ConfigCard
              icon={<TicketIcon kind="role" />}
              title="Can reply"
              description="Answer and claim."
            >
              <RolePicker
                roles={meta?.roles || []}
                multi
                // Subjects authored via /config store editor roles under
                // `permissions`; fall back to it so those roles show here.
                value={
                  roleValue("WriteRoles").length
                    ? roleValue("WriteRoles")
                    : roleValue("permissions")
                }
                onChange={(next) => {
                  // Mirror into `permissions` so claim/access checks keep working.
                  set("WriteRoles", next);
                  set("permissions", next);
                }}
              />
            </ConfigCard>
            <ConfigCard
              icon={<TicketIcon kind="role" />}
              title="Needed to open"
              description="Members need one of these."
            >
              <RolePicker
                roles={meta?.roles || []}
                multi
                value={roleValue("RequiredRoles")}
                onChange={(next) => set("RequiredRoles", next)}
              />
            </ConfigCard>
            <ConfigCard
              icon={<TicketIcon kind="role" />}
              title="Blocked"
              description="Members with these can't open one."
            >
              <RolePicker
                roles={meta?.roles || []}
                multi
                value={roleValue("BlockedRoles")}
                onChange={(next) => set("BlockedRoles", next)}
              />
            </ConfigCard>
          </div>
        ) : null}
        {page === "access" ? (
          <div className="gw-tk-options">
            <OptionCards>
              <OptionCard
                label="Verified members only"
                checked={Boolean(button.verification_required)}
                onChange={(next) => set("Button", { ...button, verification_required: next })}
              />
              <OptionCard
                label="No partnership requests"
                checked={Boolean(current("BlockPartnerships") ?? false)}
                onChange={(next) => set("BlockPartnerships", next)}
              />
            </OptionCards>
          </div>
        ) : null}

        {page === "closing" ? (
          <OptionCards>
            {(
              [
                ["require_confirmation", "Confirm before closing"],
                ["allow_opener_close", "The member can close it"],
                ["close_on_leave", "Close if the member leaves"],
                ["ask_feedback", "Ask for feedback"],
              ] as const
            ).map(([key, label]) => (
              <OptionCard
                key={key}
                label={label}
                checked={Boolean(closing[key])}
                onChange={(next) => set("ClosingBehaviour", { ...closing, [key]: next })}
              />
            ))}
            <OptionCard
              label="Let members rate it"
              checked={Boolean(current("AllowReviews") ?? false)}
              onChange={(next) => set("AllowReviews", next)}
            />
          </OptionCards>
        ) : null}

        {page === "form" ? (
          <FormEditor
            questions={questions}
            formTitle={current("FormTitle") || ""}
            set={set}
          />
        ) : null}

        {page === "messages" ? (
          <div className="space-y-4">
            <div className="gw-tk-sub">
              <p className="gw-tk-sub-name">The button on the panel</p>
              <div className="gw-tk-list">
                <ConfigCard icon={<TicketIcon kind="text" />} title="Label">
                  <TextField
                    value={button.label ?? "Open Ticket"}
                    maxLength={80}
                    placeholder="Open Ticket"
                    onChange={(next) => set("Button", { ...button, label: next })}
                  />
                </ConfigCard>
                <ConfigCard icon={<FieldIcon type="select" />} title="Colour">
                  <SelectField
                    value={button.style || "Grey"}
                    options={BUTTON_STYLES}
                    onChange={(next) => set("Button", { ...button, style: next || "Grey" })}
                  />
                </ConfigCard>
                <ConfigCard
                  icon={<FieldIcon type="emoji" />}
                  title="Emoji"
                  trailing={
                    <EmojiPickerButton
                      value={button.emoji || undefined}
                      onChange={(next) => set("Button", { ...button, emoji: next || "" })}
                    />
                  }
                />
                {/* The line members read under this subject's name in a panel's
                   dropdown. */}
                <ConfigCard
                  icon={<TicketIcon kind="text" />}
                  title="Dropdown description"
                  description="Under the name, when a panel is a dropdown."
                >
                  <div className="gw-counted">
                    <input
                      value={current("description") ?? panel.description ?? ""}
                      onChange={(event) => set("description", event.target.value)}
                      maxLength={100}
                      placeholder="Questions, partnerships, small things"
                      aria-label="Dropdown description"
                      className="gw-field w-full"
                    />
                    <span className="gw-counted-n" aria-hidden="true">
                      {String(current("description") ?? panel.description ?? "").length}/100
                    </span>
                  </div>
                </ConfigCard>
              </div>
            </div>

            {(
              [
                ["Welcome Message", "When it opens"],
                ["Close Request", "When someone asks to close it"],
              ] as const
            ).map(([messageField, hint]) => (
              <MessageRoll key={messageField} name={messageField} hint={hint}>
                <MessageObjectEditor
                  module="Tickets"
                  value={current(messageField) || {}}
                  onChange={(next) => set(messageField, next)}
                  variables={TICKET_MESSAGE_VARIABLES}
                  systemButtons={
                    messageField === "Close Request"
                      ? [{ label: "Confirm close" }]
                      : [{ label: "Close" }, { label: "Claim" }]
                  }
                />
              </MessageRoll>
            ))}
          </div>
        ) : null}
      </div>

      <ItemFooter
        busy={busy}
        dirty={dirty}
        panelName={panel.name}
        panelType={panel.type === "multi" ? "multi" : "single"}
        canSend={false}
        deleteLabel="Delete subject"
        onDelete={() =>
          onMutate({ action: "delete", type: panel.type || "single", name: panel.name })
        }
      />
    </TicketItem>
  );
}

/* A message editor that opens in place on the standard roll (a `<details>`
   cannot animate). Mounted the first time it opens and kept. */
function MessageRoll({
  name,
  hint,
  children,
}: {
  name: string;
  hint: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  return (
    <div className="gw-tk-message" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="gw-tk-message-head"
        aria-expanded={open}
        onClick={() => {
          setOpened(true);
          setOpen((current) => !current);
        }}
      >
        <IconMessage size={17} className="gw-tk-message-mark" />
        <span className="gw-tk-message-copy">
          <span className="gw-tk-message-name">{name}</span>
          <span className="gw-tk-message-say">{hint}</span>
        </span>
        <IconChevronDown size={16} className="gw-tk-message-chev" />
      </button>
      <div className="gw-set-roll" data-open={open ? "true" : "false"}>
        <div className="gw-set-roll-clip" inert={!open}>
          {opened ? <div className="gw-tk-message-body">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
