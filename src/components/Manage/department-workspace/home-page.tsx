"use client";

import React, { useEffect, useRef, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import { createPortal } from "react-dom";
import {
  IconArrowBackUp,
  IconBook2,
  IconCalendarPause,
  IconCheck,
  IconChevronDown,
  IconClipboard,
  IconExternalLink,
  IconEyeShare,
  IconClock,
  IconUser,
  IconUsersGroup,
  IconWorld,
  IconLoader2,
  IconMessage,
  IconPhoto,
  IconSend,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import { FieldRow, RolePicker } from "../fields";
import {
  EMPTY_DELAY,
  ScheduleDelayPicker,
  delayIsEmpty,
  delayToIso,
  describeDelay,
  type ScheduleDelay,
} from "../date-time-picker";
import { StatusPill } from "../indicator";
import type { DepartmentProfile, DepartmentRoster, DepartmentViewer, ManagedRole } from "../types";
import { MentionText, MentionTextArea, mentionedMemberIds } from "./mentions";
import { Announcement, Check, Feature, parseServerDate } from "./shared";

/* The Home tab: the member's own card and the announcement feed. */

function ProfileCard({
  viewer,
  roster,
  profile,
  activity,
  requiredHours = 0,
  onRefresh,
  pinned = [],
  onPinned,
}: {
  viewer: DepartmentViewer | null;
  roster?: DepartmentRoster;
  profile: DepartmentProfile;
  activity?: any;
  /** Hours members must reach this wave (0 = no requirement set). */
  requiredHours?: number;
  onRefresh: () => Promise<void>;
  pinned?: any[];
  onPinned?: (button: any) => void;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [busy, setBusy] = useState(false);
  const member = roster?.memberRows?.find((item) => item.id === viewer?.id);
  const activeShift = activity?.viewer?.activeShift || null;
  const onBreak = Boolean(activeShift?.onBreak);
  const waveSeconds = Number(activity?.viewer?.seconds || 0);
  async function shiftAction(action: "shift_start" | "shift_break" | "shift_end") {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, department_id: profile.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || data.message || "Shift update failed");
      await onRefresh();
      setNotice({ kind: "saved", text: data.message || "Shift updated" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Shift update failed",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="space-y-3">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.018] p-4">
        <div className="flex items-center gap-3">
          {viewer?.avatar ? (
            <img
              src={discordAvatarUrl(viewer.avatar) || ""}
              alt=""
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <div className="h-11 w-11 rounded-full bg-white/[0.06]" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {viewer?.name || "Department member"}
            </p>
            <p className="cool-text truncate text-xs">
              @{viewer?.username || "member"}
            </p>
            <p className="cool-text mt-1 text-[11px]">
              {member?.rankName || "Not on roster"}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/55">My Activity</p>
            {activeShift ? (
              <StatusPill tone={onBreak ? "warn" : "ok"} pulse={!onBreak}>
                {onBreak ? "On break" : "On shift"}
              </StatusPill>
            ) : null}
          </div>
          {requiredHours > 0
            ? (() => {
                const required = requiredHours;
                const done = waveSeconds / 3600;
                const pct = Math.max(0, Math.min(1, done / required));
                const met = done >= required;
                return (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="cool-text">Hour requirement</span>
                      <span className={met ? "text-[var(--tone-ok)]" : "text-[var(--accent-peach)]"}>
                        {done.toFixed(1)} / {required} hrs
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${met ? "bg-[var(--tone-ok)]" : "bg-[var(--accent-peach)]"}`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })()
            : null}
          <p className="cool-text mt-2 text-xs">
            {(waveSeconds / 3600).toFixed(2)} hours this activity wave
            {activity?.wave?.number ? ` (Wave #${activity.wave.number})` : ""}
          </p>
        </div>
        <div className="mt-3 space-y-2">
          {!activeShift ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void shiftAction("shift_start")}
              className="btn-pop btn-peach h-9 w-full text-xs disabled:opacity-50"
            >
              {busy ? "Working…" : "Start Shift"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void shiftAction("shift_end")}
                className="h-9 w-full rounded-xl bg-[var(--tone-bad-wash)] text-xs font-bold text-white hover:bg-[var(--tone-bad)] disabled:opacity-50"
              >
                End Shift
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void shiftAction("shift_break")}
                className="h-9 w-full rounded-xl bg-[var(--tone-warn-wash)] text-xs font-bold text-black hover:bg-[var(--tone-warn)] disabled:opacity-50"
              >
                {onBreak ? "End Break" : "Start Break"}
              </button>
            </>
          )}
        </div>
        {pinned.length ? (
          <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3">
            {pinned.map((button) => (
              <button
                key={button.id}
                type="button"
                onClick={() => onPinned?.(button)}
                className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] text-xs font-semibold text-white/70 hover:border-[var(--accent-peach)]/35 hover:text-white"
              >
                {button.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function HomePage({
  profile,
  feature,
  viewer,
  roster,
  announcements,
  resources,
  activity,
  canPost = true,
  canModerate = true,
  onRefresh,
  onRunAction,
  onOpenResource,
  roles,
}: {
  profile: DepartmentProfile;
  feature: Feature;
  viewer: DepartmentViewer | null;
  roster?: DepartmentRoster;
  announcements: Announcement[];
  resources: any[];
  activity?: any;
  canPost?: boolean;
  canModerate?: boolean;
  onRefresh: () => Promise<void>;
  onRunAction: (actionId: string) => void;
  onOpenResource: (resourceId: string) => void;
  roles: ManagedRole[];
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [text, setText] = useState("");
  // Members picked from the @ menu are captured by id here, so the recipient
  // list never depends on re-parsing the text.
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [attachment, setAttachment] = useState<Announcement["attachment"]>();
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!more) return;
    const close = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMore(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [more]);
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [resourceId, setResourceId] = useState("");
  const attachedResource = resources.find((item) => item.id === resourceId);
  const [visibility, setVisibility] = useState("everyone");
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [visibilityRanks, setVisibilityRanks] = useState<string[]>([]);
  const [visibilityUsers, setVisibilityUsers] = useState<string[]>([]);
  const [scheduleDelay, setScheduleDelay] = useState<ScheduleDelay>(EMPTY_DELAY);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sections = Array.isArray(feature.home_sections)
    ? feature.home_sections
    : [];
  async function mutate(body: any) {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_id: profile.id, ...body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Announcement failed");
      await onRefresh();
      // Surface exactly what happened to mention DMs so delivery is verifiable.
      if (data?.dm && data.dm.targets) {
        const dm = data.dm;
        if (dm.sent) {
          setNotice({ kind: "saved", text: `Posted · DM'd ${dm.sent} member${dm.sent === 1 ? "" : "s"}` });
        } else {
          const reason = dm.forbidden
            ? "their DMs are closed"
            : dm.opted_out
              ? "they opted out of mention DMs"
              : dm.skipped_self
                ? "you can't DM yourself"
                : dm.unresolved
                  ? "the member couldn't be resolved"
                  : "the DM couldn't be delivered";
          setNotice({ kind: "error", text: `Posted, but no DM was sent: ${reason}.` });
        }
      }
      return true;
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Announcement failed",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function post() {
    if (!text.trim()) return;
    const scheduledSummary = describeDelay(scheduleDelay);
    const body = {
      action: "announcement_post",
      content: text.trim(),
      attachment,
      resource_id: resourceId || null,
      visibility,
      visibility_role_ids: visibilityRanks,
      visibility_user_ids: visibilityUsers,
      // Match whole mentions; picked ids disambiguate identical display names.
      mention_user_ids: mentionedMemberIds(text, rosterMembers, mentionIds),
      reply_to: replyTo?.id || null,
      scheduled_for: delayToIso(scheduleDelay),
    };
    // Optimistic: the post appears instantly while the API call runs.
    const optimistic = {
      id: `pending-${Date.now()}`,
      author: viewer?.name || "You",
      author_id: viewer?.id,
      avatar: viewer?.avatar,
      content: text.trim(),
      attachment,
      resource_id: resourceId || null,
      reply_to: replyTo?.id || null,
      scheduled_for: delayToIso(scheduleDelay),
      created_at: new Date().toISOString(),
      pending: true,
    };
    setPendingPosts((current) => [optimistic, ...current]);
    setMore(false);
    const posted = await mutate(body);
    setPendingPosts((current) =>
      current.filter((item) => item.id !== optimistic.id),
    );
    if (posted) {
      // Keep the full draft while sending. Only clear fields that still hold
      // the submitted value, so typing during the request is preserved too.
      setText((current) => current.trim() === body.content ? "" : current);
      setMentionIds((current) => current === mentionIds ? [] : current);
      setReplyTo((current) => current === replyTo ? null : current);
      setAttachment((current) => current === attachment ? undefined : current);
      setResourceId((current) => current === resourceId ? "" : current);
      setScheduleDelay((current) => current === scheduleDelay ? EMPTY_DELAY : current);
      setScheduleOpen(false);
      setNotice({
        kind: "saved",
        text: scheduledSummary
          ? `Announcement scheduled to post in ${scheduledSummary}`
          : "Announcement posted",
      });
    }
  }
  const memberCount = roster?.members || 0;
  const onLeaveCount = roster?.onLoa || 0;
  const activeNow = (roster?.memberRows || []).filter(
    (member) => (member.activitySeconds || 0) > 0,
  ).length;
  const rosterMembers = (roster?.memberRows || []).map((member: any) => ({
    id: String(member.id),
    name: String(member.name || ""),
    avatar: member.avatar,
  }));
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  // Shouts removed optimistically vanish immediately instead of waiting for
  // the delete + refetch round-trip.
  const [deletedShoutIds, setDeletedShoutIds] = useState<string[]>([]);
  const [confirmShout, setConfirmShout] = useState<any | null>(null);
  async function performDeleteShout(item: any) {
    setDeletedShoutIds((current) => [...current, String(item.id)]);
    const deleted = await mutate({ action: "announcement_delete", id: item.id });
    if (!deleted) {
      setDeletedShoutIds((current) => current.filter((id) => id !== String(item.id)));
    }
  }
  function requestDeleteShout(item: any) {
    const skip =
      typeof window !== "undefined" &&
      window.localStorage.getItem("gator-skip-shout-delete") === "1";
    if (skip) performDeleteShout(item);
    else setConfirmShout(item);
  }
  // Discord-style replying: pick a shout, the reference shows on the main
  // composer, and the posted announcement quotes it.
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [highlightedShoutId, setHighlightedShoutId] = useState<string | null>(null);
  const feed = [...pendingPosts, ...announcements].filter(
    (item) => !deletedShoutIds.includes(String(item.id)),
  );
  const memberNameById = new Map(
    rosterMembers.map((member) => [String(member.id), member.name]),
  );
  const referencedShout = (id: any) =>
    feed.find((item) => String(item.id) === String(id)) || null;
  return (
    <div className="space-y-4">
      {confirmShout
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[240] flex items-center justify-center p-4">
              <button
                type="button"
                className="dialog-backdrop absolute inset-0 bg-black/75"
                onClick={() => setConfirmShout(null)}
                aria-label="Cancel"
              />
              <div className="dialog-pop relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#131415] p-5">
                <h3 className="font-extrabold">Delete this shout?</h3>
                <p className="mt-2 text-sm text-white/50">
                  This permanently removes the shout for everyone.
                </p>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined")
                        window.localStorage.setItem("gator-skip-shout-delete", "1");
                      performDeleteShout(confirmShout);
                      setConfirmShout(null);
                    }}
                    className="text-xs font-semibold text-white/40 transition-colors hover:text-white/70"
                  >
                    Delete &amp; don&apos;t remind me again
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmShout(null)}
                      className="px-3 py-2 text-sm text-white/55 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        performDeleteShout(confirmShout);
                        setConfirmShout(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--tone-bad-wash)] px-3 py-2 text-sm font-bold text-[var(--tone-bad)]"
                    >
                      <IconTrash size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <div className="hidden" aria-hidden="true">
        {[
          { label: "Members", value: memberCount, icon: <IconUsers size={17} /> },
          { label: "Active this wave", value: activeNow, icon: <IconCheck size={17} /> },
          { label: "On leave", value: onLeaveCount, icon: <IconCalendarPause size={17} /> },
          { label: "Announcements", value: announcements.length, icon: <IconMessage size={17} /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.015] px-4 py-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-peach)_9%,transparent)] text-[var(--accent-peach)]">
              {stat.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-extrabold leading-6 text-white">
                {stat.value}
              </span>
              <span className="cool-text block truncate text-xs">{stat.label}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.015] p-4 sm:p-5">
          {canPost ? (
          <div className="order-2 sticky bottom-3 z-30 mt-3 rounded-xl border border-white/[0.075] bg-[#0c0c0c]/95 p-3 shadow-[0_-12px_40px_rgba(0,0,0,.3)] backdrop-blur-xl">
          {replyTo ? (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--accent-peach)]/25 bg-[color-mix(in_srgb,var(--accent-peach)_6%,transparent)] px-3 py-2">
              <IconArrowBackUp size={13} className="shrink-0 text-[var(--accent-peach)]" />
              <span className="min-w-0 truncate text-xs text-white/60">
                Replying to <span className="font-bold text-white/80">{replyTo.author}</span>
                {": "}
                {String(replyTo.content || "").slice(0, 70)}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-auto shrink-0 rounded p-1 text-white/35 hover:text-white"
                aria-label="Cancel reply"
              >
                <IconX size={13} />
              </button>
            </div>
          ) : null}
          <MentionTextArea
            value={text}
            onChange={setText}
            onMention={(member) =>
              setMentionIds((current) =>
                current.includes(member.id) ? current : [...current, member.id],
              )
            }
            members={rosterMembers}
            rows={4}
            placeholder="Post an announcement to the department… Use @ to mention a member"
            className="w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-7 text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)] placeholder:text-white/25"
          />
          {attachment ? (
            <div key={attachment.name} className="g-arrive mb-2 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/55">
              <span className="truncate">{attachment.name}</span>
              <button type="button" onClick={() => setAttachment(undefined)}>
                <IconX size={14} />
              </button>
            </div>
          ) : null}
          {attachedResource ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-[var(--accent-peach)]/25 bg-[color-mix(in_srgb,var(--accent-peach)_6%,transparent)] px-3 py-3">
              {attachedResource.kind === "application" ? (
                <IconClipboard size={16} className="shrink-0 text-[var(--accent-peach)]" />
              ) : (
                <IconBook2 size={16} className="shrink-0 text-[var(--accent-peach)]" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-white/85">
                  {attachedResource.title}
                </span>
                <span className="cool-text block text-[10px] uppercase tracking-[0.1em]">
                  Attached {attachedResource.kind}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setResourceId("")}
                className="ml-auto p-1 text-white/30 hover:text-white"
                aria-label="Remove attached resource"
              >
                <IconX size={14} />
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () =>
                  setAttachment({
                    name: file.name,
                    type: file.type,
                    data: String(reader.result || ""),
                  });
                reader.readAsDataURL(file);
              }}
            />
            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => setMore(!more)}
                className={`inline-flex items-center gap-2 px-1 py-2 text-xs font-semibold transition-colors ${more ? "text-white" : "text-white/55 hover:text-white"}`}
              >
                More options
                <IconChevronDown
                  size={13}
                  className={`transition-transform ${more ? "rotate-180" : ""}`}
                />
              </button>
              {more ? (
                <div className="absolute bottom-full left-0 z-40 mb-2 w-80 rounded-2xl border border-white/[0.08] bg-[#131415] p-2 shadow-[0_24px_70px_rgba(0,0,0,.7)]">
                  {[
                    {
                      icon: <IconPhoto size={16} />,
                      label: "Upload a file",
                      hint: "Upload an image or video",
                      action: () => {
                        setMore(false);
                        fileRef.current?.click();
                      },
                    },
                    {
                      icon: <IconBook2 size={16} />,
                      label: "Attach a Bot resource",
                      hint: "Attach a Bot doc or form",
                      action: () => {
                        setMore(false);
                        setResourcePickerOpen(true);
                      },
                    },
                    {
                      icon: <IconEyeShare size={16} />,
                      label: "Change shout visibility",
                      hint:
                        visibility === "everyone"
                          ? "@everyone will be able to see this shout"
                          : visibility === "ranks"
                            ? `${visibilityRanks.length} selected rank${visibilityRanks.length === 1 ? "" : "s"}`
                            : `${visibilityUsers.length} selected member${visibilityUsers.length === 1 ? "" : "s"}`,
                      action: () => {
                        setMore(false);
                        setVisibilityOpen(true);
                      },
                    },
                    {
                      icon: <IconClock size={16} />,
                      label: "Schedule this shout",
                      hint: delayIsEmpty(scheduleDelay)
                        ? "Schedule when this shout will be posted"
                        : `Posting in ${describeDelay(scheduleDelay)}`,
                      action: () => {
                        setMore(false);
                        setScheduleOpen(true);
                      },
                    },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={option.action}
                      className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent-peach)_7%,transparent)]"
                    >
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.045] text-white/70">
                        {option.icon}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-white/85">
                          {option.label}
                        </span>
                        <span className="cool-text mt-1 block text-xs leading-4">
                          {option.hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {visibility !== "everyone" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--accent-peach)_9%,transparent)] px-3 py-1 text-[10px] font-bold text-[var(--accent-peach)]">
                {visibility === "ranks" ? (
                  <IconUsersGroup size={12} />
                ) : (
                  <IconUser size={12} />
                )}
                {visibility === "ranks"
                  ? `${visibilityRanks.length} ranks`
                  : `${visibilityUsers.length} members`}
              </span>
            ) : null}
            {!delayIsEmpty(scheduleDelay) ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--accent-peach)_9%,transparent)] px-3 py-1 text-[10px] font-bold text-[var(--accent-peach)]">
                <IconClock size={12} />
                in {describeDelay(scheduleDelay)}
              </span>
            ) : null}
            <button
              type="button"
              disabled={!text.trim() || busy}
              onClick={post}
              className="btn-pop btn-peach ml-auto inline-flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-35"
            >
              <IconSend size={14} />
              {delayIsEmpty(scheduleDelay) ? "Post" : "Schedule"}
            </button>
          </div>
          {scheduleOpen ? (
            <div className="mt-2 rounded-xl border border-white/[0.08] bg-[#0e0e0e] p-3">
              <FieldRow
                label="Schedule announcement"
                description="Set a delay before this announcement is posted"
              >
                <ScheduleDelayPicker
                  value={scheduleDelay}
                  onChange={setScheduleDelay}
                />
              </FieldRow>
            </div>
          ) : null}
          {resourcePickerOpen
            ? createPortal(
                <div className="gator-overlay fixed inset-0 z-[140] flex items-center justify-center p-4">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                    onClick={() => setResourcePickerOpen(false)}
                    aria-label="Close"
                  />
                  <div className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-4 shadow-2xl">
                    <h3 className="px-1 text-sm font-extrabold text-white">
                      Attach a Bot resource
                    </h3>
                    <div className="mt-3 space-y-1">
                      {resources.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setResourceId(item.id);
                            setResourcePickerOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent-peach)_7%,transparent)]"
                        >
                          {item.kind === "application" ? (
                            <IconClipboard size={16} className="shrink-0 text-[var(--accent-peach)]" />
                          ) : (
                            <IconBook2 size={16} className="shrink-0 text-[var(--accent-peach)]" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white/85">
                              {item.title}
                            </span>
                            <span className="cool-text block text-[11px] capitalize">
                              {item.kind}
                            </span>
                          </span>
                        </button>
                      ))}
                      {!resources.length ? (
                        <p className="cool-text py-8 text-center text-sm">
                          No resources in this department yet.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
          </div>
          ) : null}
          <div className="order-1 space-y-3">
            {feed.map((item) => (
              <article
                key={item.id}
                data-shout-id={item.id}
                className={`rounded-xl border p-4 transition-colors duration-500 sm:p-5 ${highlightedShoutId === String(item.id) ? "border-[var(--accent-peach)]/60 bg-[color-mix(in_srgb,var(--accent-peach)_7%,transparent)]" : "border-white/[0.08] bg-black/10"}`}
              >
                <div className="flex items-center gap-3">
                  {item.avatar ? (
                    <img
                      src={discordAvatarUrl(item.avatar) || ""}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent-peach)_11%,transparent)] text-[var(--accent-peach)]">
                      <IconMessage size={14} />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-white/80">
                      {item.author}
                    </p>
                    <p className="cool-text text-[10px] leading-4">
                      {parseServerDate(item.created_at).toLocaleString()}
                      {(item.mention_user_ids || []).length ? (
                        <span className="ml-2 font-semibold text-[var(--accent-peach)]">
                          · @
                          {memberNameById.get(String(item.mention_user_ids[0])) ||
                            "member"}
                          {item.mention_user_ids.length > 1
                            ? ` +${item.mention_user_ids.length - 1}`
                            : ""}{" "}
                          mentioned
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {item.scheduled_for && !item.delivered_at ? (
                    <span
                      tabIndex={0}
                      className="group relative ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--accent-peach)]/25 bg-[color-mix(in_srgb,var(--accent-peach)_9%,transparent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent-peach)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gator-accent)]"
                    >
                      <IconClock size={11} /> Scheduled
                      <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden whitespace-nowrap rounded-xl border border-white/[0.08] bg-[#131415] px-3 py-2 text-[11px] font-semibold normal-case tracking-normal text-white/75 shadow-xl group-hover:block group-focus:block">
                        Scheduled for {new Intl.DateTimeFormat(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZoneName: "short",
                        }).format(new Date(item.scheduled_for))}
                      </span>
                    </span>
                  ) : null}
                  {!item.pending ? (
                    <button
                      type="button"
                      onClick={() => setReplyTo(item)}
                      className={`${item.scheduled_for && !item.delivered_at ? "" : canModerate ? "ml-auto" : "ml-auto"} rounded-xl p-1 text-white/20 transition-colors hover:bg-white/[0.06] hover:text-[var(--accent-peach)] ${replyTo?.id === item.id ? "text-[var(--accent-peach)]" : ""}`}
                      aria-label={`Reply to ${item.author}`}
                      title="Reply"
                    >
                      <IconArrowBackUp size={15} />
                    </button>
                  ) : null}
                  {canModerate ? (
                    <button
                      type="button"
                      onClick={() => requestDeleteShout(item)}
                      className="rounded-xl p-1 text-white/20 hover:text-[var(--tone-bad)]"
                      aria-label="Delete"
                    >
                      <IconTrash size={14} />
                    </button>
                  ) : null}
                </div>
                {item.reply_to
                  ? (() => {
                      const original = referencedShout(item.reply_to);
                      if (!original) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            const target = document.querySelector(
                              `[data-shout-id="${original.id}"]`,
                            );
                            target?.scrollIntoView({ behavior: "smooth", block: "center" });
                            setHighlightedShoutId(String(original.id));
                            window.setTimeout(() => setHighlightedShoutId(null), 1600);
                          }}
                          className="mt-3 flex w-full items-center gap-2 rounded-xl border-l-2 border-[var(--accent-peach)]/50 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.04]">
                          <IconArrowBackUp size={12} className="shrink-0 rotate-180 text-white/30" />
                          <span className="truncate text-xs text-white/45">
                            <span className="font-bold text-white/60">{original.author}</span>{" "}
                            {String(original.content || "").slice(0, 90)}
                          </span>
                        </button>
                      );
                    })()
                  : null}
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-white/75">
                  <MentionText
                    text={item.content || ""}
                    members={roster?.memberRows || []}
                    mentionUserIds={item.mention_user_ids}
                    departmentName={profile.name}
                    accentColor={(profile as any).accent_color}
                  />
                </p>
                {item.pending ? (
                  <p className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-white/50">
                    <IconLoader2 size={12} className="animate-spin" />
                    Posting…
                  </p>
                ) : null}
                {item.resource_id
                  ? (() => {
                      const linked = resources.find(
                        (resource) => resource.id === item.resource_id,
                      );
                      if (!linked) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => onOpenResource(linked.id)}
                          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-[var(--accent-peach)]/35"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--accent-peach)]">
                            {linked.kind === "application" ? (
                              <IconClipboard size={16} />
                            ) : (
                              <IconBook2 size={16} />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-white/85">
                              {linked.title}
                            </span>
                            <span className="cool-text block text-[11px] capitalize">
                              {linked.kind} · click to open
                            </span>
                          </span>
                          <IconExternalLink size={14} className="ml-auto shrink-0 text-white/30" />
                        </button>
                      );
                    })()
                  : null}
                {item.image ? (
                  <img
                    src={item.image}
                    alt="Announcement attachment"
                    className="mt-3 max-h-72 rounded-xl border border-white/[0.08] object-cover"
                  />
                ) : null}
                {item.attachment?.data?.startsWith("data:image/") ? (
                  <img
                    src={item.attachment.data}
                    alt={item.attachment.name}
                    className="mt-3 max-h-72 rounded-xl border border-white/[0.08] object-cover"
                  />
                ) : item.attachment ? (
                  <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-white/60">
                    {item.attachment.name}
                  </div>
                ) : null}
              </article>
            ))}
            {!feed.length ? (
              <div className="rounded-xl border border-dashed border-white/[0.08] py-12 text-center">
                <IconMessage size={20} className="mx-auto text-white/15" />
                <p className="cool-text mt-2 text-sm">
                  No announcements yet. New posts will appear here.
                </p>
              </div>
            ) : null}
          </div>
        </section>
        <ProfileCard
          viewer={viewer}
          roster={roster}
          profile={profile}
          activity={activity}
          requiredHours={Number(feature.activity?.required_hours ?? feature.required_hours) || 0}
          onRefresh={onRefresh}
          pinned={feature.pinned_buttons || []}
          onPinned={(button) =>
            button.type === "action" && button.action_id
              ? onRunAction(button.action_id)
              : button.resource_id
                ? onOpenResource(button.resource_id)
                : button.url
                  ? window.open(button.url, "_blank", "noopener,noreferrer")
                  : undefined
          }
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section: any, index: number) => (
          <a
            key={section.id || index}
            href={section.url || "#"}
            target={section.url ? "_blank" : undefined}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.018] p-4 hover:border-[var(--accent-peach)]/30"
          >
            <div className="flex items-center justify-between gap-2">
              {/* A user-supplied title with no width floor beside the icon
                  wrapped one word per line on a phone. */}
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-white/85">
                {section.title || "Department section"}
              </p>
              <IconExternalLink size={14} className="shrink-0 text-white/25" />
            </div>
            <p className="cool-text mt-2 text-xs leading-5">
              {section.description || "Open this department section."}
            </p>
          </a>
        ))}
      </div>
      {visibilityOpen
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[140] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                onClick={() => setVisibilityOpen(false)}
                aria-label="Close"
              />
              <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
                <h3 className="text-sm font-extrabold text-white">
                  Customize announcement visibility
                </h3>
                <div className="mt-4 space-y-2">
                  {(
                    [
                      {
                        id: "everyone",
                        label: "@everyone",
                        hint: "Everyone can see this announcement",
                        icon: <IconWorld size={17} />,
                      },
                      {
                        id: "ranks",
                        label: "Select ranks",
                        hint: "Only members in selected ranks",
                        icon: <IconUsersGroup size={17} />,
                      },
                      {
                        id: "users",
                        label: "Select users",
                        hint: "Only selected department members",
                        icon: <IconUser size={17} />,
                      },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setVisibility(option.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${visibility === option.id ? "border-[var(--accent-peach)]/55 bg-[color-mix(in_srgb,var(--accent-peach)_7%,transparent)]" : "border-white/[0.08] hover:border-[var(--accent-peach)]/25 hover:bg-white/[0.02]"}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visibility === option.id ? "bg-[color-mix(in_srgb,var(--accent-peach)_13%,transparent)] text-[var(--accent-peach)]" : "bg-white/[0.045] text-white/60"}`}
                      >
                        {option.icon}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-white/80">
                          {option.label}
                        </span>
                        <span className="cool-text mt-1 block text-xs">
                          {option.hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {visibility === "ranks" ? (
                  <div className="mt-4">
                    <RolePicker
                      roles={roles}
                      multi
                      value={visibilityRanks}
                      onChange={(value) =>
                        setVisibilityRanks(value as string[])
                      }
                      placeholder="Select ranks"
                    />
                  </div>
                ) : null}
                {visibility === "users" ? (
                  <div className="mt-4 max-h-48 space-y-1 overflow-y-auto">
                    {(roster?.memberRows || []).map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[color-mix(in_srgb,var(--accent-peach)_6%,transparent)]"
                      >
                        <Check
                          checked={visibilityUsers.includes(member.id)}
                          onChange={(checked) =>
                            setVisibilityUsers(
                              checked
                                ? [...visibilityUsers, member.id]
                                : visibilityUsers.filter(
                                    (id) => id !== member.id,
                                  ),
                            )
                          }
                          label={`Show announcement to ${member.name}`}
                        />
                        <span className="text-sm text-white/75">
                          {member.name}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibilityOpen(false)}
                    className="px-3 py-2 text-sm text-white/55"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibilityOpen(false)}
                    className="btn-pop btn-peach px-4 py-2 text-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
