"use client";

import React, { useEffect, useState } from "react";
import { IconChevronDown, IconPlus, IconSend, IconTrash } from "@tabler/icons-react";
import { useManage, configValuesEqual } from "../../manage-context";
import { SendPanelModal } from "../../send-panel-modal";
import { variablesForGroups } from "@/config/variable-registry";
import { FieldIcon } from "../../schema-section";
import type { TicketPanel } from "../../types";

/* Pieces the ticket editors share: message variables, the panel draft, and the list rows with their footers. */

/** Small tinted icon for the Tickets config cards. */
export function TicketIcon({ kind }: { kind: "channel" | "role" | "text" }) {
  /* The bare glyph for the field type, as on the schema tabs. */
  return <FieldIcon type={kind === "text" ? "text" : kind} />;
}

// "As many as there are options." Discord caps a select at 25, and both the
// dashboard API and the modal builder clamp `max_values` to the number of
// options, so storing the ceiling keeps meaning "all of them" as options
// change.
export const MULTI_PICK = 25;

export const BUTTON_STYLES = [
  { value: "Grey", label: "Grey" },
  { value: "Blurple", label: "Blurple" },
  { value: "Green", label: "Green" },
  { value: "Red", label: "Red" },
];

/** Every variable the bot substitutes in ticket welcome/close messages,
 *  including the linked Roblox account set. */
export const TICKET_MESSAGE_VARIABLES = [
  "{author.mention}",
  "{author.name}",
  "{author.display_name}",
  "{author.id}",
  "{author.avatar}",
  "{author.created_at.relative}",
  "{author.created_at.absolute}",
  "{author.joined_at.relative}",
  "{author.joined_at.absolute}",
  "{ticket.id}",
  "{reason}",
  "{guild.name}",
  "{guild.id}",
  "{time.relative}",
  "{time.absolute}",
  "{roblox_user}",
  "{roblox_display_name}",
  "{roblox_user_id}",
  "{roblox_profile_url}",
  "{roblox_avatar_url}",
  "{roblox_account_age}",
  "{roblox_created_relative}",
  // Rich guild / channel / member / time placeholders (bot: global_message_vars).
  "{guild.members}",
  "{guild.icon}",
  "{guild.banner}",
  "{guild.created}",
  "{guild.description}",
  "{guild.boost.tier}",
  "{guild.boost.count}",
  "{guild.roles}",
  "{guild.channels}",
  "{guild.emojis}",
  "{guild.vanity}",
  "{channel.topic}",
  "{channel.category}",
  "{channel.jump}",
  "{channel.nsfw}",
  "{channel.slowmode}",
  "{channel.created}",
  "{author.display}",
  "{author.tag}",
  "{author.created}",
  "{author.joined}",
  "{author.top_role}",
  "{author.roles}",
  "{author.color}",
  "{author.boosting}",
  "{date}",
  "{year}",
  "{timestamp.short_time}",
  "{timestamp.long_time}",
  "{timestamp.short_date}",
  "{timestamp.long_date}",
  "{timestamp.short_datetime}",
  "{timestamp.long_datetime}",
  "{timestamp.relative}",
  "{newline}",
  "{blank}",
];

// The panel message renders before a ticket exists, so only global + Roblox
// variables resolve — derived from the registry so the full set is offered.
export const PANEL_VARIABLES = variablesForGroups();

/** One field in the pre-open ticket form. `kind` picks which Discord modal
 *  component it becomes; the rest are that component's settings. */
export interface PanelQuestion {
  label: string;
  kind?: "text" | "select" | "checkbox" | "display";
  /** Helper line under the label (Discord's Label description). */
  description?: string | null;
  placeholder?: string | null;
  min?: number | null;
  max?: number | null;
  required?: boolean;
  /** Text questions only: one line or a multi-line box. */
  style?: "short" | "paragraph";
  /** Dropdown choices. */
  options?: { label: string; value?: string; description?: string }[];
  min_values?: number | null;
  max_values?: number | null;
  /** Checkbox starts ticked. */
  default?: boolean;
  /** Text block content. */
  content?: string | null;
}

export interface EditorProps {
  panel: TicketPanel;
  onMutate: (
    body: Record<string, unknown>,
    options?: { quiet?: boolean },
  ) => Promise<boolean>;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
}

/** What a subject shows for a field it has never had saved. */
const TICKET_DEFAULTS: Record<string, unknown> = {
  AutoCreateChannel: true,
  AIEnabled: true,
  AllowReviews: false,
  BlockPartnerships: false,
  DisplayMode: "buttons",
};

/** Fields that are lists of roles, where order means nothing. */
const TICKET_ROLE_LISTS = new Set([
  "ReadRoles",
  "WriteRoles",
  "permissions",
  "RequiredRoles",
  "BlockedRoles",
  "MentionsOnOpen",
]);

/**
 * Whether a staged field matches the saved panel. Field-by-field
 * `configValuesEqual` is not enough here: the name is staged under `rename`;
 * some toggles and the button label have defaults when unset; and role lists
 * are unordered. Without this, undoing your own edit could leave the save
 * prompt up.
 */
function sameTicketField(field: string, staged: any, panel: TicketPanel): boolean {
  if (field === "rename") return String(staged ?? "").trim() === panel.name;
  const saved = (panel as Record<string, any>)[field];
  if (field === "Button") {
    const withDefaults = (button: any) => ({
      label: "Open Ticket",
      style: "Grey",
      ...(button || {}),
    });
    return configValuesEqual(withDefaults(staged), withDefaults(saved));
  }
  if (TICKET_ROLE_LISTS.has(field)) {
    const ids = (list: any) =>
      (Array.isArray(list) ? list : []).map(String).sort().join(",");
    return ids(staged) === ids(saved);
  }
  if ((saved === undefined || saved === null) && field in TICKET_DEFAULTS) {
    const fallback = TICKET_DEFAULTS[field];
    if (typeof fallback === "boolean") return Boolean(staged ?? fallback) === fallback;
    return configValuesEqual(staged ?? fallback, fallback);
  }
  return configValuesEqual(staged, saved);
}

/**
 * The draft for one subject or panel, registered as an external draft in the
 * page's save prompt: Save and Discard there apply to it, and leaving the tab
 * with it unsaved is caught like any other edit.
 */
export function usePanelDraft(panel: TicketPanel, onMutate: EditorProps["onMutate"]) {
  const { registerExternalDraft, setExternalDraftDirty } = useManage();
  const [draft, setDraft] = useState<Record<string, any>>({});
  const current = (field: string) =>
    field in draft ? draft[field] : (panel as Record<string, any>)[field];
  // Only fields that differ are ever in the draft, so this is its size.
  const dirty = Object.keys(draft).length > 0;
  function set(field: string, value: any) {
    setDraft((previous) => {
      const next = { ...previous };
      if (sameTicketField(field, value, panel)) delete next[field];
      else next[field] = value;
      return next;
    });
  }
  // The name is part of the key rather than a field on the record, so it is
  // staged and sent like any other edit but handled separately on the way in.
  function rename(next: string) {
    set("rename", next);
  }

  const key = `ticket:${panel.type || "single"}:${panel.name}`;
  const saveRef = React.useRef<() => Promise<boolean>>(async () => true);
  saveRef.current = async () => {
    if (!Object.keys(draft).length) return true;
    const ok = await onMutate(
      {
        action: "update",
        type: panel.type || "single",
        name: panel.name,
        set: draft,
      },
      { quiet: true },
    );
    if (ok) setDraft({});
    return ok;
  };
  useEffect(
    () =>
      registerExternalDraft(key, {
        save: () => saveRef.current(),
        discard: () => setDraft({}),
        label: "a ticket panel",
      }),
    [key, registerExternalDraft],
  );
  useEffect(() => {
    setExternalDraftDirty(key, dirty);
  }, [dirty, key, setExternalDraftDirty]);

  return { draft, current, dirty, set, rename };
}

/* One subject or panel: a row in its group that opens in place on the standard
   roll. The editor mounts the first time it opens and stays mounted, so closing
   can animate. */
export function TicketItem({
  title,
  subtitle,
  dirty,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  dirty: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState(open);
  useEffect(() => {
    if (open) setOpened(true);
  }, [open]);
  return (
    <div className="gw-tk-item" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="gw-tk-item-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="gw-tk-item-copy">
          <span className="gw-tk-item-name">{title}</span>
          <span className="gw-tk-item-say">{subtitle}</span>
        </span>
        {dirty ? <span className="gw-tk-unsaved">Unsaved</span> : null}
        <IconChevronDown className="gw-tk-item-chev" size={15} stroke={2.2} />
      </button>
      <div className="gw-set-roll" data-open={open ? "true" : "false"}>
        <div className="gw-set-roll-clip" inert={!open}>
          {opened || open ? <div className="gw-tk-item-body">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* A group on this tab, in the standard container: name and one line in the
   first row, the group's action at its right end, contents below. */
export function TicketGroup({
  title,
  say,
  count,
  action,
  children,
}: {
  title: string;
  say?: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="gw-set gw-tk">
      <div className="gw-set-panel">
        <div className="gw-set-head" data-static="true">
          <span className="gw-set-head-copy">
            <span className="gw-set-head-name">
              {title}
              {count ? <span className="gw-tk-count">{count}</span> : null}
            </span>
            {say ? <span className="gw-set-head-say">{say}</span> : null}
          </span>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

/* The add button in a group's header. The plus turns into a cross while the
   form it opened is showing, so the same button closes it. */
export function AddButton({
  open,
  onClick,
  children,
}: {
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="gw-tk-add"
      data-open={open ? "true" : undefined}
      aria-expanded={open}
      onClick={onClick}
    >
      <IconPlus className="gw-tk-add-plus" size={14} stroke={2.4} aria-hidden="true" />
      <span>{open ? "Cancel" : children}</span>
    </button>
  );
}

/* The last line of an open subject or panel: actions on it (not settings).
   Saving is the page's save prompt. */
export function ItemFooter({
  busy,
  dirty,
  onDelete,
  deleteLabel,
  canSend = true,
  panelName,
  panelType,
}: {
  busy: boolean;
  dirty: boolean;
  onDelete: () => void;
  deleteLabel: string;
  panelName: string;
  panelType?: "single" | "multi";
  /**
   * Subjects are not sendable: a subject is one reason a ticket can be opened;
   * a panel is what gets posted.
   */
  canSend?: boolean;
}) {
  // Sending is an action, so it sits next to Delete; a panel can be sent again
  // or to another channel without editing.
  const [sendOpen, setSendOpen] = React.useState(false);
  return (
    <div className="gw-tk-foot">
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="gw-tk-ghost"
        data-tone="bad"
      >
        <IconTrash size={14} />
        {deleteLabel}
      </button>
      {canSend ? (
        <button
          type="button"
          disabled={busy || dirty}
          title={dirty ? "Save your changes before sending" : "Post this panel to a channel"}
          onClick={() => setSendOpen(true)}
          className="gw-tk-ghost"
          data-tone="accent"
        >
          <IconSend size={14} />
          {dirty ? "Save to send" : "Send panel"}
        </button>
      ) : null}
      <SendPanelModal
        open={sendOpen}
        panelName={panelName}
        panelType={panelType || "single"}
        onClose={() => setSendOpen(false)}
      />
    </div>
  );
}
