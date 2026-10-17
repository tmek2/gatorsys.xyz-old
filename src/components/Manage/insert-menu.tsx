"use client";

import React, { useMemo, useState } from "react";
import { IconAt, IconCheck, IconHash, IconKeyboard, IconSearch } from "@tabler/icons-react";
import { PortalMenu, usePopover } from "./fields";
import { Segments } from "./segments";
import { insertVariable } from "./embed-editor";
import { EmojiGrid } from "./emoji-picker";
import { useOptionalManage } from "./manage-context";

/**
 * Discohook-style insert helper: a popup with Mentions, Time and Emojis tabs
 * that drops the chosen token into the text field focused last.
 */

const TIME_STYLES = [
  { value: "t", label: "Short time (9:41 PM)" },
  { value: "T", label: "Long time (9:41:30 PM)" },
  { value: "d", label: "Short date (06/09/2026)" },
  { value: "D", label: "Long date (June 9, 2026)" },
  { value: "f", label: "Date and time" },
  { value: "F", label: "Weekday, date and time" },
  { value: "R", label: "Relative (in 2 hours)" },
];

function MentionsTab({ onInsert }: { onInsert: (token: string) => void }) {
  // Optional — the automation editor mounts this outside `ManageProvider`.
  const meta = useOptionalManage()?.meta ?? null;
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();

  const channels = useMemo(
    () =>
      (meta?.channels || [])
        .filter((channel) => channel.type !== "category")
        .filter((channel) => !term || channel.name.toLowerCase().includes(term))
        .slice(0, 12),
    [meta, term]
  );
  const roles = useMemo(
    () =>
      (meta?.roles || [])
        .filter((role) => !term || role.name.toLowerCase().includes(term))
        .slice(0, 12),
    [meta, term]
  );
  const specials = ["@everyone", "@here"].filter(
    (name) => !term || name.includes(term)
  );

  return (
    <div className="gw-ins-pane">
      <label className="gw-ins-find">
        <IconSearch size={15} aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a channel or role"
          aria-label="Find a channel or role"
          data-bare
        />
      </label>
      <div className="gw-ins-list">
        {channels.length > 0 ? <p className="gw-ins-group">Channels</p> : null}
        {channels.map((channel) => (
          <button key={channel.id} type="button" onClick={() => onInsert(`<#${channel.id}>`)} className="gw-ins-row">
            <IconHash size={15} className="gw-ins-glyph" aria-hidden="true" />
            <span className="gw-ins-name">{channel.name}</span>
          </button>
        ))}
        {roles.length > 0 || specials.length > 0 ? <p className="gw-ins-group">Roles</p> : null}
        {specials.map((name) => (
          <button key={name} type="button" onClick={() => onInsert(name)} className="gw-ins-row">
            <IconAt size={15} className="gw-ins-glyph" aria-hidden="true" />
            <span className="gw-ins-name">{name}</span>
          </button>
        ))}
        {roles.map((role) => (
          <button key={role.id} type="button" onClick={() => onInsert(`<@&${role.id}>`)} className="gw-ins-row">
            <span className="gw-ins-dot" style={{ backgroundColor: role.color || "#9aa0a6" }} aria-hidden="true" />
            <span className="gw-ins-name">{role.name}</span>
          </button>
        ))}
        {channels.length === 0 && roles.length === 0 && specials.length === 0 ? (
          <p className="gw-ins-none">Nothing called that.</p>
        ) : null}
      </div>
    </div>
  );
}

function TimeTab({ onInsert }: { onInsert: (token: string) => void }) {
  const [when, setWhen] = useState(() => {
    const now = new Date(Date.now() + 60 * 60 * 1000);
    now.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [style, setStyle] = useState("f");
  const unix = Math.floor(new Date(when).getTime() / 1000);

  /* Each style says what it will look like, for the time you picked, in
     the reader's own clock -- which is the point of a Discord timestamp. */
  const sample = (value: string) => {
    if (!Number.isFinite(unix)) return "";
    const date = new Date(unix * 1000);
    const options: Record<string, Intl.DateTimeFormatOptions> = {
      t: { hour: "numeric", minute: "2-digit" },
      T: { hour: "numeric", minute: "2-digit", second: "2-digit" },
      d: { month: "2-digit", day: "2-digit", year: "numeric" },
      D: { month: "long", day: "numeric", year: "numeric" },
      f: { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
      F: { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
    };
    if (value === "R") {
      const hours = Math.round((unix - Date.now() / 1000) / 3600);
      return new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }).format(hours, "hour");
    }
    return new Intl.DateTimeFormat("en-US", options[value]).format(date);
  };

  return (
    <div className="gw-ins-pane gw-ins-time">
      <label className="gw-ins-label" htmlFor="gw-ins-when">
        When
      </label>
      <input
        id="gw-ins-when"
        type="datetime-local"
        value={when}
        onChange={(event) => setWhen(event.target.value)}
        className="gw-ins-field"
        data-bare
      />
      <div className="gw-ins-list" role="radiogroup" aria-label="Shown as">
        {TIME_STYLES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={style === option.value}
            data-on={style === option.value ? "true" : undefined}
            onClick={() => setStyle(option.value)}
            onDoubleClick={() => onInsert(`<t:${unix}:${option.value}>`)}
            className="gw-ins-row"
          >
            <span className="gw-ins-name">{sample(option.value) || option.label}</span>
            <span className="gw-ins-note">{option.label.replace(/ \(.*\)$/, "")}</span>
            <IconCheck size={14} className="gw-ins-check" aria-hidden="true" />
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!Number.isFinite(unix)}
        onClick={() => onInsert(`<t:${unix}:${style}>`)}
        className="gw-btn gw-ins-go"
        data-kind="accent"
      >
        Insert
      </button>
    </div>
  );
}

export function InsertMenu({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const { open, setOpen, ref, menuRef } = usePopover();
  const [tab, setTab] = useState<"mentions" | "time" | "emojis">("mentions");

  function insert(token: string) {
    insertVariable(containerRef.current, token);
  }

  const tabs = [
    { value: "mentions" as const, label: "Mentions" },
    { value: "time" as const, label: "Time" },
    { value: "emojis" as const, label: "Emoji" },
  ];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Insert a mention, timestamp, or emoji into the field you were typing in"
        aria-label="Insert a mention, timestamp, or emoji"
        // A bare button, like the formatting buttons beside it.
        className="gw-insert-trigger"
        data-open={open ? "true" : undefined}
        data-tap="inline"
      >
        <IconKeyboard size={14} />
      </button>
      {open ? (
        <PortalMenu anchorRef={ref} menuRef={menuRef} minWidth={330}>
          <div className="gw-ins">
            <Segments value={tab} options={tabs} onChange={(next) => setTab(next as typeof tab)} label="Insert" className="gw-ins-tabs" />
            {/* Keyed on the tab, so changing it is one list giving way to the
                next rather than a swap. */}
            <div className="gw-ins-body" key={tab}>
              {tab === "mentions" ? <MentionsTab onInsert={insert} /> : null}
              {tab === "time" ? <TimeTab onInsert={insert} /> : null}
              {tab === "emojis" ? <EmojiGrid onPick={insert} /> : null}
            </div>
          </div>
        </PortalMenu>
      ) : null}
    </div>
  );
}
