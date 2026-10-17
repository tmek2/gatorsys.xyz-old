"use client";

import React, { useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import { createPortal } from "react-dom";
import { IconEdit, IconClock, IconPlus, IconTrash } from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import {
  DateField,
  DateRangeField,
  TimeField,
  FieldRow,
  NumberField,
  SelectField,
  SettingsCard,
  TextField,
  Toggle,
} from "../fields";
import { MemberAvatar } from "../member-avatar";
import type { DepartmentProfile, DepartmentRoster } from "../types";
import { Feature, Subnav, formatDuration, inputClass, parseServerDate } from "./shared";

/* The Activity tab: shifts, waves and the leaderboard. */

export function ActivityPage({
  profile,
  feature,
  onStage,
  activity,
  roster,
  can = () => true,
  onRefresh,
}: {
  profile: DepartmentProfile;
  feature: Feature;
  onStage: (key: string, value: any) => void;
  activity?: any;
  roster?: DepartmentRoster;
  can?: (...allowed: string[]) => boolean;
  onRefresh: () => Promise<void>;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [sub, setSub] = useState("Activity Waves");
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | {
    action: string;
    title: string;
    body: string;
    waveId?: string;
  }>(null);
  const [selectedWaveId, setSelectedWaveId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const settings = feature.activity || {};
  const canAdmin = can();
  const patch = (next: any) => onStage("activity", { ...settings, ...next });
  const waves: any[] = activity?.waves || [];
  const scheduledWaves: any[] = activity?.scheduledWaves || [];
  const [waveModal, setWaveModal] = useState<null | {
    mode: "start" | "schedule" | "edit";
    wave?: any;
  }>(null);
  const currentWave = activity?.wave || null;
  const memberById = new Map(
    (roster?.memberRows || []).map((member: any) => [String(member.id), member]),
  );
  const selectedWave =
    waves.find((wave) => wave.id === (selectedWaveId || currentWave?.id)) ||
    waves[0] ||
    null;
  const waveTotals: Record<string, number> = selectedWave?.totals || {};
  const leaderboard = Object.entries(waveTotals)
    .map(([memberId, seconds]) => ({
      id: memberId,
      seconds: Number(seconds || 0),
      member: memberById.get(memberId),
    }))
    .sort((a, b) => b.seconds - a.seconds);
  const requiredSeconds = Number(settings.required_hours || 0) * 3600;

  async function waveAction(action: string, waveId?: string, extra: any = {}) {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          department_id: profile.id,
          wave_id: waveId,
          ...extra,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || data.message || "Wave update failed");
      await onRefresh();
      setNotice({ kind: "saved", text: data.message || "Activity updated" });
      return true;
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Wave update failed",
      });
      return false;
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <Subnav
        items={["Activity Waves", "Shifts", "Member Activity", "Leaderboard"]}
        value={sub}
        onChange={setSub}
      />
      {sub === "Activity Waves" ? (
        <>
          {canAdmin ? (
            <>
              <SettingsCard
                title="Activity Wave Duration"
                description="Configure how long activity waves should last."
              >
                <FieldRow label="Duration in days">
                  <NumberField
                    value={settings.wave_duration_days ?? ""}
                    min={0}
                    onChange={(value) => patch({ wave_duration_days: value })}
                  />
                </FieldRow>
              </SettingsCard>
              <SettingsCard
                title="Hour Requirements"
                description="Set the required hours department members must meet."
              >
                <FieldRow label="Required hours">
                  <NumberField
                    value={settings.required_hours ?? ""}
                    min={0}
                    onChange={(value) => patch({ required_hours: value })}
                  />
                </FieldRow>
              </SettingsCard>
              <SettingsCard
                title="Inactivity Settings"
                description="Choose when members should be flagged as inactive."
              >
                <FieldRow label="Inactivity flag period (days)">
                  <NumberField
                    value={settings.inactivity_days ?? ""}
                    min={0}
                    onChange={(value) => patch({ inactivity_days: value })}
                  />
                </FieldRow>
              </SettingsCard>
            </>
          ) : null}
          <SettingsCard
            title="Activity Timeline"
            description="View and manage this department's activity waves."
          >
            {canAdmin ? (
              <div className="flex flex-wrap gap-2">
                {currentWave ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setConfirmAction({
                        action: "wave_end",
                        title: "End the current wave?",
                        body: "The current activity wave will be closed. Its shifts and leaderboard stay available in history.",
                      })
                    }
                    className="rounded-xl bg-[var(--tone-bad-soft)] px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)] disabled:opacity-50"
                  >
                    End current wave
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setWaveModal({ mode: "start" })}
                    className="btn-pop btn-peach inline-flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-50"
                  >
                    <IconPlus size={14} /> Start activity wave
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setWaveModal({ mode: "schedule" })}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-white/65 transition-colors hover:border-[var(--accent-peach)]/30 hover:text-white disabled:opacity-50"
                >
                  <IconClock size={14} /> Schedule a wave
                </button>
              </div>
            ) : null}
            <div className="mt-5 space-y-2">
              {scheduledWaves.map((wave) => (
                <div
                  key={wave.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--accent-peach)]/20 bg-[color-mix(in_srgb,var(--accent-peach)_4%,transparent)] px-3 py-3 text-sm text-white/70"
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--accent-peach)_11%,transparent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent-peach)]">
                    <IconClock size={11} /> Scheduled
                  </span>
                  <span className="min-w-0 truncate font-semibold">
                    {wave.name || "Activity wave"}
                    {wave.shiftType ? (
                      <span className="cool-text font-normal"> · {wave.shiftType}</span>
                    ) : null}
                  </span>
                  <span className="cool-text text-xs">
                    {parseServerDate(wave.startsAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {wave.endsAt
                      ? ` → ${parseServerDate(wave.endsAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : " · open-ended"}
                  </span>
                  {canAdmin ? (
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setWaveModal({ mode: "edit", wave })}
                        className="rounded-xl p-2 text-white/35 hover:bg-white/[0.06] hover:text-white"
                        aria-label="Edit scheduled wave"
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void waveAction("wave_cancel", wave.id)}
                        className="rounded-xl p-2 text-white/35 hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)]"
                        aria-label="Cancel scheduled wave"
                      >
                        <IconTrash size={14} />
                      </button>
                    </span>
                  ) : null}
                </div>
              ))}
              {waves.map((wave) => (
                <div
                  key={wave.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-3 text-sm text-white/65"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${wave.endedAt ? "bg-white/25" : "bg-[var(--tone-ok)]"}`}
                  />
                  {wave.name ? `${wave.name} · ` : ""}Activity Wave #{wave.number} ·{" "}
                  {wave.endedAt
                    ? `Ended ${parseServerDate(wave.endedAt).toLocaleDateString()}`
                    : wave.endsAt
                      ? `Ends ${parseServerDate(wave.endsAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : "Ongoing"}
                  {wave.shiftType ? (
                    <span className="cool-text text-xs">{wave.shiftType}</span>
                  ) : null}
                  <span className="cool-text ml-auto text-xs">
                    {Object.keys(wave.totals || {}).length} member
                    {Object.keys(wave.totals || {}).length === 1 ? "" : "s"} active
                  </span>
                </div>
              ))}
              {!waves.length && !scheduledWaves.length ? (
                <p className="cool-text py-6 text-center text-sm">
                  No activity waves yet. Start one when your department is ready.
                </p>
              ) : null}
            </div>
          </SettingsCard>
        </>
      ) : null}
      {sub === "Shifts" ? (
        <>
          {canAdmin ? (
            <>
              <SettingsCard
                title="Shift Settings"
                description="Configure shift logging and restrictions."
              >
                <FieldRow label="Maximum on shift (0 for unlimited)">
                  <NumberField
                    value={settings.max_on_shift ?? ""}
                    min={0}
                    onChange={(value) => patch({ max_on_shift: value })}
                  />
                </FieldRow>
                <label className="mt-4 flex items-center gap-3">
                  <Toggle
                    checked={Boolean(settings.require_shift_for_actions)}
                    onChange={(value) =>
                      patch({ require_shift_for_actions: value })
                    }
                  />
                  <span className="text-sm text-white/70">
                    Require members to be on shift for actions
                  </span>
                </label>
              </SettingsCard>
              <SettingsCard
                title="Shift Types"
                description="Separate shifts into categories for organization."
              >
                <div className="space-y-2">
                  {(settings.shift_types || []).map((item: any, index: number) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.name}
                        onChange={(event) =>
                          patch({
                            shift_types: settings.shift_types.map(
                              (entry: any, i: number) =>
                                i === index
                                  ? { ...entry, name: event.target.value }
                                  : entry,
                            ),
                          })
                        }
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            shift_types: settings.shift_types.filter(
                              (_: any, i: number) => i !== index,
                            ),
                          })
                        }
                        className="p-2 text-white/30 hover:text-[var(--tone-bad)]"
                        aria-label="Remove shift type"
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      shift_types: [
                        ...(settings.shift_types || []),
                        { id: crypto.randomUUID(), name: "New shift type" },
                      ],
                    })
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-white/65 hover:text-white"
                >
                  <IconPlus size={14} />
                  Add shift type
                </button>
              </SettingsCard>
            </>
          ) : null}
          <SettingsCard
            title="Shift Overview"
            description="Everyone currently on shift in this department."
          >
            {(activity?.activeShifts || []).map((shift: any) => {
              const member = memberById.get(String(shift.userId));
              return (
                <div
                  key={shift.shiftId}
                  className="flex items-center gap-3 border-b border-white/[0.05] py-3 last:border-0"
                >
                  {member?.avatar ? (
                    <MemberAvatar src={member.avatar} name={member.name} className="h-8 w-8" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-white/[0.06]" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white/80">
                      {member?.name || shift.userName || shift.userId}
                    </p>
                    <p className="cool-text text-[11px]">
                      Started {parseServerDate(shift.startedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className={`ml-auto rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${shift.onBreak ? "bg-[var(--tone-warn-wash)] text-[var(--tone-warn)]" : "bg-[var(--tone-ok-wash)] text-[var(--tone-ok)]"}`}
                  >
                    {shift.onBreak ? "On break" : formatDuration(shift.seconds)}
                  </span>
                </div>
              );
            })}
            {!(activity?.activeShifts || []).length ? (
              <p className="cool-text py-8 text-center text-sm">
                Nobody is on shift right now.
              </p>
            ) : null}
          </SettingsCard>
        </>
      ) : null}
      {sub === "Member Activity" ? (
        <SettingsCard
          title="Member Activity Viewer"
          description="View detailed activity statistics for each member."
        >
          <SelectField
            value={selectedWave?.id || null}
            onChange={(value) => setSelectedWaveId(value)}
            options={waves.map((wave) => ({
              value: wave.id,
              label: `Activity Wave #${wave.number} · ${wave.endedAt ? "Ended" : "Ongoing"}`,
            }))}
            placeholder="Select activity wave"
          />
          <div className="mt-3">
            <SelectField
              value={selectedMemberId}
              onChange={(value) => setSelectedMemberId(value)}
              options={(roster?.memberRows || []).map((member: any) => ({
                value: member.id,
                label: member.name,
              }))}
              placeholder="Select member"
            />
          </div>
          {selectedMemberId ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.025] p-4">
                <p className="text-xl font-bold">
                  {((waveTotals[selectedMemberId] || 0) / 3600).toFixed(2)}h
                </p>
                <p className="cool-text text-xs">
                  Hours in wave #{selectedWave?.number}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.025] p-4">
                <p
                  className={`text-xl font-bold ${requiredSeconds && (waveTotals[selectedMemberId] || 0) < requiredSeconds ? "text-[var(--tone-warn)]" : "text-[var(--tone-ok)]"}`}
                >
                  {requiredSeconds
                    ? (waveTotals[selectedMemberId] || 0) >= requiredSeconds
                      ? "Met"
                      : "Not met"
                    : "No target"}
                </p>
                <p className="cool-text text-xs">
                  Requirement ({Number(settings.required_hours || 0)}h)
                </p>
              </div>
            </div>
          ) : null}
        </SettingsCard>
      ) : null}
      {sub === "Leaderboard" ? (
        <SettingsCard
          title="Activity Leaderboard"
          description="Rank members by shift time in the selected activity wave."
        >
          <SelectField
            value={selectedWave?.id || null}
            onChange={(value) => setSelectedWaveId(value)}
            options={waves.map((wave) => ({
              value: wave.id,
              label: `Activity Wave #${wave.number} · ${wave.endedAt ? "Ended" : "Ongoing"}`,
            }))}
            placeholder="Select activity wave"
          />
          <div className="mt-3">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-white/[0.05] py-3 last:border-0"
              >
                <span className="w-7 text-center text-sm font-extrabold text-white/45">
                  {index + 1}
                </span>
                {entry.member?.avatar ? (
                  <img src={discordAvatarUrl(entry.member.avatar) || ""} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-white/[0.06]" />
                )}
                <p className="text-sm font-semibold text-white/80">
                  {entry.member?.name || entry.id}
                </p>
                <span className="ml-auto text-sm font-bold text-[var(--accent-peach)]">
                  {formatDuration(entry.seconds)}
                </span>
              </div>
            ))}
            {!leaderboard.length ? (
              <p className="cool-text py-10 text-center text-sm">
                The leaderboard will populate after members complete shifts.
              </p>
            ) : null}
          </div>
        </SettingsCard>
      ) : null}
      {confirmAction
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[150] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                onClick={() => setConfirmAction(null)}
                aria-label="Close"
              />
              <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
                <h3 className="text-base font-extrabold text-white">
                  {confirmAction.title}
                </h3>
                <p className="cool-text mt-2 text-sm leading-6">
                  {confirmAction.body}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-2 text-sm text-white/55"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void waveAction(confirmAction.action, confirmAction.waveId)
                    }
                    className="rounded-xl bg-[var(--tone-bad)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {waveModal ? (
        <WaveModal
          mode={waveModal.mode}
          wave={waveModal.wave}
          shiftTypes={(settings.shift_types || [])
            .map((item: any) => String(item?.name || "").trim())
            .filter(Boolean)}
          busy={busy}
          onClose={() => setWaveModal(null)}
          onSubmit={async (payload) => {
            const ok =
              waveModal.mode === "edit"
                ? await waveAction("wave_update", waveModal.wave.id, payload)
                : await waveAction(
                    waveModal.mode === "start" ? "wave_start" : "wave_schedule",
                    undefined,
                    payload,
                  );
            if (ok) setWaveModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** Create/schedule/edit an activity wave: name, optional shift type, and a
 *  styled date+time window. Overlaps are rejected by the API. */
function WaveModal({
  mode,
  wave,
  shiftTypes,
  busy,
  onClose,
  onSubmit,
}: {
  mode: "start" | "schedule" | "edit";
  wave?: any;
  shiftTypes: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const toParts = (value?: string | null) => {
    if (!value) return { date: "", time: "" };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
      time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
    };
  };
  const initialStart = toParts(wave?.startsAt);
  const initialEnd = toParts(wave?.endsAt);
  const [name, setName] = useState<string>(wave?.name || "");
  const [shiftType, setShiftType] = useState<string>(wave?.shiftType || "");
  const [startDate, setStartDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time || "12:00");
  const [endDate, setEndDate] = useState(initialEnd.date);
  const [endTime, setEndTime] = useState(initialEnd.time || "12:00");
  const needsStart = mode === "schedule" || (mode === "edit" && Boolean(wave?.startsAt));
  const compose = (date: string, time: string) =>
    date ? new Date(`${date}T${time || "00:00"}:00`).toISOString() : null;
  const todayIso = (() => {
    const nowDate = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${nowDate.getFullYear()}-${pad(nowDate.getMonth() + 1)}-${pad(nowDate.getDate())}`;
  })();
  return createPortal(
    <div className="gator-overlay fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
        <h3 className="text-base font-extrabold text-white">
          {mode === "start"
            ? "Start an activity wave"
            : mode === "schedule"
              ? "Schedule an activity wave"
              : "Edit scheduled wave"}
        </h3>
        <p className="cool-text mt-1 text-sm">
          {mode === "start"
            ? "The wave begins now. Give it a name and, optionally, an automatic end time."
            : "Queued waves start and end automatically. Two waves can never run at the same time."}
        </p>
        <div className="mt-4 space-y-4">
          <FieldRow label="Wave name" description="Shown on the timeline and in summaries">
            <TextField
              value={name}
              onChange={setName}
              placeholder="e.g. July activity push"
              maxLength={80}
            />
          </FieldRow>
          {shiftTypes.length ? (
            <FieldRow label="Shift type" description="Count only shifts of one type toward this wave">
              <SelectField
                value={shiftType || null}
                onChange={(value) => setShiftType(value || "")}
                options={[
                  { value: "", label: "All shift types" },
                  ...shiftTypes.map((item) => ({ value: item, label: item })),
                ]}
                placeholder="All shift types"
              />
            </FieldRow>
          ) : null}
          {needsStart ? (
            <>
              {/* Scheduled waves span a start→end date: one range picker sets
                  both days, and the time fields pin the hour each one fires. */}
              <FieldRow label="Schedule" description="The days the wave runs (it can span multiple)">
                <DateRangeField
                  startValue={startDate}
                  endValue={endDate}
                  onChange={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  min={todayIso}
                  placeholder="Pick the wave dates"
                />
              </FieldRow>
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Start time" description="When it begins on the first day">
                  <TimeField value={startTime} onChange={setStartTime} />
                </FieldRow>
                <FieldRow label="End time" description="When it closes on the last day">
                  <TimeField value={endTime} onChange={setEndTime} disabled={!endDate} />
                </FieldRow>
              </div>
            </>
          ) : (
            <FieldRow
              label="Ends (optional)"
              description="The wave closes and posts its summary automatically"
            >
              <div className="grid grid-cols-[1fr_130px] gap-2">
                <DateField value={endDate} onChange={setEndDate} min={startDate || todayIso} />
                <TimeField value={endTime} onChange={setEndTime} disabled={!endDate} />
              </div>
            </FieldRow>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-white/55 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (needsStart && !startDate)}
            onClick={() =>
              onSubmit({
                name,
                shift_type: shiftType,
                ...(needsStart ? { starts_at: compose(startDate, startTime) } : {}),
                ends_at: compose(endDate, endTime),
              })
            }
            className="btn-pop btn-peach px-4 py-2 text-sm disabled:opacity-40"
          >
            {busy
              ? "Working…"
              : mode === "start"
                ? "Start wave"
                : mode === "schedule"
                  ? "Schedule wave"
                  : "Save changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
