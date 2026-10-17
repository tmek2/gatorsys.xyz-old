"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import { createPortal } from "react-dom";
import {
  IconArrowUp,
  IconArrowDown,
  IconCheck,
  IconChevronDown,
  IconCrown,
  IconDotsVertical,
  IconFilter,
  IconGavel,
  IconFileText,
  IconUserUp,
  IconUserDown,
  IconGripVertical,
  IconLock,
  IconPlus,
  IconSearch,
  IconShield,
  IconStarFilled,
  IconDeviceGamepad2,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { DiscordLogo } from "@/components/brand-icons";
import { useWorkspaceHost } from "../workspace-host";
import { FieldRow, RolePicker, SelectField, SettingsCard } from "../fields";
import { type PointsSystem } from "../department-points";
import { RankEditorModal, type DepartmentRank } from "../department-ranks";
import { MemberAvatar } from "../member-avatar";
import { StatusDot } from "../indicator";
import type { DepartmentProfile, DepartmentRoster, ManagedRole } from "../types";
import { PromotionModal, PunishModal } from "./member-modals";
import {
  Check,
  Feature,
  Subnav,
  formatDuration,
  inputClass,
  parseServerDate,
  timeAgo,
} from "./shared";

/* The Roster tab. */

function OwnerCrown({ owner }: { owner?: string | null }) {
  if (owner !== "server" && owner !== "department" && owner !== "co") return null;
  if (owner === "co")
    return (
      <span
        title="Department co-owner: full management access"
        className="inline-flex items-center text-[var(--accent-peach)]"
      >
        <IconStarFilled size={11} />
      </span>
    );
  return (
    <span
      title={
        owner === "server"
          ? "Server owner: full control of this department"
          : "Department owner: full control of this department"
      }
      className={`inline-flex items-center ${owner === "server" ? "text-[var(--tone-warn)]" : "text-[var(--accent-peach)]"}`}
    >
      <IconCrown size={13} stroke={1.8} />
    </span>
  );
}

export function RosterPage({
  profile,
  roster,
  feature,
  viewerId,
  can = () => true,
  onStage,
  onRefresh,
  onProfile,
  roles,
}: {
  profile: DepartmentProfile;
  roster?: DepartmentRoster;
  feature: Feature;
  viewerId?: string;
  can?: (...allowed: string[]) => boolean;
  onStage: (key: string, value: any) => void;
  onRefresh: () => Promise<void>;
  onProfile: (profile: DepartmentProfile) => void;
  roles: ManagedRole[];
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const canMembers = can("manage_members");
  const canPromote = can("promote", "manage_members");
  const canDemote = can("demote", "manage_members");
  const canInfract = can("issue_infractions");
  const [sub, setSub] = useState("Roster");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rankSyncWarning, setRankSyncWarning] = useState<null | {
    actionName: string;
    roleId?: string;
    memberIds: string[];
    message: string;
  }>(null);
  const [dragRankId, setDragRankId] = useState<string | null>(null);
  // Which row is being dragged.
  const [dragMemberId, setDragMemberId] = useState<string | null>(null);
  /* Pointer drag, because HTML5 drag and drop does not fire for touch. On a
     mouse the drag starts immediately; on touch it waits for a press, so a
     finger moving over the list still scrolls. */
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engagedRef = useRef(false);
  /** Rank section boxes, measured when the drag engages. */
  const rankBoxesRef = useRef<{ id: string; top: number; bottom: number }[]>([]);
  const rosterRef = useRef<HTMLDivElement>(null);
  const dragMemberRef = useRef<string | null>(null);
  const dragRankRef = useRef<string | null>(null);
  dragMemberRef.current = dragMemberId;
  dragRankRef.current = dragRankId;

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);

  const engageDrag = useCallback((memberId: string, x: number, y: number) => {
    engagedRef.current = true;
    rankBoxesRef.current = Array.from(
      rosterRef.current?.querySelectorAll<HTMLElement>("[data-rank-section]") || [],
    ).map((node) => {
      const box = node.getBoundingClientRect();
      return { id: node.dataset.rankSection || "", top: box.top, bottom: box.bottom };
    });
    setDragMemberId(memberId);
    setDragPoint({ x, y });
  }, []);

  const endDrag = useCallback(() => {
    cancelHold();
    engagedRef.current = false;
    dragStartRef.current = null;
    setDragMemberId(null);
    setDragRankId(null);
    setDragPoint(null);
  }, [cancelHold]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterRanks, setFilterRanks] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "loa" | "active" | "inactive">("all");
  const [filterJoined, setFilterJoined] = useState<"any" | "7" | "30" | "90">("any");
  useEffect(() => {
    if (!filterOpen) return;
    const close = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filterOpen]);
  const activeFilterCount =
    (filterRanks.length ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (filterJoined !== "any" ? 1 : 0);
  const [rankEditor, setRankEditor] = useState<DepartmentRank | null | "new">(null);
  const [actionMenu, setActionMenu] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [rowMenuPosition, setRowMenuPosition] = useState({ top: 0, right: 0 });
  // Roster → "View application": a member whose submission we're viewing.
  const [submissionMember, setSubmissionMember] = useState<any | null>(null);
  const [submission, setSubmission] = useState<
    { loading: boolean; found: boolean; data: any } | null
  >(null);
  useEffect(() => {
    if (!submissionMember) {
      setSubmission(null);
      return;
    }
    let cancelled = false;
    setSubmission({ loading: true, found: false, data: null });
    fetch(
      `/api/manage/${guildId}/membersubmission?department=${encodeURIComponent(
        profile.id,
      )}&member=${encodeURIComponent(submissionMember.id)}`,
      { cache: "no-store" },
    )
      .then((response) => (response.ok ? response.json() : { found: false }))
      .then((json) => {
        if (!cancelled)
          setSubmission({
            loading: false,
            found: Boolean(json.found),
            data: json.submission || null,
          });
      })
      .catch(() => {
        if (!cancelled) setSubmission({ loading: false, found: false, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [submissionMember, guildId, profile.id]);
  // Leaving the roster tab dismisses the selection bar and any open row menu.
  useEffect(() => {
    setSelected([]);
    setRowMenuId(null);
    setActionMenu(false);
  }, [sub]);
  const [promotionTargets, setPromotionTargets] = useState<any[] | null>(null);
  const [promotionMode, setPromotionMode] = useState<"promote" | "demote">("promote");
  const [punishTargets, setPunishTargets] = useState<any[] | null>(null);
  /* Which membership request is expanded inline (accept and deny live in the
     expanded row). */
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  // Optimistic rank moves: the row jumps immediately, the API call and the
  // background refresh follow. Reverts on failure.
  const [rankOverrides, setRankOverrides] = useState<Record<string, string>>({});
  // Optimistic roster cell values keyed `${memberId}:${columnId}`, so a
  // checkbox or typed cell updates immediately instead of after save and
  // refetch.
  const [cellOverrides, setCellOverrides] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!actionMenu) return;
    const close = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) setActionMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [actionMenu]);
  const customRanks: DepartmentRank[] = Array.isArray(feature.ranks) ? feature.ranks : [];
  const rosterColumns: any[] = Array.isArray(feature.roster_columns) ? feature.roster_columns : [];
  const ranks = customRanks.length
    ? customRanks
    : (roster?.ranks || []).map((rank) => ({
        id: rank.roleId,
        name: rank.name || "Rank",
        role_id: rank.roleId,
        color: "#f7a8c4",
        permissions: [],
      }));
  /* The department's own ranks in the role picker's shape. `ranks` already
     falls back to the roster's Discord-derived ranks, so this matches the
     filter chips and the rank column. */
  const rankRoleOptions: ManagedRole[] = ranks.map((rank: any) => ({
    id: String(rank.id),
    name: rank.name || "Untitled rank",
    color: rank.color || null,
    position: 0,
    managed: false,
  }));

  /* The viewer's own rank, for per-column locks. From the unfiltered roster, so
     searching does not change what the viewer may edit. */
  const viewerRankId = viewerId
    ? String(
        (roster?.memberRows || []).find(
          (member) => String(member.id) === String(viewerId),
        )?.rankRoleId ?? "",
      )
    : "";

  /* A column with no ranks named is editable by anyone who can edit the roster;
     naming ranks narrows it. Department administrators are never locked out
     (`can()` with no arguments is the admin check). This only decides what to
     show: utils/dashboard_api.py in the bot enforces the same rule on write. */
  const canEditColumn = (column: any) => {
    if (!canMembers) return false;
    const allowed = Array.isArray(column?.roles) ? column.roles.map(String) : [];
    if (!allowed.length || can()) return true;
    return Boolean(viewerRankId) && allowed.includes(viewerRankId);
  };

  const members = (roster?.memberRows || [])
    .map((member) => ({
      ...member,
      rankRoleId: rankOverrides[member.id] ?? member.rankRoleId,
    }))
    .filter((member) =>
      `${member.name} ${member.username} ${member.rankName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter((member) => {
      if (filterRanks.length && !filterRanks.includes(String(member.rankRoleId)))
        return false;
      if (filterStatus === "loa" && !member.onLoa) return false;
      if (filterStatus === "active" && !(member.activitySeconds || 0)) return false;
      if (filterStatus === "inactive" && (member.activitySeconds || 0)) return false;
      if (filterJoined !== "any") {
        if (!member.joinedAt) return false;
        const age = Date.now() - new Date(member.joinedAt).getTime();
        if (age > Number(filterJoined) * 86400_000) return false;
      }
      return true;
    });
  const selectedMembers = members.filter((member) => selected.includes(member.id));
  const activeRowMember = members.find((member) => member.id === rowMenuId) || null;
  // Co-owners cannot manage the owner or fellow co-owners; only the owner
  // (or a server admin, who sees owner="server") can. Mirrors the API guard.
  const departmentOwnerId = String(profile.created_by || "");
  const coOwnerIds = new Set(
    ((profile as any).manager_ids || []).map((id: any) => String(id)),
  );
  const viewerIsCoOwner =
    coOwnerIds.has(String(viewerId || "")) &&
    String(viewerId || "") !== departmentOwnerId;
  const isProtectedMember = (memberId: string) =>
    viewerIsCoOwner &&
    String(memberId) !== String(viewerId || "") &&
    (String(memberId) === departmentOwnerId || coOwnerIds.has(String(memberId)));
  // Fixed edge columns (not `auto`) so every row has identical tracks and the
  // header lines up with the data.
  const gridTemplate = `44px minmax(180px,1fr) 130px 130px 110px${rosterColumns.map(() => " 140px").join("")} 44px`;
  async function resolveRequest(memberId: string, accept: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: accept ? "membership_accept" : "membership_deny",
          department_id: profile.id,
          member_id: memberId,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.detail || "Could not update the request");
      await onRefresh();
      setNotice({ kind: "saved", text: data.message || "Request updated" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not update the request",
      });
    } finally {
      setBusy(false);
    }
  }
  // The drop is committed here: the pointer belongs to the row that captured
  // it, so the section under it never receives an event.
  useEffect(() => {
    if (!dragMemberId && !dragStartRef.current) return;
    const move = (event: PointerEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      if (!engagedRef.current) {
        // Still deciding. A finger that travels before the hold completes is
        // scrolling the roster, not picking a row up.
        const travelled = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (travelled > 10) {
          cancelHold();
          dragStartRef.current = null;
        }
        return;
      }
      event.preventDefault();
      setDragPoint({ x: event.clientX, y: event.clientY });
      const over = rankBoxesRef.current.find(
        (box) => event.clientY >= box.top && event.clientY <= box.bottom,
      );
      setDragRankId(over ? over.id : null);
    };
    const finish = () => {
      const memberId = dragMemberRef.current;
      const rankId = dragRankRef.current;
      if (engagedRef.current && memberId && rankId) {
        // Move the row instantly, then let the API catch up — same as the
        // old drop handler did.
        setRankOverrides((current) => ({ ...current, [memberId]: String(rankId) }));
        void action("rank", String(rankId), [memberId], { optimistic: true });
      }
      endDrag();
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", endDrag);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragMemberId, cancelHold, endDrag]);

  async function action(
    actionName: string,
    roleId?: string,
    memberIds = selected,
    options: { optimistic?: boolean; ignoreDiscordRoleSync?: boolean } = {},
  ) {
    if (!memberIds.length) return;
    if (!options.optimistic) setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionName,
          department_id: profile.id,
          member_ids: memberIds,
          role_id: roleId,
          ignore_discord_role_sync: Boolean(options.ignoreDiscordRoleSync),
        }),
      });
      const data = await response.json();
      if (
        response.status === 409 &&
        data.detail &&
        typeof data.detail === "object" &&
        data.detail.code === "discord_role_sync_unavailable"
      ) {
        if (localStorage.getItem(`gator-role-sync-skip-${guildId}`)) {
          // The manager opted out of this reminder — continue website-only.
          void action(actionName, roleId, memberIds, {
            ...options,
            ignoreDiscordRoleSync: true,
          });
          return;
        }
        setRankSyncWarning({
          actionName,
          roleId,
          memberIds,
          message:
            data.detail.message || "Gator cannot update the linked Discord role.",
        });
        return;
      }
      if (!response.ok) {
        const detail =
          typeof data.detail === "string" ? data.detail : data.detail?.message;
        throw new Error(detail || data.message || "Action failed");
      }
      setSelected([]);
      void onRefresh().then(() => setRankOverrides({}));
      const message = String(data.message || "Department roster updated");
      if (!message.toLowerCase().startsWith("no changes")) {
        setNotice({ kind: "saved", text: message });
      }
    } catch (error) {
      setRankOverrides({});
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Action failed",
      });
    } finally {
      if (!options.optimistic) setBusy(false);
    }
  }
  async function saveCell(memberId: string, columnId: string, value: any) {
    const key = `${memberId}:${columnId}`;
    // Reflect the change instantly; reconcile with the server in the background.
    setCellOverrides((current) => ({ ...current, [key]: value }));
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "roster_cell",
          department_id: profile.id,
          member_id: memberId,
          column_id: columnId,
          value,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Could not save the column value");
      }
      await onRefresh();
      setCellOverrides((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch (error) {
      setCellOverrides((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not save the column value",
      });
    }
  }
  function stageRanks(next: DepartmentRank[]) {
    onStage("ranks", next);
    const joinRole = next.find((item) => item.join_rank)?.role_id || null;
    const rankRoles = Array.from(
      new Set(next.map((item) => item.role_id).filter(Boolean) as string[]),
    );
    onProfile({ ...profile, join_role_id: joinRole, rank_roles: rankRoles });
  }
  function saveRank(rank: DepartmentRank) {
    let next =
      rankEditor === "new"
        ? [...customRanks, rank]
        : customRanks.map((item) => (item.id === rank.id ? rank : item));
    if (rank.join_rank)
      next = next.map((item) => ({ ...item, join_rank: item.id === rank.id }));
    stageRanks(next);
    setRankEditor(null);
  }
  function deleteRank(rankId: string) {
    stageRanks(customRanks.filter((item) => String(item.id) !== String(rankId)));
    setRankEditor(null);
    setNotice({
      kind: "saved",
      text: "Rank removed. Members assigned to it will appear as unranked after saving.",
    });
  }
  function moveRank(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= customRanks.length) return;
    const next = [...customRanks];
    [next[index], next[target]] = [next[target], next[index]];
    onStage("ranks", next);
  }
  const requests = roster?.membershipRequests || [];
  const subnavItems = canMembers
    ? ["Roster", "Membership Requests", "Activity Dashboard", "Roster Settings"]
    : ["Roster", "Activity Dashboard"];
  const performActions = [
    canPromote
      ? {
          label: "Promote",
          icon: <IconUserUp size={15} />,
          run: () => {
            setPromotionMode("promote");
            setPromotionTargets(selectedMembers);
          },
        }
      : null,
    canDemote
      ? {
          label: "Demote",
          icon: <IconUserDown size={15} />,
          run: () => {
            setPromotionMode("demote");
            setPromotionTargets(selectedMembers);
          },
        }
      : null,
    canInfract
      ? {
          label: "Infract",
          icon: <IconGavel size={15} />,
          run: () => setPunishTargets(selectedMembers),
        }
      : null,
    selectedMembers.length === 1
      ? {
          label: "View Discord Profile",
          icon: <DiscordLogo size={15} />,
          run: () =>
            window.open(
              `https://discord.com/users/${selectedMembers[0].id}`,
              "_blank",
              "noopener,noreferrer",
            ),
        }
      : null,
    canMembers
      ? {
          label: "Remove from department",
          icon: <IconTrash size={15} />,
          danger: true,
          run: () => void action("remove"),
        }
      : null,
  ].filter(Boolean) as { label: string; icon: React.ReactNode; run: () => void; danger?: boolean }[];
  return (
    <div className="space-y-4">
      <Subnav
        items={subnavItems}
        value={sub}
        onChange={setSub}
        counts={{ "Membership Requests": requests.length }}
      />
      {sub === "Roster Settings" && canMembers ? (
        <SettingsCard
          title="Custom roster columns"
          description="Add fields to the roster for supervisors, dates, times, checkboxes, and shift activity."
          actions={
            <button
              type="button"
              onClick={() =>
                onStage("roster_columns", [
                  ...rosterColumns,
                  { id: crypto.randomUUID(), name: "New column", type: "text" },
                ])
              }
              className="btn-pop btn-peach inline-flex items-center gap-2 px-3 py-2 text-xs"
            >
              <IconPlus size={14} />
              Create new
            </button>
          }
        >
          <div className="space-y-3">
            {rosterColumns.map((column: any, index: number) => {
              const patch = (changes: Record<string, any>) =>
                onStage(
                  "roster_columns",
                  rosterColumns.map((item: any, i: number) =>
                    i === index ? { ...item, ...changes } : item,
                  ),
                );
              // Shift activity is computed from logged shifts, so there is no
              // cell to type in and nothing for a rank lock to gate.
              const editable = column.type !== "shift_activity";
              return (
                <div
                  key={column.id}
                  className="space-y-2 rounded-xl border border-white/[0.08] p-3"
                >
                  <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
                    <input
                      value={column.name}
                      onChange={(event) => patch({ name: event.target.value })}
                      className={inputClass}
                    />
                    <SelectField
                      value={column.type}
                      onChange={(value) => patch({ type: value || "text" })}
                      options={[
                        { value: "text", label: "Text" },
                        { value: "checkbox", label: "Checkbox" },
                        { value: "date", label: "Date" },
                        { value: "time", label: "Time" },
                        { value: "shift_activity", label: "Shift Type Activity" },
                      ]}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onStage(
                          "roster_columns",
                          rosterColumns.filter((_: any, i: number) => i !== index),
                        )
                      }
                      className="p-2 text-white/30 hover:text-[var(--tone-bad)]"
                      aria-label="Remove column"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                  {editable ? (
                    <FieldRow
                      label="Who can edit this column"
                      description={
                        column.roles?.length
                          ? "Only these department ranks can change this column. Department administrators always can."
                          : "Anyone who can edit the roster. Pick ranks to narrow it."
                      }
                    >
                      {/* Department ranks, not Discord roles: a roster column
                         belongs to the department. */}
                      <RolePicker
                        multi
                        roles={rankRoleOptions}
                        value={Array.isArray(column.roles) ? column.roles : []}
                        onChange={(next) =>
                          patch({ roles: Array.isArray(next) ? next : [] })
                        }
                        placeholder="Anyone who can edit the roster"
                      />
                    </FieldRow>
                  ) : null}
                </div>
              );
            })}
            {!rosterColumns.length ? (
              <p className="cool-text py-6 text-center text-sm">
                No custom columns yet. They appear on the roster next to Points.
              </p>
            ) : null}
          </div>
        </SettingsCard>
      ) : null}
      {sub === "Membership Requests" && canMembers ? (
        <SettingsCard
          title="Membership requests"
          description="Members who redeemed the join code wait here until someone accepts them."
        >
          {/* The row expands in place to show the answers, integrity flags and
             the two decisions together. */}
          {requests.map((request) => {
            const application = (request as any).application;
            const expanded = expandedRequest === String(request.id);
            const isSelf = String(request.id) === String(viewerId);
            return (
              <div
                key={request.id}
                className="border-b border-white/[0.08] last:border-0"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedRequest(expanded ? null : String(request.id))
                  }
                  aria-expanded={expanded}
                  className="flex w-full flex-wrap items-center gap-3 py-3 text-left"
                >
                  <MemberAvatar
                    src={request.avatar}
                    name={request.name}
                    className="h-9 w-9"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white/80">
                      {request.name}
                    </span>
                    <span className="cool-text block truncate text-[11px]">
                      @{request.username}
                      {request.requestedAt
                        ? ` · requested ${parseServerDate(request.requestedAt).toLocaleDateString()}`
                        : ""}
                    </span>
                  </span>
                  {isSelf ? (
                    <span className="cool-text shrink-0 text-xs">
                      Your own request
                    </span>
                  ) : null}
                  <IconChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`shrink-0 text-white/35 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                {/* grid-rows 0fr -> 1fr: it opens rather than appearing. */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${expanded ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    {application ? (
                      <div className="space-y-2">
                        {Object.entries(application.answers || {}).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3"
                            >
                              <p className="text-xs font-bold text-white/60">
                                {application.questions?.[key] || "Answer"}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/80">
                                {String(value)}
                              </p>
                            </div>
                          ),
                        )}
                        {application.appeal_case_id ? (
                          /* Shows which case an appeal is about. */
                          <div className="rounded-xl border border-[var(--tone-info-line)] bg-[var(--tone-info-soft)] p-3">
                            <p className="text-xs font-bold text-[var(--tone-info)]">
                              Appealing case
                            </p>
                            <p className="mt-1 font-mono text-sm text-[var(--tone-info)]">
                              {String(application.appeal_case_id)}
                            </p>
                          </div>
                        ) : null}
                        {(application.integrity?.flags || []).length ? (
                          <div className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] p-3">
                            <p className="text-xs font-bold text-[var(--tone-bad)]">
                              Integrity check
                            </p>
                            {(application.integrity.flags || []).map(
                              (flag: string, index: number) => (
                                <p
                                  key={index}
                                  className="mt-1 text-xs text-[var(--tone-bad)]"
                                >
                                  ⚠ {flag}
                                </p>
                              ),
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="cool-text rounded-xl border border-dashed border-white/[0.08] p-3 text-xs">
                        They joined with the code rather than an application, so
                        there is nothing to read here.
                      </p>
                    )}
                    {isSelf ? null : (
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resolveRequest(request.id, false)}
                          className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)] disabled:opacity-40"
                        >
                          Deny
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resolveRequest(request.id, true)}
                          className="btn-pop btn-peach inline-flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-40"
                        >
                          <IconCheck size={14} />
                          Accept
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!requests.length ? (
            <p className="cool-text py-10 text-center text-sm">No pending membership requests.</p>
          ) : null}
        </SettingsCard>
      ) : null}
      {sub === "Activity Dashboard" ? (
        <SettingsCard
          title="Roster activity dashboard"
          description="Compare activity, membership age, and points across every rank."
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-xl font-bold">{roster?.members || 0}</p>
              <p className="cool-text text-xs">Members</p>
            </div>
            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-xl font-bold">{roster?.onLoa || 0}</p>
              <p className="cool-text text-xs">On leave</p>
            </div>
            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-xl font-bold">
                {(
                  (roster?.memberRows || []).reduce(
                    (total, member) => total + (member.activitySeconds || 0),
                    0,
                  ) /
                  3600 /
                  Math.max(1, roster?.memberRows?.length || 0)
                ).toFixed(1)}
                h
              </p>
              <p className="cool-text text-xs">Average activity this wave</p>
            </div>
          </div>
        </SettingsCard>
      ) : null}
      {sub === "Roster" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3">
                <IconSearch size={15} className="text-white/30" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search roster"
                  className="w-40 bg-transparent text-sm text-white outline-none placeholder:text-white/25 sm:w-48"
                />
              </label>
              <div ref={filterRef} className="relative">
                <button
                  type="button"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${activeFilterCount ? "border-[var(--accent-peach)]/45 bg-[color-mix(in_srgb,var(--accent-peach)_7%,transparent)] text-[var(--accent-peach)]" : "border-white/[0.08] hover:border-[var(--accent-peach)]/25 text-white/55 hover:text-white"}`}
                >
                  <IconFilter size={14} />
                  Filter
                  {activeFilterCount ? (
                    <span className="rounded-full bg-[var(--accent-peach)] px-2 text-[10px] font-bold text-[#1b1010]">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
                {filterOpen ? (
                  <div className="absolute left-0 top-11 z-40 w-72 rounded-2xl border border-white/[0.08] bg-[#131415] p-4 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
                    <p className="cool-text text-[10px] font-bold uppercase tracking-[0.12em]">
                      Ranks
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ranks.map((rank) => (
                        <button
                          key={rank.id}
                          type="button"
                          onClick={() =>
                            setFilterRanks((current) =>
                              current.includes(String(rank.id))
                                ? current.filter((id) => id !== String(rank.id))
                                : [...current, String(rank.id)],
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${filterRanks.includes(String(rank.id)) ? "border-[var(--accent-peach)]/60 bg-[color-mix(in_srgb,var(--accent-peach)_10%,transparent)] text-[var(--accent-peach)]" : "border-white/[0.08] hover:border-[var(--accent-peach)]/25 text-white/55 hover:text-white"}`}
                        >
                          {rank.name}
                        </button>
                      ))}
                    </div>
                    <p className="cool-text mt-3 text-[10px] font-bold uppercase tracking-[0.12em]">
                      Status
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(
                        [
                          ["all", "Everyone"],
                          ["active", "Active this wave"],
                          ["inactive", "No activity"],
                          ["loa", "On LOA"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setFilterStatus(id)}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${filterStatus === id ? "border-[var(--accent-peach)]/60 bg-[color-mix(in_srgb,var(--accent-peach)_10%,transparent)] text-[var(--accent-peach)]" : "border-white/[0.08] hover:border-[var(--accent-peach)]/25 text-white/55 hover:text-white"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="cool-text mt-3 text-[10px] font-bold uppercase tracking-[0.12em]">
                      Joined
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(
                        [
                          ["any", "Any time"],
                          ["7", "Last 7 days"],
                          ["30", "Last 30 days"],
                          ["90", "Last 90 days"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setFilterJoined(id)}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${filterJoined === id ? "border-[var(--accent-peach)]/60 bg-[color-mix(in_srgb,var(--accent-peach)_10%,transparent)] text-[var(--accent-peach)]" : "border-white/[0.08] hover:border-[var(--accent-peach)]/25 text-white/55 hover:text-white"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {activeFilterCount ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterRanks([]);
                          setFilterStatus("all");
                          setFilterJoined("any");
                        }}
                        className="mt-3 w-full rounded-xl border border-white/[0.08] py-2 text-xs font-semibold text-white/55 hover:text-white"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="cool-text hidden items-center gap-3 text-xs sm:inline-flex">
                <span className="inline-flex items-center gap-2">
                  <StatusDot tone="ok" />
                  {members.length} active
                </span>
              </span>
              {canMembers ? (
                <button
                  type="button"
                  onClick={() => setRankEditor("new")}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white"
                >
                  <IconPlus size={14} />
                  Create Rank
                </button>
              ) : null}
            </div>
          </div>
          <div className="space-y-4" ref={rosterRef}>
            {ranks.map((rank, rankIndex) => {
              const rankMembers = members.filter(
                (member) => member.rankRoleId === String(rank.id),
              );
              return (
                <section
                  key={rank.id}
                  // Measured on drag start and hit-tested against the pointer;
                  // the drop is committed by the row that captured the pointer
                  // (see the drag effect above).
                  data-rank-section={String(rank.id)}
                  // While a row from this section is dragged: `overflow-x-auto`
                  // (for the wide table on narrow screens) would clip the
                  // lifted row, and sections paint in document order regardless
                  // of the row's z-index, so this section is lifted for the
                  // duration.
                  className={`rounded-2xl border bg-white/[0.012] p-3 transition-[border-color,background-color] duration-150 ${
                    rankMembers.some((member) => member.id === dragMemberId)
                      ? "relative z-40 overflow-visible"
                      : "overflow-x-auto"
                  } ${dragRankId === rank.id ? "border-[var(--accent-peach)]/70 bg-[color-mix(in_srgb,var(--accent-peach)_6%,transparent)]" : "border-white/[0.08]"}`}
                >
                  {/* Column labels are visually shown once, on the first
                     section. They stay in the DOM in every section because each
                     scrolls horizontally on its own, and screen readers keep
                     them all. */}
                  <div
                    className={`roster-head grid min-w-[720px] items-center gap-3 border-b border-white/[0.08] px-1 pb-2 text-xs transition-opacity ${
                      rankIndex === 0 ? "text-white/35" : "text-white/[0.14]"
                    }`}
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    <Check
                      label={`Select all in ${rank.name}`}
                      checked={
                        rankMembers.length > 0 &&
                        rankMembers.every((member) => selected.includes(member.id))
                      }
                      onChange={(next) =>
                        setSelected(
                          next
                            ? Array.from(
                                new Set([
                                  ...selected,
                                  ...rankMembers
                                    .filter(
                                      (member) =>
                                        String(member.id) !== String(viewerId) &&
                                        !isProtectedMember(member.id),
                                    )
                                    .map((member) => member.id),
                                ]),
                              )
                            : selected.filter(
                                (id) => !rankMembers.some((member) => member.id === id),
                              ),
                        )
                      }
                    />
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => canMembers && setRankEditor(rank)}
                        className="flex items-center gap-2 text-left text-sm font-bold text-white/80"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: rank.color || "#f7a8c4" }}
                        />
                        {rank.name}
                        <span className="cool-text text-[10px] font-semibold">
                          {rankMembers.length}
                        </span>
                      </button>
                      {canMembers && customRanks.length > 1 ? (
                        <span className="ml-1 inline-flex opacity-0 transition-opacity group-hover:opacity-100 [section:hover_&]:opacity-100">
                          <button
                            type="button"
                            disabled={rankIndex === 0}
                            onClick={() => moveRank(rankIndex, -1)}
                            className="rounded p-1 text-white/30 hover:text-white disabled:opacity-20"
                            aria-label={`Move ${rank.name} up`}
                          >
                            <IconArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={rankIndex === customRanks.length - 1}
                            onClick={() => moveRank(rankIndex, 1)}
                            className="rounded p-1 text-white/30 hover:text-white disabled:opacity-20"
                            aria-label={`Move ${rank.name} down`}
                          >
                            <IconArrowDown size={13} />
                          </button>
                        </span>
                      ) : null}
                    </span>
                    <span data-roster-caption className="text-center">Activity</span>
                    <span data-roster-caption className="text-center">Member Since</span>
                    <span data-roster-caption className="text-center">Points</span>
                    {rosterColumns.map((column: any) => {
                      // A column you cannot edit should say so in the header
                      // rather than only refusing to respond when you click it.
                      const locked =
                        canMembers &&
                        column.type !== "shift_activity" &&
                        !canEditColumn(column);
                      return (
                        <span
                          key={column.id}
                          data-roster-caption
                          title={
                            locked
                              ? `${column.name} can only be edited by specific department ranks.`
                              : undefined
                          }
                          className="flex min-w-0 items-center justify-center gap-1"
                        >
                          <span className="truncate">{column.name}</span>
                          {locked ? (
                            <IconLock size={11} className="shrink-0 opacity-50" />
                          ) : null}
                        </span>
                      );
                    })}
                    <span data-roster-caption />
                  </div>
                  {rankMembers.map((member) => {
                    const isSelf = String(member.id) === String(viewerId);
                    return (
                      <div
                        key={member.id}
                        onPointerDown={(event) => {
                          if (!canMembers || isProtectedMember(member.id)) return;
                          // Left button only; a right-click is a context menu.
                          if (event.pointerType === "mouse" && event.button !== 0) return;
                          dragStartRef.current = { x: event.clientX, y: event.clientY };
                          event.currentTarget.setPointerCapture?.(event.pointerId);
                          if (event.pointerType === "mouse") {
                            engageDrag(member.id, event.clientX, event.clientY);
                          } else {
                            // Touch: hold to pick up, so an ordinary swipe
                            // still scrolls the roster.
                            const { clientX, clientY } = event;
                            holdTimerRef.current = setTimeout(
                              () => engageDrag(member.id, clientX, clientY),
                              350,
                            );
                          }
                        }}
                        onPointerUp={cancelHold}
                        className={`roster-row grid min-w-[720px] items-center gap-3 border-b border-white/[0.045] px-1 py-3 last:border-0 ${canMembers ? "cursor-grab touch-none select-none active:cursor-grabbing" : ""} ${
                          dragMemberId === member.id
                            ? // The lifted row, styled here instead of the
                            // browser's drag image.
                              "pointer-events-none relative z-30 rounded-xl bg-[#171717] opacity-95 shadow-[0_14px_36px_rgba(0,0,0,0.5)] ring-1 ring-[var(--accent-peach)]/50"
                            : ""
                        }`}
                        style={{
                          gridTemplateColumns: gridTemplate,
                          ...(dragMemberId === member.id && dragPoint
                            ? {
                                transform: `translateY(${
                                  dragPoint.y - (dragStartRef.current?.y ?? dragPoint.y)
                                }px)`,
                              }
                            : {}),
                        }}
                      >
                        {/* Generous select zone: clicking anywhere around the
                            box toggles it, and dragging never starts here. */}
                        <div
                          role="checkbox"
                          aria-checked={selected.includes(member.id)}
                          aria-label={`Select ${member.name}`}
                          tabIndex={isSelf || isProtectedMember(member.id) ? -1 : 0}
                          // Stops the row's drag from starting when ticking the
                          // checkbox.
                          onPointerDown={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key !== " " && event.key !== "Enter") return;
                            event.preventDefault();
                            if (isSelf || isProtectedMember(member.id)) return;
                            setSelected(
                              selected.includes(member.id)
                                ? selected.filter((id) => id !== member.id)
                                : [...selected, member.id],
                            );
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (isSelf || isProtectedMember(member.id)) return;
                            setSelected(
                              selected.includes(member.id)
                                ? selected.filter((id) => id !== member.id)
                                : [...selected, member.id],
                            );
                          }}
                          className={`roster-select -my-3 -ml-1 flex items-center self-stretch py-3 pl-1 pr-3 ${isSelf || isProtectedMember(member.id) ? "" : "cursor-pointer"}`}
                        >
                          <span className="pointer-events-none">
                            <Check
                              label={`Select ${member.name}`}
                              checked={selected.includes(member.id)}
                              disabled={isSelf || isProtectedMember(member.id)}
                              onChange={() => undefined}
                            />
                          </span>
                        </div>
                        <div className="roster-identity flex min-w-0 items-center gap-2">
                          {canMembers ? (
                            <IconGripVertical size={14} className="shrink-0 text-white/20" />
                          ) : null}
                          <MemberAvatar
                            src={member.avatar}
                            name={member.name}
                            className="h-8 w-8"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-white/80">
                                {member.name}
                              </span>
                              <OwnerCrown owner={(member as any).owner} />
                              {isSelf ? (
                                <span className="rounded bg-white/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/50">
                                  You
                                </span>
                              ) : null}
                              {member.onLoa ? (
                                <span className="rounded bg-[var(--tone-warn-soft)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tone-warn)]">
                                  LOA
                                </span>
                              ) : null}
                            </span>
                            <span className="cool-text block truncate text-[11px]">
                              @{member.username}
                            </span>
                          </span>
                        </div>
                        <span
                          data-roster-cell
                          data-label="Activity"
                          className="cool-text flex items-center justify-center gap-2 text-xs"
                        >
                          {/* No time logged this wave is neutral, not an error;
                             green marks time logged. */}
                          {(member.activitySeconds || 0) > 0 ? (
                            <IconCheck size={13} className="text-[var(--tone-ok)]" />
                          ) : (
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 rounded-full bg-white/20"
                            />
                          )}
                          <span
                            className={
                              (member.activitySeconds || 0) > 0 ? "" : "text-white/30"
                            }
                          >
                            {(member.activitySeconds || 0) > 0
                              ? formatDuration(member.activitySeconds || 0)
                              : "No time yet"}
                          </span>
                        </span>
                        <span
                          data-roster-cell
                          data-label="Member since"
                          className="cool-text text-center text-xs"
                        >
                          {member.joinedAt
                            ? timeAgo(member.joinedAt)
                            : "Unknown"}
                        </span>
                        {/* No `data-label`: the pill already says what it is. */}
                        <span data-roster-cell className="flex justify-center">
                          <span
                            className={`inline-block rounded-xl px-2 py-1 text-[10px] font-bold ${!member.points ? "bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]" : member.points < 4 ? "bg-[var(--tone-warn-soft)] text-[var(--tone-warn)]" : "bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]"}`}
                          >
                            {member.points || 0} POINTS ·{" "}
                            {!member.points ? "GREAT" : member.points < 4 ? "WATCH" : "AT RISK"}
                          </span>
                        </span>
                        {rosterColumns.map((column: any) => {
                          const overrideKey = `${member.id}:${column.id}`;
                          const value =
                            overrideKey in cellOverrides
                              ? cellOverrides[overrideKey]
                              : (member as any).columns?.[column.id];
                          // Per-column rank lock, on top of manage_members.
                          const canEdit = canEditColumn(column);
                          const lockedTitle = canMembers && !canEdit
                            ? `${column.name} can only be edited by specific department ranks.`
                            : undefined;
                          if (column.type === "checkbox")
                            return (
                              // Whole-cell hit zone: clicking anywhere in the
                              // column toggles it, like the left select box.
                              <button
                                key={column.id}
                                type="button"
                                disabled={!canEdit}
                                title={lockedTitle}
                                onClick={() =>
                                  canEdit &&
                                  void saveCell(member.id, column.id, !value)
                                }
                                aria-label={column.name}
                                aria-pressed={Boolean(value)}
                                data-roster-cell
                                data-label={column.name}
                                className="-my-2.5 flex h-[calc(100%+1.25rem)] cursor-pointer items-center justify-center disabled:cursor-default"
                              >
                                {/* Display-only inside the full-cell hit zone
                                    so the click doesn't double-toggle. */}
                                <span className="pointer-events-none">
                                  <Check
                                    label={column.name}
                                    checked={Boolean(value)}
                                    disabled={!canEdit}
                                    onChange={() => undefined}
                                  />
                                </span>
                              </button>
                            );
                          if (column.type === "shift_activity")
                            return (
                              <span
                                key={column.id}
                                data-roster-cell
                                data-label={column.name}
                                className="cool-text text-center text-xs"
                              >
                                {formatDuration(member.activitySeconds || 0)}
                              </span>
                            );
                          if (!canEdit)
                            return (
                              <span
                                key={column.id}
                                title={lockedTitle}
                                data-roster-cell
                                data-label={column.name}
                                className="cool-text truncate text-center text-xs"
                              >
                                {String(value ?? "")}
                              </span>
                            );
                          return (
                            <input
                              key={column.id}
                              data-roster-cell
                              data-label={column.name}
                              aria-label={column.name}
                              placeholder={column.name}
                              type={column.type === "date" ? "date" : column.type === "time" ? "time" : "text"}
                              defaultValue={String(value ?? "")}
                              onBlur={(event) => {
                                if (event.target.value !== String(value ?? ""))
                                  void saveCell(member.id, column.id, event.target.value);
                              }}
                              className="h-8 w-full rounded-xl border border-transparent bg-transparent px-2 text-center text-xs text-white/70 outline-none [color-scheme:dark] hover:border-white/[0.08] focus:border-[var(--accent-peach)]/40 focus:bg-white/[0.02]"
                            />
                          );
                        })}
                        <div className="roster-actions relative flex justify-end">
                          <button
                            type="button"
                            onClick={(event) => {
                              if (rowMenuId === member.id) {
                                setRowMenuId(null);
                                return;
                              }
                              const rect = event.currentTarget.getBoundingClientRect();
                              setRowMenuPosition({
                                top: Math.min(rect.bottom + 6, window.innerHeight - 178),
                                right: Math.max(8, window.innerWidth - rect.right),
                              });
                              setRowMenuId(member.id);
                            }}
                            className="rounded-xl p-2 text-white/30 hover:bg-white/[0.06] hover:text-white"
                            aria-label={`Actions for ${member.name}`}
                          >
                            <IconDotsVertical size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Where the drag lands: rows inside a rank are sorted by
                     name, so a drag only chooses the group. The indicator sits
                     at the foot of the hovered group and names it, hidden when
                     the row is already in that group. */}
                  {dragRankId === rank.id &&
                  dragMemberId &&
                  !rankMembers.some((row) => row.id === dragMemberId) ? (
                    <div className="roster-drop-hint" aria-hidden="true">
                      <span
                        className="roster-drop-dot"
                        style={{ backgroundColor: rank.color || "#f7a8c4" }}
                      />
                      Move to {rank.name}
                    </div>
                  ) : null}
                  {!rankMembers.length ? (
                    <p className="cool-text py-5 text-center text-xs">
                      {canMembers
                        ? "Drop members here to assign this rank."
                        : "No members hold this rank yet."}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        </>
      ) : null}
      {activeRowMember
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close member actions"
                className="fixed inset-0 z-[119] cursor-default"
                onClick={() => setRowMenuId(null)}
              />
              <div
                className="fixed z-[120] w-48 rounded-xl border border-white/[0.08] bg-[#0e0e0e] p-2 shadow-[0_18px_55px_rgba(0,0,0,.72)]"
                style={{ top: rowMenuPosition.top, right: rowMenuPosition.right }}
              >
                <a
                  href={`https://discord.com/users/${activeRowMember.id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setRowMenuId(null)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
                >
                  <DiscordLogo size={14} />
                  View Discord profile
                </a>
                {(activeRowMember as any).robloxId ? (
                  <a
                    href={`https://www.roblox.com/users/${(activeRowMember as any).robloxId}/profile`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setRowMenuId(null)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
                  >
                    <IconDeviceGamepad2 size={14} />
                    View Roblox profile
                  </a>
                ) : null}
                {canMembers ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRowMenuId(null);
                      setSubmissionMember(activeRowMember);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
                  >
                    <IconFileText size={14} />
                    View application
                  </button>
                ) : null}
                {canPromote &&
                String(activeRowMember.id) !== String(viewerId) &&
                !isProtectedMember(activeRowMember.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRowMenuId(null);
                      setPromotionMode("promote");
                      setPromotionTargets([activeRowMember]);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
                  >
                    <IconUserUp size={14} />
                    Promote
                  </button>
                ) : null}
                {canDemote &&
                String(activeRowMember.id) !== String(viewerId) &&
                !isProtectedMember(activeRowMember.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRowMenuId(null);
                      setPromotionMode("demote");
                      setPromotionTargets([activeRowMember]);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
                  >
                    <IconUserDown size={14} />
                    Demote
                  </button>
                ) : null}
                {canInfract &&
                String(activeRowMember.id) !== String(viewerId) &&
                !isProtectedMember(activeRowMember.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRowMenuId(null);
                      setPunishTargets([activeRowMember]);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
                  >
                    <IconGavel size={14} />
                    Infract
                  </button>
                ) : null}
                {canMembers &&
                String(activeRowMember.id) !== String(viewerId) &&
                !isProtectedMember(activeRowMember.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRowMenuId(null);
                      void action("remove", undefined, [activeRowMember.id]);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-soft)]"
                  >
                    <IconTrash size={14} />
                    Remove
                  </button>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
      {selected.length && performActions.length ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex h-11 min-w-[340px] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/[0.08] bg-[#131415]/95 pl-5 pr-2 shadow-[0_18px_60px_rgba(0,0,0,.65)] backdrop-blur">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/80">
            <IconUsers size={14} className="text-[var(--accent-peach)]" />
            {selected.length} selected
          </span>
          <span className="ml-auto h-5 w-px bg-white/[0.1]" />
          <button
            type="button"
            onClick={() => setSelected([])}
            className="inline-flex h-8 items-center rounded-xl px-4 text-xs font-semibold text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            Cancel
          </button>
          <div ref={actionMenuRef} className="relative">
            <button
              type="button"
              disabled={busy}
              onClick={() => setActionMenu(!actionMenu)}
              className="inline-flex h-8 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-xs font-bold text-white/85 transition-colors hover:border-[var(--accent-peach)]/35 hover:bg-white/[0.06] disabled:opacity-40"
            >
              Perform action
              <IconChevronDown
                size={12}
                className={`transition-transform ${actionMenu ? "rotate-180" : ""}`}
              />
            </button>
            {actionMenu ? (
              <div className="absolute bottom-10 right-0 w-56 rounded-xl border border-white/[0.08] bg-[#131415] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
                {performActions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setActionMenu(false);
                      item.run();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold ${item.danger ? "text-[var(--tone-bad)] hover:bg-[var(--tone-bad-soft)]" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {rankEditor ? (
        <RankEditorModal
          initial={rankEditor === "new" ? null : rankEditor}
          roles={roles}
          currentJoinRankName={
            customRanks.find(
              (rank) =>
                rank.join_rank &&
                (rankEditor === "new" || rank.id !== rankEditor.id),
            )?.name || null
          }
          onSave={saveRank}
          onDelete={
            rankEditor === "new"
              ? undefined
              : () => deleteRank(String(rankEditor.id))
          }
          onClose={() => setRankEditor(null)}
        />
      ) : null}
      {promotionTargets ? (
        <PromotionModal
          targets={promotionTargets}
          ranks={customRanks.map((rank) => ({ id: String(rank.id), name: rank.name }))}
          profileId={profile.id}
          mode={promotionMode}
          onClose={() => setPromotionTargets(null)}
          onDone={onRefresh}
        />
      ) : null}
      {punishTargets ? (
        <PunishModal
          targets={punishTargets}
          profileId={profile.id}
          stages={(feature.points_system as PointsSystem | undefined)?.stages || []}
          onClose={() => setPunishTargets(null)}
          onDone={onRefresh}
        />
      ) : null}
      {submissionMember
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[150] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                onClick={() => setSubmissionMember(null)}
                aria-label="Close"
              />
              <div className="relative max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
                <div className="flex items-center gap-3">
                  {submissionMember.avatar ? (
                    <img
                      src={discordAvatarUrl(submissionMember.avatar) || ""}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="h-10 w-10 rounded-full bg-white/[0.06]" />
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-white">
                      {submissionMember.name}
                    </h3>
                    <p className="cool-text truncate text-xs">
                      {submission?.data?.title || "Application submission"}
                      {submission?.data?.submittedAt
                        ? ` · ${parseServerDate(submission.data.submittedAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmissionMember(null)}
                    className="ml-auto p-2 text-white/35 hover:text-white"
                    aria-label="Close"
                  >
                    <IconX size={16} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {submission?.loading ? (
                    <p className="cool-text text-sm">Loading submission…</p>
                  ) : !submission?.found ? (
                    <p className="cool-text text-sm">
                      No application submission on file for this member.
                    </p>
                  ) : (
                    Object.entries(submission.data?.answers || {}).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3"
                        >
                          <p className="text-xs font-bold text-white/60">
                            {submission.data?.questions?.[key] || "Answer"}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/80">
                            {String(value)}
                          </p>
                        </div>
                      ),
                    )
                  )}
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSubmissionMember(null)}
                    className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-semibold text-white/65 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {rankSyncWarning
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[180] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                onClick={() => {
                  setRankSyncWarning(null);
                  setRankOverrides({});
                }}
                aria-label="Cancel rank update"
              />
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e0e] shadow-2xl">
                <div className="border-b border-[var(--tone-warn-line)] bg-[radial-gradient(circle_at_15%_0%,rgba(252,211,77,.12),transparent_60%)] px-6 pb-4 pt-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tone-warn-wash)] text-[var(--tone-warn)]">
                    <IconShield size={19} />
                  </span>
                  <h3 className="mt-3 text-base font-extrabold text-white">
                    Discord role could not be updated
                  </h3>
                  <p className="cool-text mt-2 text-sm leading-6">
                    {rankSyncWarning.message} You can continue with the website
                    rank only; the member&apos;s Discord roles will stay
                    unchanged.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem(`gator-role-sync-skip-${guildId}`, "1");
                      const pending = rankSyncWarning;
                      setRankSyncWarning(null);
                      void action(
                        pending.actionName,
                        pending.roleId,
                        pending.memberIds,
                        { ignoreDiscordRoleSync: true },
                      );
                    }}
                    className="px-0 py-2 text-xs font-semibold text-white/45 transition-colors hover:text-white"
                  >
                    Don&apos;t remind me again
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRankSyncWarning(null);
                        setRankOverrides({});
                      }}
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-white/55 transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const pending = rankSyncWarning;
                        setRankSyncWarning(null);
                        void action(
                          pending.actionName,
                          pending.roleId,
                          pending.memberIds,
                          { ignoreDiscordRoleSync: true },
                        );
                      }}
                      className="btn-pop btn-peach px-4 py-2 text-sm disabled:opacity-40"
                    >
                      Continue without Discord role
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
