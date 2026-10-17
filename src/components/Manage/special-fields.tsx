"use client";

import React, { useState } from "react";
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from "@tabler/icons-react";
import { ColorPicker, NumberField, RolePicker, SelectField, TextField, Toggle } from "./fields";
import { EmojiPickerButton } from "./emoji-picker";
import { PreviewInline } from "./embed-editor";
import type { ManagedRole } from "./types";
import { PresenceList, useListKeys } from "@/components/motion";

/* ── Welcome-style button list (link + colored buttons) ────────────────── */

interface ButtonItem {
  type: string;
  label: string;
  url?: string;
  style?: string;
  emoji?: string | null;
  disabled?: boolean;
}

const BUTTON_STYLES = [
  { value: "Grey", label: "Grey" },
  { value: "Blurple", label: "Blurple" },
  { value: "Green", label: "Green" },
  { value: "Red", label: "Red" },
];

const STYLE_PREVIEW: Record<string, string> = {
  Blurple: "bg-[#5865f2] text-white",
  Green: "bg-[#248046] text-white",
  Red: "bg-[#da373c] text-white",
  Grey: "bg-[#525252] text-white",
};

export function ButtonListEditor({
  buttons,
  onChange,
}: {
  buttons: ButtonItem[];
  onChange: (next: ButtonItem[]) => void;
}) {
  function update(index: number, patch: Partial<ButtonItem>) {
    const next = [...buttons];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {/* Live row preview */}
      {buttons.length ? (
        <div data-discord-preview className="gw-dc-strip flex flex-wrap gap-2">
          {buttons.map((button, index) => (
            <span
              key={index}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                button.type === "link"
                  ? "bg-[#525252] text-white"
                  : STYLE_PREVIEW[button.style || "Grey"]
              } ${button.disabled ? "opacity-50" : ""}`}
            >
              {button.emoji ? <PreviewInline text={`${button.emoji} `} /> : null}
              {button.label || "Button"}
              {button.type === "link" ? " ↗" : ""}
            </span>
          ))}
        </div>
      ) : null}

      {buttons.map((button, index) => (
        <div
          key={index}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
        >
          <div className="w-28">
            <SelectField
              value={button.type || "link"}
              options={[
                { value: "link", label: "Link" },
                { value: "button", label: "Button" },
              ]}
              onChange={(next) => update(index, { type: next || "link" })}
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <TextField
              value={button.label || ""}
              maxLength={80}
              placeholder="Label"
              onChange={(next) => update(index, { label: next })}
            />
          </div>
          {button.type === "link" ? (
            <div className="min-w-[160px] flex-1">
              <TextField
                value={button.url || ""}
                placeholder="https://…"
                onChange={(next) => update(index, { url: next })}
              />
            </div>
          ) : (
            <div className="w-32">
              <SelectField
                value={button.style || "Grey"}
                options={BUTTON_STYLES}
                onChange={(next) => update(index, { style: next || "Grey" })}
              />
            </div>
          )}
          <EmojiPickerButton
            value={button.emoji || undefined}
            onChange={(next) => update(index, { emoji: next || null })}
          />
          <label className="flex items-center gap-2 text-xs text-white/60">
            <Toggle
              checked={!button.disabled}
              onChange={(next) => update(index, { disabled: !next })}
            />
            On
          </label>
          <button
            type="button"
            onClick={() => onChange(buttons.filter((_, i) => i !== index))}
            className="text-white/35 hover:text-[var(--tone-bad)]"
            aria-label="Remove button"
          >
            <IconTrash size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={buttons.length >= 25}
        onClick={() =>
          onChange([
            ...buttons,
            { type: "link", label: "", url: "", emoji: null, disabled: false },
          ])
        }
        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#f5f2f2] transition-colors hover:border-[rgb(var(--accent-rgb)/0.35)] disabled:opacity-40"
      >
        <IconPlus size={13} />
        Add button
      </button>
    </div>
  );
}

interface PunishmentTypeItem {
  key?: string;
  label?: string;
  command?: string;
  color?: string;
  points?: number;
}

interface RoleQuotaItem {
  role_id?: string | number | null;
  quota_minutes?: number;
}

export function RoleQuotaEditor({
  quotas,
  roles,
  onChange,
}: {
  quotas: RoleQuotaItem[];
  roles: ManagedRole[];
  onChange: (next: RoleQuotaItem[]) => void;
}) {
  const quotaKeys = useListKeys(quotas);
  const update = (index: number, patch: Partial<RoleQuotaItem>) =>
    onChange(quotas.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const chooseRole = (index: number, roleId: string | null) => {
    if (!roleId) {
      update(index, { role_id: null });
      return;
    }
    // One role has one target: if it was picked in another row, the stale
    // duplicate row is removed.
    onChange(
      quotas
        .map((item, itemIndex) => itemIndex === index ? { ...item, role_id: roleId } : item)
        .filter((item, itemIndex) => itemIndex === index || String(item.role_id || "") !== roleId),
    );
  };

  return (
    <div className="space-y-3">
      {!quotas.length ? (
        <p className="text-xs text-white/45">No role-specific quotas. The default target applies to the selected staff roles.</p>
      ) : null}
      <PresenceList
        items={quotas}
        keys={quotaKeys}
        className="space-y-2"
        render={(item, index) => (
        <div className="gw-item grid gap-2 sm:grid-cols-[minmax(180px,1fr)_160px_auto]">
          <RolePicker
            roles={roles}
            value={item.role_id != null ? String(item.role_id) : null}
            onChange={(roleId) => chooseRole(index, Array.isArray(roleId) ? roleId[0] || null : roleId)}
            placeholder="Choose a staff role"
          />
          <NumberField
            value={item.quota_minutes ?? 60}
            min={0}
            max={43200}
            placeholder="Minutes per period"
            onChange={(minutes) => update(index, { quota_minutes: minutes === "" ? 0 : Number(minutes) })}
          />
          <button
            type="button"
            onClick={() => onChange(quotas.filter((_, itemIndex) => itemIndex !== index))}
            className="gw-remove"
            aria-label="Remove role quota"
          >
            <IconTrash size={14} />
            <span className="sr-only">Remove</span>
          </button>
        </div>
        )}
      />
      <button
        type="button"
        disabled={quotas.length >= 25}
        onClick={() => onChange([...quotas, { role_id: null, quota_minutes: 60 }])}
        className="gw-btn"
      >
        <IconPlus size={13} /> Add role quota
      </button>
      {quotas.length ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="ml-2 inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-soft)]"
        >
          <IconTrash size={13} /> Remove all role quotas
        </button>
      ) : null}
    </div>
  );
}

export function PunishmentTypesEditor({
  types,
  onChange,
}: {
  types: PunishmentTypeItem[];
  onChange: (next: PunishmentTypeItem[]) => void;
}) {
  const typeKeys = useListKeys(types);
  const update = (index: number, patch: Partial<PunishmentTypeItem>) =>
    onChange(types.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return (
    <div className="space-y-3">
      <PresenceList
        items={types}
        keys={typeKeys}
        className="space-y-2"
        render={(item, index) => (
        <div className="gw-item">
          <div className="grid gap-2 sm:grid-cols-[minmax(140px,1fr)_minmax(120px,1fr)_150px_auto]">
            <TextField value={item.label || ""} maxLength={80} placeholder="Type name" onChange={(label) => update(index, { label, key: item.key || label.trim().toLowerCase().replace(/\s+/g, "_") })} />
            <TextField value={item.command || ""} maxLength={20} placeholder="ER:LC command, e.g. kick" onChange={(command) => update(index, { command: command.replace(/^:/, "") })} />
            <NumberField value={item.points ?? 0} min={0} max={1000} placeholder="Risk points" onChange={(points) => update(index, { points: points === "" ? 0 : Number(points) })} />
            <button type="button" onClick={() => onChange(types.filter((_, itemIndex) => itemIndex !== index))} className="gw-remove" aria-label={`Remove ${item.label || "punishment type"}`}><IconTrash size={14} /></button>
          </div>
          <div className="mt-2 max-w-xs">
            <ColorPicker value={item.color || "#e67e22"} label={`${item.label || "Punishment"} log colour`} onChange={(color) => update(index, { color })} />
          </div>
        </div>
        )}
      />
      <button type="button" disabled={types.length >= 20} onClick={() => onChange([...types, { key: `custom_${types.length + 1}`, label: `Custom ${types.length + 1}`, command: "", color: "#e67e22", points: 1 }])} className="gw-btn">
        <IconPlus size={13} /> Add punishment type
      </button>
    </div>
  );
}

/* ── Multi-hierarchy department ladders (Promotions) ───────────────────── */

interface DepartmentLadder {
  name: string;
  ranks: (string | number)[];
}

/* Each department is a card with its name as the heading and its ranks as an
   ordered ladder, lowest first (the order the bot walks, as in the single
   hierarchy). "Department" adds one already named and focused. Duplicate names
   are flagged, because the bot finds a department by name and would only ever
   find the first. */
export function DepartmentLaddersEditor({
  departments,
  roles,
  onChange,
}: {
  departments: DepartmentLadder[];
  roles: ManagedRole[];
  onChange: (next: DepartmentLadder[]) => void;
}) {
  const [fresh, setFresh] = useState<number | null>(null);
  const write = (index: number, patch: Partial<DepartmentLadder>) =>
    onChange(departments.map((department, i) => (i === index ? { ...department, ...patch } : department)));
  const seen = new Map<string, number>();
  for (const department of departments) {
    const key = (department.name || "").trim().toLowerCase();
    if (key) seen.set(key, (seen.get(key) || 0) + 1);
  }

  function add() {
    const taken = new Set(departments.map((department) => (department.name || "").trim().toLowerCase()));
    let name = "New department";
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `New department ${n}`;
    setFresh(departments.length);
    onChange([...departments, { name, ranks: [] }]);
  }

  return (
    <div className="gw-depts">
      <PresenceList
        items={departments}
        className="gw-depts-list"
        render={(department, index) => {
          const ranks = (department.ranks || []).map(String);
          const clash = (seen.get((department.name || "").trim().toLowerCase()) || 0) > 1;
          return (
            <section className="gw-dept" aria-label={department.name || `Department ${index + 1}`}>
              <header className="gw-dept-head">
                <input
                  className="gw-dept-name"
                  value={department.name || ""}
                  maxLength={80}
                  placeholder="Department name"
                  aria-label="Department name"
                  spellCheck={false}
                  data-bare
                  autoFocus={fresh === index}
                  onFocus={(event) => {
                    if (fresh === index) {
                      event.currentTarget.select();
                      setFresh(null);
                    }
                  }}
                  onChange={(event) => write(index, { name: event.target.value })}
                />
                <span className="gw-dept-count">
                  {ranks.length ? `${ranks.length} rank${ranks.length === 1 ? "" : "s"}` : "No ranks yet"}
                </span>
                <button
                  type="button"
                  className="gw-dept-remove"
                  title="Remove this department"
                  aria-label={`Remove ${department.name || "this department"}`}
                  onClick={() => onChange(departments.filter((_, i) => i !== index))}
                >
                  <IconTrash size={15} />
                </button>
              </header>
              {clash ? (
                <p className="gw-dept-clash">Another department has this name. Give each one its own.</p>
              ) : null}
              <RankLadderField
                roles={roles}
                value={ranks}
                onChange={(next) => write(index, { ranks: next })}
              />
            </section>
          );
        }}
      />
      <button type="button" className="gw-dept-add" onClick={add}>
        <IconPlus size={14} />
        Department
      </button>
    </div>
  );
}

/* ── rank ladder ──

   A roles field whose order is the value: promotion and demotion both walk this
   list's order, not Discord's role positions (which change for unrelated
   reasons). Reordered with buttons, which works by keyboard and suits a list
   set up once. */
export function RankLadderField({
  roles,
  value,
  onChange,
}: {
  roles: ManagedRole[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const byId = React.useMemo(
    () => new Map(roles.map((role) => [String(role.id), role])),
    [roles],
  );

  function move(index: number, by: number) {
    const next = [...value];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="gw-ladder">
      {/* Adding and removing use the usual role picker. New roles land at the
         top of the ladder. */}
      <RolePicker
        roles={roles}
        multi
        value={value}
        onChange={(next) => onChange(Array.isArray(next) ? next : [])}
        placeholder="Add a rank role"
      />
      {value.length ? (
        <ol className="gw-ladder-list">
          {/* Displayed highest first (how a hierarchy is read) while the stored
             list stays lowest first (the order the bot walks); only the display
             is reversed. */}
          {[...value].reverse().map((id, reversedIndex) => {
            const index = value.length - 1 - reversedIndex;
            const role = byId.get(String(id));
            const top = index === value.length - 1;
            const bottom = index === 0;
            return (
              <li key={id} className="gw-ladder-row" data-missing={role ? undefined : "true"}>
                <span className="gw-ladder-step">{index + 1}</span>
                <span className="gw-ladder-dot" style={{ backgroundColor: role?.color || "#9aa0a6" }} />
                <span className="gw-ladder-name">{role?.name || "A role that was deleted"}</span>
                {top && value.length > 1 ? <span className="gw-ladder-end">Highest</span> : null}
                {bottom && value.length > 1 ? <span className="gw-ladder-end">Lowest</span> : null}
                <button
                  type="button"
                  className="gw-ladder-btn"
                  aria-label={`Move ${role?.name || "role"} up`}
                  title="Up a rank"
                  disabled={top}
                  onClick={() => move(index, 1)}
                >
                  <IconArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="gw-ladder-btn"
                  aria-label={`Move ${role?.name || "role"} down`}
                  title="Down a rank"
                  disabled={bottom}
                  onClick={() => move(index, -1)}
                >
                  <IconArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="gw-ladder-btn"
                  data-tone="bad"
                  aria-label={`Remove ${role?.name || "role"} from the ladder`}
                  title="Take off the ladder"
                  onClick={() => onChange(value.filter((entry) => entry !== id))}
                >
                  <IconTrash size={13} />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="gw-ladder-empty">
          No ranks yet. Add the roles in order; a promotion moves someone one step up.
        </p>
      )}
    </div>
  );
}
