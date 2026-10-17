"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconCommand,
  IconHash,
  IconHistory,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useManage } from "../manage-context";
import { SectionHeader } from "../section-header";
import { Segments } from "../segments";
import { SelectField } from "../fields";
import type { AuditEntry } from "../types";
import { EmptyState, SkeletonRows } from "../empty-state";

function initials(name: string | null): string {
  if (!name) return "··";
  return name.slice(0, 2).toUpperCase();
}

interface AuditChange {
  label: string;
  from: string;
  to: string;
}

/** Pair up the metadata's previous/now lines into per-field changes. */
function entryChanges(entry: AuditEntry): AuditChange[] {
  const previous = (entry.metadata?.previous || "").split("\n");
  const now = (entry.metadata?.now || "").split("\n");
  const count = Math.max(previous.length, now.length);
  const changes: AuditChange[] = [];
  for (let index = 0; index < count; index += 1) {
    const prevLine = previous[index] || "";
    const nowLine = now[index] || "";
    const label =
      (nowLine || prevLine).split(":")[0]?.trim() || `Change ${index + 1}`;
    const from = prevLine.slice(prevLine.indexOf(":") + 1).trim() || "Not set";
    const to = nowLine.slice(nowLine.indexOf(":") + 1).trim() || "Not set";
    if (!prevLine && !nowLine) continue;
    changes.push({ label, from, to });
  }
  return changes;
}

function Face({ entry, size = 32 }: { entry: AuditEntry; size?: number }) {
  return entry.actor_avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={discordAvatarUrl(entry.actor_avatar) || ""}
      alt=""
      className="gw-audit-face"
      style={{ width: size, height: size }}
    />
  ) : (
    <span className="gw-audit-face" data-initials="true" style={{ width: size, height: size }}>
      {initials(entry.actor_name)}
    </span>
  );
}

function clock(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** One command someone ran: what, whether it worked, where, and with what. */
function CommandAuditRow({ entry }: { entry: AuditEntry }) {
  const status = entry.status || "Succeeded";
  const failed = status.toLowerCase() === "failed";
  const started = status.toLowerCase() === "started";
  const argumentsList = Object.entries(entry.arguments || {});
  return (
    <div className="gw-audit-row">
      <Face entry={entry} />
      <div className="gw-audit-main">
        <p className="gw-audit-line">
          <span className="gw-audit-command">
            <IconCommand size={14} aria-hidden="true" />
            {entry.module?.toLowerCase().startsWith("slash") ? "/" : ""}
            {entry.command || "unknown"}
          </span>
          <span
            className="gw-audit-status"
            data-tone={failed ? "bad" : started ? "warn" : "ok"}
          >
            {failed ? <IconAlertTriangle size={11} /> : <IconCheck size={11} />}
            {status}
          </span>
        </p>
        <p className="gw-audit-meta">
          <span className="gw-audit-who">{entry.actor_name || "Unknown user"}</span>
          {entry.channel_name || entry.channel_id ? (
            <span className="gw-audit-where">
              <IconHash size={11} aria-hidden="true" />
              {entry.channel_name || entry.channel_id}
            </span>
          ) : null}
          {entry.duration_ms != null ? <span>{entry.duration_ms} ms</span> : null}
        </p>
        {argumentsList.length ? (
          <div className="gw-audit-args">
            {argumentsList.map(([name, value]) => (
              <span key={name} className="gw-audit-arg">
                <span className="gw-audit-arg-name">{name}</span>
                <span className="gw-audit-arg-value">{String(value)}</span>
              </span>
            ))}
          </div>
        ) : null}
        {entry.error ? <p className="gw-audit-error">{entry.error}</p> : null}
      </div>
      <time
        className="gw-audit-time"
        dateTime={entry.created_at}
        title={entry.created_at ? new Date(entry.created_at).toLocaleString() : undefined}
      >
        {clock(entry.created_at)}
      </time>
    </div>
  );
}

/** One change: who, where, what it now says, and -- opened -- every field it
 *  touched, before and after. */
function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const changes = useMemo(() => entryChanges(entry), [entry]);
  if (entry.command) return <CommandAuditRow entry={entry} />;
  const headline = changes[0];

  return (
    <div className="gw-audit-row" data-open={open ? "true" : undefined}>
      <Face entry={entry} />
      <div className="gw-audit-main">
        <p className="gw-audit-line">
          <span className="gw-audit-who">{entry.actor_name || "Someone"}</span>
          <span className="gw-audit-module">{entry.module || "General"}</span>
        </p>
        <p className="gw-audit-summary">
          {entry.summary || entry.action || "Configuration updated"}
        </p>
        {headline ? (
          <button
            type="button"
            className="gw-audit-diff"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <span className="gw-audit-diff-label">{headline.label}</span>
            <span className="gw-audit-from">{headline.from}</span>
            <IconArrowRight size={12} className="gw-audit-arrow" aria-hidden="true" />
            <span className="gw-audit-to">{headline.to}</span>
            {changes.length > 1 ? (
              <span className="gw-audit-more">+{changes.length - 1}</span>
            ) : null}
            <IconChevronDown size={14} className="gw-audit-chev" aria-hidden="true" />
          </button>
        ) : null}
        {changes.length ? (
          <div className="gw-set-roll" data-open={open ? "true" : "false"}>
            <div className="gw-set-roll-clip" inert={!open}>
              <div className="gw-audit-changes">
                {changes.map((change, index) => (
                  <div key={index} className="gw-audit-change">
                    <span className="gw-audit-diff-label">{change.label}</span>
                    <span className="gw-audit-pair">
                      <span className="gw-audit-from">{change.from}</span>
                      <IconArrowRight size={12} className="gw-audit-arrow" aria-hidden="true" />
                      <span className="gw-audit-to">{change.to}</span>
                    </span>
                  </div>
                ))}
                {entry.actor_id ? (
                  <p className="gw-audit-foot">
                    {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
                    {` · ${entry.actor_id}`}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <time
        className="gw-audit-time"
        dateTime={entry.created_at}
        title={entry.created_at ? new Date(entry.created_at).toLocaleString() : undefined}
      >
        {clock(entry.created_at)}
      </time>
    </div>
  );
}

/** "Today", "Yesterday", or the date -- the heading a day's entries sit under. */
function dayLabel(iso?: string): string {
  if (!iso) return "Undated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated";
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(date)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  // In the page's language: "Today" and "Yesterday" are English, so the day
  // after them is too, not whatever language the browser happens to be set to.
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

const TIME_RANGES: { value: string; label: string; ms: number | null }[] = [
  { value: "all", label: "All time", ms: null },
  { value: "hour", label: "Last hour", ms: 60 * 60 * 1000 },
  { value: "day", label: "Last day", ms: 24 * 60 * 60 * 1000 },
  { value: "week", label: "Last week", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "month", label: "Last month", ms: 30 * 24 * 60 * 60 * 1000 },
];

type AuditKind = "dashboard" | "commands";

/* The audit log: the two logs are the page's views, search and range share one
   toolbar, and entries are grouped by day so each row only shows the time. A
   change shows its first field before and after, and expands to show every
   field it touched. */
export function AuditSection() {
  const { guildId } = useManage();
  const [tab, setTab] = useState<AuditKind>("dashboard");
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    setEntries(null);
    fetch(`/api/manage/${guildId}/audit?limit=${limit}&kind=${tab}`)
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((json) => setEntries(json.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [guildId, limit, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const rangeMs = TIME_RANGES.find((item) => item.value === range)?.ms ?? null;
    const now = Date.now();
    const term = query.trim().toLowerCase();
    return (entries || []).filter((entry) => {
      if (rangeMs != null && entry.created_at) {
        const created = new Date(entry.created_at).getTime();
        if (!Number.isNaN(created) && now - created > rangeMs) return false;
      }
      if (!term) return true;
      return (
        (entry.actor_name || "").toLowerCase().includes(term) ||
        (entry.summary || "").toLowerCase().includes(term) ||
        (entry.module || "").toLowerCase().includes(term) ||
        (entry.action || "").toLowerCase().includes(term) ||
        (entry.command || "").toLowerCase().includes(term) ||
        (entry.channel_name || entry.channel_id || "")
          .toLowerCase()
          .includes(term) ||
        Object.entries(entry.arguments || {}).some(([name, value]) =>
          `${name} ${value}`.toLowerCase().includes(term),
        )
      );
    });
  }, [entries, range, query]);

  const days = useMemo(() => {
    const out: { label: string; items: AuditEntry[] }[] = [];
    for (const entry of visible) {
      const label = dayLabel(entry.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else out.push({ label, items: [entry] });
    }
    return out;
  }, [visible]);

  return (
    <div className="gw-audit">
      <SectionHeader
        title="Audit Log"
        actions={
          <button
            type="button"
            className="gw-audit-refresh"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
          >
            <IconRefresh size={15} className={loading ? "gw-spin" : undefined} />
            <span>Refresh</span>
          </button>
        }
      />

      <Segments<AuditKind>
        className="gw-audit-views"
        label="Which log"
        value={tab}
        onChange={setTab}
        options={[
          { value: "dashboard", label: "Changes" },
          { value: "commands", label: "Commands" },
        ]}
      />

      <div className="gw-audit-tools">
        <label className="gw-audit-find">
          <IconSearch size={15} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "commands" ? "Search a person, command or channel" : "Search a person or setting"}
            aria-label="Search the log"
            data-bare
          />
        </label>
        <div className="gw-audit-range">
          <SelectField
            value={range}
            options={TIME_RANGES.map((option) => ({
              value: option.value,
              label: option.label,
              icon: <IconClock size={14} />,
            }))}
            onChange={(next) => setRange(next || "all")}
          />
        </div>
      </div>

      {entries === null ? (
        <SkeletonRows rows={4} label="Loading the log…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? "Nothing matches that"
              : tab === "commands"
                ? "No commands in this range"
                : "No changes in this range"
          }
          hint={query.trim() ? "Try a name, a setting or a command." : "Widen the range to look further back."}
        />
      ) : (
        days.map((day) => (
          <section className="gw-set" key={day.label}>
            <div className="gw-set-panel">
              <div className="gw-set-head" data-static="true">
                <span className="gw-set-head-copy">
                  <span className="gw-set-head-name">{day.label}</span>
                </span>
                <span className="gw-set-count">
                  {day.items.length} {tab === "commands" ? "run" : "change"}
                  {day.items.length === 1 ? "" : "s"}
                </span>
              </div>
              {day.items.map((entry, index) => (
                <AuditRow key={`${entry.created_at}-${index}`} entry={entry} />
              ))}
            </div>
          </section>
        ))
      )}

      {entries !== null && entries.length >= limit ? (
        <div className="gw-audit-more-row">
          <button
            type="button"
            className="gw-audit-refresh"
            onClick={() => setLimit((current) => current + 100)}
            disabled={loading}
          >
            <IconHistory size={15} />
            <span>Load older entries</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
