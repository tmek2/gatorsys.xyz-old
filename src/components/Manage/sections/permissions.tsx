"use client";

import React, { useState } from "react";
import { PresenceList } from "@/components/motion";
import { createPortal } from "react-dom";
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconShieldLock,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { FieldRow, RolePicker, SettingsCard, TextField } from "../fields";
import { useManage } from "../manage-context";
import { ConfigCard, FieldIcon, GroupHeader } from "../schema-section";
import { SectionHeader } from "../section-header";
import { RoleSwatch } from "../indicator";

/**
 * Permissions tab: the legacy three-stage roles plus fully custom roles. A
 * custom role maps Discord roles onto granular permissions, in the style of
 * Boomerang's permission builder.
 */

interface CustomRole {
  name: string;
  role_ids: string[];
  permissions: string[];
}

/** Keep in sync with the bot's utils/custom_permissions.py. */
const PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: "administrator", label: "Administrator", description: "Grants all permissions across every Gator feature. Equivalent to full server access." },
  { key: "edit_dashboard", label: "Edit Dashboard", description: "Access to all aspects of the dashboard and the ability to edit all server settings." },
  { key: "manage_sessions", label: "Manage Sessions", description: "Manage and use all session commands, trigger startup votes, server shutdowns, and server startups." },
  { key: "manage_infractions", label: "Manage Infractions", description: "Log user infractions, view infraction history, and edit, void, and delete infractions." },
  { key: "manage_promotions", label: "Manage Promotions", description: "Process member promotions and adjust positions in the server's rank ladders." },
  { key: "manage_suspensions", label: "Manage Suspensions", description: "Suspend staff members and manage active suspensions." },
  { key: "manage_loa", label: "Manage LOA", description: "Review and process leave of absence requests." },
  { key: "manage_quota", label: "Manage Quota", description: "Manage message quotas, cycles, and per-role targets." },
  { key: "manage_tickets", label: "Manage Tickets", description: "Manage the support system, blacklist users from tickets, and view ticket transcripts." },
  { key: "manage_modmail", label: "Manage Modmail", description: "Handle modmail conversations and categories." },
  { key: "manage_applications", label: "Manage Resources", description: "Create and manage resources (applications, documents and spreadsheets) and review form responses." },
  { key: "manage_departments", label: "Manage Departments", description: "Management of linked department servers, cross-server profiles, and network actions." },
  { key: "manage_giveaways", label: "Manage Giveaways", description: "Full life-cycle management of server giveaways, including rerolling winners and ending events." },
  { key: "manage_staff_database", label: "Manage Staff Database", description: "Access the internal personnel database, staff panel records, and saved staff data." },
  { key: "manage_feedback", label: "Manage Feedback", description: "View and manage staff feedback results." },
  { key: "manage_erlc", label: "Manage ERLC", description: "Full management of ER:LC server settings, restrictions, and high-level game server commands." },
  { key: "view_erlc", label: "View ERLC", description: "Permission to view live ER:LC server logs, player statistics, and server status in the dashboard." },
  { key: "manage_utility", label: "Manage Utility", description: "Manage welcome messages, auto responses, reminders, packages, and custom server emojis." },
  { key: "manage_logs", label: "Manage Logs", description: "View and configure the bot's logging channels and audit output." },
];

function RoleEditorModal({
  initial,
  onSave,
  onClose,
}: {
  initial: CustomRole | null;
  onSave: (role: CustomRole) => void;
  onClose: () => void;
}) {
  const { meta } = useManage();
  const [name, setName] = useState(initial?.name || "");
  const [roleIds, setRoleIds] = useState<string[]>(initial?.role_ids || []);
  const [permissions, setPermissions] = useState<string[]>(initial?.permissions || []);

  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function togglePermission(key: string) {
    setPermissions((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  }

  /* What is stopping this being saved, in field order. */
  const missing: { field: "name" | "roles" | "permissions"; text: string }[] = [];
  if (!name.trim()) missing.push({ field: "name", text: "give the role a name" });
  if (!roleIds.length) missing.push({ field: "roles", text: "pick at least one Discord role" });
  if (!permissions.length) {
    missing.push({ field: "permissions", text: "tick at least one permission" });
  }
  const valid = missing.length === 0;
  const nameRef = React.useRef<HTMLDivElement>(null);
  const rolesRef = React.useRef<HTMLDivElement>(null);

  /** Take the user to the first thing that is missing, rather than refusing. */
  function showFirstMissing() {
    const target = missing[0]?.field;
    const node = target === "roles" ? rolesRef.current : nameRef.current;
    if (target === "permissions" || !node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.querySelector("input")?.focus();
  }

  return createPortal(
    <div className="gator-overlay fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="dialog-pop relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d] shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-start gap-3 border-b border-white/[0.08] px-5 py-4">
          <IconShieldLock size={24} className="mt-1 shrink-0 text-[var(--accent-peach)]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold text-[#f5f2f2]">
              {initial ? "Edit Custom Role" : "Create Custom Role"}
            </h3>
            <p className="cool-text text-[13px]">
              A Gator role is permissions data, not a Discord role. Nothing is
              created in your server. It names Discord roles you already have
              and says what holding one lets a member do in Gator.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white">
            <IconX size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
          <div className="max-w-2xl space-y-5">
            <div ref={nameRef}>
            <FieldRow label="Role name">
              <TextField
                value={name}
                maxLength={60}
                placeholder="e.g. Senior Staff, Moderator…"
                onChange={setName}
              />
            </FieldRow>
            </div>
            <div ref={rolesRef}>
            <FieldRow
              label="Discord roles"
              description="Members holding any of these get this Gator role's permissions."
            >
              <RolePicker
                roles={meta?.roles || []}
                multi
                value={roleIds}
                onChange={(next) => setRoleIds(Array.isArray(next) ? next : [])}
              />
            </FieldRow>
            </div>
          </div>

          <p className="mb-1 mt-8 text-sm font-bold text-[#f5f2f2]">Permissions</p>
          <p className="cool-text mb-3 text-[12.5px]">
            Choose exactly what members with this role can do.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {PERMISSIONS.map((permission) => {
              const checked = permissions.includes(permission.key);
              return (
                <label
                  key={permission.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 transition-colors ${
                    checked
                      ? "border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.07)]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePermission(permission.key)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors ${
                      checked
                        ? "border-[var(--accent-peach)] bg-[var(--accent-peach)] text-[#211517]"
                        : "border-white/15 bg-white/[0.025] text-transparent"
                    }`}
                  >
                    <IconCheck size={13} stroke={3} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#f5f2f2]">
                      {permission.label}
                    </span>
                    <span className="cool-text mt-1 block text-[12.5px] leading-relaxed">
                      {permission.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-4">
          {missing.length ? (
            <p className="mr-auto text-[12.5px] text-[var(--tone-warn)]">
              To save this role, {missing.map((item) => item.text).join(", and ")}.
            </p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-white/50 hover:text-white"
          >
            Cancel
          </button>
          {/* Not disabled: pressing it scrolls to the first missing field and
             focuses it (the fields it needs are far above the permission
             cards). */}
          <button
            type="button"
            aria-disabled={!valid}
            onClick={() =>
              valid
                ? onSave({ name: name.trim(), role_ids: roleIds, permissions })
                : showFirstMissing()
            }
            className={`btn-pop btn-peach h-9 px-4 text-sm ${valid ? "" : "opacity-50"}`}
          >
            {initial ? "Save role" : "Create role"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PermissionsSection() {
  const { meta, value, stage } = useManage();
  const customRoles: CustomRole[] = Array.isArray(value("Permissions.custom_roles"))
    ? value("Permissions.custom_roles")
    : [];
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);

  const roleName = (id: string) =>
    meta?.roles.find((role) => role.id === String(id))?.name || "deleted role";
  const roleColor = (id: string) =>
    meta?.roles.find((role) => role.id === String(id))?.color || "#9aa0a6";

  function saveRole(role: CustomRole) {
    const next = [...customRoles];
    if (editing?.index != null) next[editing.index] = role;
    else next.push(role);
    stage("Permissions.custom_roles", next);
    setEditing(null);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Permissions"
      />

      <SettingsCard
        title="Custom Roles"
        description="Pick a Discord role you already have and give it the features it needs. This does not make a role in your server."
        actions={
          <button
            type="button"
            onClick={() => setEditing({ index: null })}
            className="btn-pop btn-peach inline-flex h-9 items-center gap-2 px-4 text-sm"
          >
            <IconPlus size={15} />
            Create Role
          </button>
        }
      >
        {customRoles.length === 0 ? (
          <p className="cool-text text-sm">None yet.</p>
        ) : (
          <PresenceList
            items={customRoles}
            className="space-y-2"
            render={(role, index) => (
              <div className="gw-item flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#f5f2f2]">
                    {role.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    {(role.role_ids || []).slice(0, 6).map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/70"
                      >
                        <RoleSwatch color={roleColor(id)} />
                        {roleName(id)}
                      </span>
                    ))}
                    {(role.role_ids || []).length > 6 ? (
                      <span className="cool-text text-[11px]">
                        +{(role.role_ids || []).length - 6} more
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="cool-text shrink-0 rounded-xl bg-white/[0.04] px-2 py-1 text-[11px] font-semibold">
                  {(role.permissions || []).includes("administrator")
                    ? "Administrator"
                    : `${(role.permissions || []).length} permission${(role.permissions || []).length === 1 ? "" : "s"}`}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${role.name}`}
                    onClick={() => setEditing({ index })}
                    className="rounded-xl p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <IconPencil size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${role.name}`}
                    onClick={() =>
                      stage(
                        "Permissions.custom_roles",
                        customRoles.filter((_, i) => i !== index)
                      )
                    }
                    className="gw-remove"
                  >
                    <IconTrash size={15} />
                  </button>
                </span>
              </div>
            )}
          />
        )}
      </SettingsCard>

      <section>
        <GroupHeader
          /* One colour at three intensities for the three stages of one ladder
             (Staff, Management, Administrator). */
          title="Permission stages"
          description="What the bot uses when no custom role applies."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {(
            [
              { path: "Permissions.staffrole", title: "Staff roles", description: "Members with these roles can use staff commands.", tint: "text-[var(--accent-peach)]/70 bg-[rgb(var(--accent-rgb)/0.07)]" },
              { path: "Permissions.managementrole", title: "Management roles", description: "Grants access to management commands like infractions and promotions.", tint: "text-[var(--accent-peach)]/85 bg-[rgb(var(--accent-rgb)/0.12)]" },
              { path: "Permissions.adminrole", title: "Administrator roles", description: "The highest stage. Full access to every command and configuration.", tint: "text-[var(--accent-peach)] bg-[rgb(var(--accent-rgb)/0.18)]" },
            ] as const
          ).map((stage_) => (
            <ConfigCard
              key={stage_.path}
              icon={<FieldIcon type="role" />}
              title={stage_.title}
              description={stage_.description}
            >
              <RolePicker
                roles={meta?.roles || []}
                multi
                value={Array.isArray(value(stage_.path)) ? value(stage_.path).map(String) : []}
                onChange={(next) => stage(stage_.path, next)}
              />
            </ConfigCard>
          ))}
        </div>
      </section>

      {editing ? (
        <RoleEditorModal
          initial={editing.index != null ? customRoles[editing.index] : null}
          onSave={saveRole}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
