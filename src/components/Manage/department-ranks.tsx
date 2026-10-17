"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconShield,
  IconSpeakerphone,
  IconPencil,
  IconCheck,
  IconClock,
  IconWaveSine,
  IconGavel,
  IconUsers,
  IconEye,
  IconFolder,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { ColorPicker, RolePicker, TextField, Toggle } from "./fields";
import type { ManagedRole } from "./types";
import { RoleSwatch } from "./indicator";

/** Department rank permissions, in the server Permissions tab's card style. */
export const DEPARTMENT_RANK_PERMISSIONS: {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "administrator",
    label: "Administrator",
    description: "Full access to everything in this department",
    icon: <IconShield size={15} />,
  },
  {
    key: "post_shouts",
    label: "Post Shouts",
    description: "Can post shouts",
    icon: <IconSpeakerphone size={15} />,
  },
  {
    key: "manage_shouts",
    label: "Manage Shouts",
    description: "Can manage shouts",
    icon: <IconPencil size={15} />,
  },
  {
    key: "activity_manager",
    label: "Activity Manager",
    description: "Can manage activity",
    icon: <IconClock size={15} />,
  },
  {
    key: "loa_manager",
    label: "LOA Manager",
    description: "Can manage LOAs",
    icon: <IconWaveSine size={15} />,
  },
  {
    key: "issue_infractions",
    label: "Issue Infractions",
    description: "Can issue infractions",
    icon: <IconGavel size={15} />,
  },
  {
    key: "manage_members",
    label: "Manage Members",
    description: "Can manage, promote, demote, and remove members",
    icon: <IconUsers size={15} />,
  },
  {
    key: "manage_resources",
    label: "Manage Resources",
    description: "Can create and manage resources",
    icon: <IconFolder size={15} />,
  },
  {
    key: "view_resources",
    label: "View Resources",
    description: "Can view department resources. Ranks without this, or a manage permission, can't open the Resources tab.",
    icon: <IconEye size={15} />,
  },
];

export interface DepartmentRank {
  id: string;
  name: string;
  color?: string;
  role_id?: string | null;
  join_rank?: boolean;
  permissions: string[];
}

/** Create/Edit a department rank — name, accent colour, linked Discord role,
 *  and our permission toggles. */
export function RankEditorModal({
  initial,
  roles,
  currentJoinRankName,
  onSave,
  onDelete,
  onClose,
}: {
  initial: DepartmentRank | null;
  roles: ManagedRole[];
  /** Name of the rank currently set as the joining rank (if any other). */
  currentJoinRankName?: string | null;
  onSave: (rank: DepartmentRank) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || "#f7a8c4");
  const [roleId, setRoleId] = useState<string | null>(initial?.role_id || null);
  const [permissions, setPermissions] = useState<string[]>(
    initial?.permissions || [],
  );
  const [joinRank, setJoinRank] = useState(Boolean(initial?.join_rank));
  const [joinConfirm, setJoinConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function toggle(key: string) {
    setPermissions((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  const valid = name.trim().length > 0;
  const linkedRole = roleId
    ? roles.find((role) => String(role.id) === String(roleId)) || null
    : null;

  return createPortal(
    <div className="gator-overlay fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="dialog-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="dialog-pop relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d] shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <h3 className="text-base font-extrabold text-[#f5f2f2]">
            {initial ? "Edit Rank" : "Create Rank"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/40 hover:text-white"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {/* A preview of the rank as the roster draws it: the colour dot, the
             name and the linked role. */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <span className="cool-text shrink-0 text-[10px] font-bold uppercase tracking-wider">
              Roster
            </span>
            <span className="flex items-center gap-2 text-sm font-bold text-white/80">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color || "#f7a8c4" }}
              />
              {name.trim() || "Untitled rank"}
            </span>
            {linkedRole ? (
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white/70">
                <RoleSwatch color={linkedRole.color} />
                @{linkedRole.name}
              </span>
            ) : null}
            {joinRank ? (
              <span className="rounded-lg bg-[rgb(var(--accent-rgb)/0.14)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-peach)]">
                Joining rank
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-white/80">
                Name <span className="text-[var(--accent-peach)]">*</span>
              </label>
              <TextField value={name} maxLength={60} onChange={setName} />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-white/80">
                Colour <span className="text-[var(--accent-peach)]">*</span>
              </label>
              <ColorPicker value={color} onChange={setColor} label="Choose rank color" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[13px] font-semibold text-white/80">
                Linked Discord Role
              </p>
              <p className="cool-text mb-2 text-xs">
                Link this rank to a role in your Discord server.
              </p>
              <RolePicker
                roles={roles}
                value={roleId}
                placeholder="Link a Discord role"
                onChange={(next) => setRoleId((next as string) || null)}
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <Toggle
                checked={joinRank}
                onChange={(next) => {
                  if (next && currentJoinRankName) {
                    setJoinConfirm(true);
                    return;
                  }
                  setJoinRank(next);
                }}
              />
              <span>
                <span className="block text-sm font-bold text-[#f5f2f2]">
                  Joining rank
                </span>
                <span className="cool-text text-xs">
                  New members who join the department receive this rank.
                </span>
              </span>
            </label>
          </div>
          {joinConfirm ? (
            <div className="rounded-xl border border-[var(--tone-warn-line)] bg-[var(--tone-warn-soft)] p-4">
              <p className="text-sm font-bold text-[var(--tone-warn)]">
                Only one rank can be the joining rank
              </p>
              <p className="cool-text mt-1 text-xs leading-5">
                Making <span className="font-bold text-white/80">{name || "this rank"}</span> the
                joining rank will remove{" "}
                <span className="font-bold text-white/80">{currentJoinRankName}</span> as the
                joining rank.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setJoinConfirm(false)}
                  className="px-3 py-2 text-xs font-semibold text-white/55 hover:text-white"
                >
                  Keep {currentJoinRankName}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJoinRank(true);
                    setJoinConfirm(false);
                  }}
                  className="btn-pop btn-peach px-3 py-2 text-xs"
                >
                  Make this the joining rank
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-bold text-[#f5f2f2]">Permissions</p>
            <p className="cool-text mb-2 text-xs">
              Select the permissions to give this rank.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEPARTMENT_RANK_PERMISSIONS.map((permission) => {
                const checked = permissions.includes(permission.key);
                return (
                  <button
                    type="button"
                    key={permission.key}
                    onClick={() => toggle(permission.key)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      checked
                        ? "border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.07)]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    <span
                      className={`mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-lg border transition-all ${
                        checked
                          ? "border-[var(--accent-peach)] bg-[var(--accent-peach)] text-[#1b1010]"
                          : "border-white/20 bg-white/[0.02]"
                      }`}
                    >
                      {checked ? <IconCheck size={13} stroke={3} /> : null}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/60">
                      {permission.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-[#f5f2f2]">
                        {permission.label}
                      </span>
                      <span className="cool-text block text-[11.5px] leading-4">
                        {permission.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {deleteConfirm ? (
          <div className="border-t border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-5 py-4">
            <p className="text-sm font-bold text-[var(--tone-bad)]">Delete this rank?</p>
            <p className="cool-text mt-1 text-xs">
              Members currently holding it become unranked. The linked Discord role is not deleted.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirm(false)} className="px-3 py-2 text-xs font-semibold text-white/55 hover:text-white">
                Keep rank
              </button>
              <button type="button" onClick={onDelete} className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-3 py-2 text-xs font-bold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)]">
                Delete rank
              </button>
            </div>
          </div>
        ) : (
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-4">
          {initial && onDelete ? (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="mr-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
            >
              <IconTrash size={15} />
              Delete rank
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-white/50 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onSave({
                id: initial?.id || `rank-${Date.now()}`,
                name: name.trim(),
                color,
                role_id: roleId,
                join_rank: joinRank,
                permissions,
              })
            }
            className="btn-pop btn-peach h-9 px-4 text-sm disabled:opacity-50"
          >
            {initial ? "Save rank" : "Create rank"}
          </button>
        </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
