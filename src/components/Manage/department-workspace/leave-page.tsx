"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { IconCalendarPause } from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import {
  DateRangeField,
  FieldRow,
  NumberField,
  SettingsCard,
  TextAreaField,
  Toggle,
} from "../fields";
import { MemberAvatar } from "../member-avatar";
import type { DepartmentProfile, DepartmentRoster, DepartmentViewer } from "../types";
import { Feature, Subnav, inputClass, parseServerDate } from "./shared";

/* The Leave of Absence tab. */

export function LeavePage({
  profile,
  roster,
  feature,
  onStage,
  can = () => true,
  loas = [],
  viewerLoas = [],
  viewer,
  onRefresh,
}: {
  profile: DepartmentProfile;
  roster?: DepartmentRoster;
  feature: Feature;
  onStage: (key: string, value: any) => void;
  can?: (...allowed: string[]) => boolean;
  loas?: any[];
  viewerLoas?: any[];
  viewer?: DepartmentViewer | null;
  onRefresh: () => Promise<void>;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [sub, setSub] = useState("Recent");
  const loaSettings = feature.loa || {};
  const patch = (next: any) => onStage("loa", { ...loaSettings, ...next });
  const canManage = can("loa_manager");
  const canAdmin = can();
  const [busy, setBusy] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const visible = canManage ? loas : viewerLoas;
  const pending = visible.filter((item: any) => item.status === "pending");
  const active = visible.filter((item: any) => item.status === "active");
  const history = visible.filter((item: any) =>
    ["ended", "denied"].includes(item.status),
  );
  const myOpen = viewerLoas.find((item: any) =>
    ["pending", "active"].includes(item.status),
  );
  async function loaAction(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_id: profile.id, ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || data.message || "Leave update failed");
      await onRefresh();
      setNotice({ kind: "saved", text: data.message || success });
      return true;
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Leave update failed",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  function LoaRow({ item, actions }: { item: any; actions?: React.ReactNode }) {
    const member = (roster?.memberRows || []).find(
      (row: any) => String(row.id) === String(item.user_id),
    );
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.05] py-3 last:border-0">
        {member?.avatar ? (
          <MemberAvatar src={member.avatar} name={member.name} className="h-9 w-9" />
        ) : (
          <span className="h-9 w-9 rounded-full bg-white/[0.06]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white/80">
            {member?.name || item.user_name || item.user_id}
          </p>
          <p className="cool-text truncate text-xs">
            {item.starts_at ? parseServerDate(item.starts_at).toLocaleDateString() : "now"}
            {" → "}
            {item.ends_at ? parseServerDate(item.ends_at).toLocaleDateString() : "open-ended"}
            {item.reason ? ` · ${item.reason}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
            item.status === "active"
              ? "bg-[var(--tone-warn-soft)] text-[var(--tone-warn)]"
              : item.status === "pending"
                ? "bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent-peach)]"
                : item.status === "denied"
                  ? "bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]"
                  : "bg-white/[0.06] text-white/50"
          }`}
        >
          {item.status}
        </span>
        {actions}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Subnav
          items={
            canAdmin
              ? ["Recent", "Settings", "History"]
              : canManage
                ? ["Recent", "History"]
                : ["Recent"]
          }
          value={sub}
          onChange={setSub}
        />
        {!myOpen ? (
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="btn-pop btn-peach inline-flex items-center gap-2 px-4 py-2 text-xs"
          >
            <IconCalendarPause size={15} />
            Request leave
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void loaAction({ action: "loa_end", id: myOpen.id }, "Your leave was ended")
            }
            className="rounded-xl border border-[var(--tone-warn-line)] bg-[var(--tone-warn-soft)] px-4 py-2 text-xs font-semibold text-[var(--tone-warn)] hover:bg-[var(--tone-warn-wash)] disabled:opacity-40"
          >
            End my leave ({myOpen.status})
          </button>
        )}
      </div>
      {sub === "Recent" ? (
        <>
          <SettingsCard
            title="Pending Requests"
            description={
              canManage
                ? "Review and manage pending leave of absence requests."
                : "Your pending leave requests."
            }
          >
            {pending.map((item: any) => (
              <LoaRow
                key={item.id}
                item={item}
                actions={
                  canManage && String(item.user_id) !== String(viewer?.id) ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void loaAction(
                            { action: "loa_review", id: item.id, approve: true },
                            "Leave approved",
                          )
                        }
                        className="btn-pop btn-peach px-3 py-2 text-xs disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void loaAction(
                            { action: "loa_review", id: item.id, approve: false },
                            "Leave denied",
                          )
                        }
                        className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)] disabled:opacity-40"
                      >
                        Deny
                      </button>
                    </span>
                  ) : undefined
                }
              />
            ))}
            {!pending.length ? (
              <p className="cool-text py-7 text-center text-sm">No pending requests.</p>
            ) : null}
          </SettingsCard>
          <SettingsCard
            title="Active LOAs"
            description="View and manage currently active leaves of absence."
          >
            {active.map((item: any) => (
              <LoaRow
                key={item.id}
                item={item}
                actions={
                  canManage || String(item.user_id) === String(viewer?.id) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void loaAction({ action: "loa_end", id: item.id }, "Leave ended")
                      }
                      className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-white/60 hover:text-white disabled:opacity-40"
                    >
                      End leave
                    </button>
                  ) : undefined
                }
              />
            ))}
            {!active.length ? (
              <p className="cool-text py-7 text-center text-sm">No active LOAs.</p>
            ) : null}
          </SettingsCard>
        </>
      ) : null}
      {sub === "Settings" && canAdmin ? (
        <>
          <SettingsCard title="General Settings" description="Configure basic LOA behavior.">
            {[
              ["require_reason", "Require reason"],
              ["require_end_date", "Require end date"],
              ["disallow_shifts", "Disallow shifts while on leave"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-3 border-b border-white/[0.08] py-3 last:border-0"
              >
                <Toggle
                  checked={Boolean(loaSettings[key])}
                  onChange={(value) => patch({ [key]: value })}
                />
                <span className="text-sm text-white/70">{label}</span>
              </label>
            ))}
          </SettingsCard>
          <SettingsCard
            title="Duration Settings"
            description="Configure timing restrictions for LOA requests."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <FieldRow label="Cooldown days">
                <NumberField
                  value={loaSettings.cooldown_days ?? ""}
                  min={0}
                  onChange={(value) => patch({ cooldown_days: value })}
                />
              </FieldRow>
              <FieldRow label="Minimum days">
                <NumberField
                  value={loaSettings.minimum_days ?? ""}
                  min={0}
                  onChange={(value) => patch({ minimum_days: value })}
                />
              </FieldRow>
              <FieldRow label="Maximum days">
                <NumberField
                  value={loaSettings.maximum_days ?? ""}
                  min={0}
                  onChange={(value) => patch({ maximum_days: value })}
                />
              </FieldRow>
            </div>
          </SettingsCard>
        </>
      ) : null}
      {sub === "History" && canManage ? (
        <SettingsCard
          title="LOA History"
          description="Search previous leave requests for documentation and investigations."
        >
          <input
            className={inputClass}
            placeholder="Search members"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
          />
          <div className="mt-3">
            {history
              .filter((item: any) =>
                `${item.user_name || ""} ${item.reason || ""}`
                  .toLowerCase()
                  .includes(historySearch.toLowerCase()),
              )
              .map((item: any) => (
                <LoaRow key={item.id} item={item} />
              ))}
            {!history.length ? (
              <p className="cool-text py-8 text-center text-sm">No leave history found.</p>
            ) : null}
          </div>
        </SettingsCard>
      ) : null}
      {requestOpen
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[150] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                onClick={() => setRequestOpen(false)}
                aria-label="Close"
              />
              <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
                <h3 className="text-base font-extrabold text-white">Request leave of absence</h3>
                <p className="cool-text mt-1 text-xs">
                  {Number(loaSettings.minimum_days || 0)
                    ? `Minimum ${Number(loaSettings.minimum_days)} day(s). `
                    : ""}
                  {Number(loaSettings.maximum_days || 0)
                    ? `Maximum ${Number(loaSettings.maximum_days)} day(s).`
                    : ""}
                </p>
                <div className="mt-4 space-y-4">
                  <FieldRow label="Reason *">
                    <TextAreaField
                      value={reason}
                      onChange={setReason}
                      rows={3}
                      placeholder="Why are you taking leave?"
                    />
                  </FieldRow>
                  <FieldRow label="Leave period *">
                    <DateRangeField
                      startValue={startsAt}
                      endValue={endsAt}
                      onChange={(start, end) => {
                        setStartsAt(start);
                        setEndsAt(end);
                      }}
                      placeholder="Pick your leave dates"
                    />
                  </FieldRow>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestOpen(false)}
                    className="px-3 py-2 text-sm text-white/55"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy || !reason.trim() || !startsAt || !endsAt}
                    onClick={async () => {
                      const ok = await loaAction(
                        {
                          action: "loa_request",
                          reason: reason.trim(),
                          starts_at: startsAt || null,
                          ends_at: endsAt || null,
                        },
                        "Leave request submitted",
                      );
                      if (ok) {
                        setRequestOpen(false);
                        setReason("");
                        setStartsAt("");
                        setEndsAt("");
                      }
                    }}
                    className="btn-pop btn-peach px-4 py-2 text-sm disabled:opacity-40"
                  >
                    {busy ? "Submitting…" : "Submit request"}
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
