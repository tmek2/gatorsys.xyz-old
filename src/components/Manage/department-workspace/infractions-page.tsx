"use client";

import React, { useEffect, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import { createPortal } from "react-dom";
import {
  IconChevronDown,
  IconGavel,
  IconPhoto,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import { SettingsCard, Toggle } from "../fields";
import { DepartmentPointsSystem, type PointsSystem } from "../department-points";
import type { DepartmentProfile, DepartmentRoster } from "../types";
import { PunishModal } from "./member-modals";
import { Feature, Subnav, parseServerDate } from "./shared";

/* The Infractions tab. */

export function InfractionsPage({
  profile,
  roster,
  feature,
  records = [],
  viewerRecords = [],
  can = () => true,
  onStage,
  onRefresh,
}: {
  profile: DepartmentProfile;
  roster?: DepartmentRoster;
  feature: Feature;
  records?: any[];
  viewerRecords?: any[];
  can?: (...allowed: string[]) => boolean;
  onStage: (key: string, value: any) => void;
  onRefresh: () => Promise<void>;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const canInfract = can("issue_infractions");
  const canAdmin = can();
  const [sub, setSub] = useState("Members");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [punishTargets, setPunishTargets] = useState<any[] | null>(null);
  const [proofRecord, setProofRecord] = useState<any | null>(null);
  const [zoomedProof, setZoomedProof] = useState<string | null>(null);
  useEffect(() => {
    if (!zoomedProof) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomedProof(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomedProof]);
  const points: PointsSystem = feature.points_system || { stages: [] };
  const stages = (points.stages || []).filter((stage: any) => stage?.name);
  const members = (roster?.memberRows || []).filter((member) =>
    `${member.name} ${member.username}`.toLowerCase().includes(search.toLowerCase()),
  );
  const recordsByMember = new Map<string, any[]>();
  for (const record of records) {
    const key = String(record.member_id);
    recordsByMember.set(key, [...(recordsByMember.get(key) || []), record]);
  }
  async function deleteInfraction(record: any) {
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "infraction_delete",
          department_id: profile.id,
          infraction_id: record.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || "Could not delete the infraction");
      await onRefresh();
      setNotice({ kind: "saved", text: "Infraction deleted" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not delete the infraction",
      });
    }
  }
  function StageTrack({ memberPoints }: { memberPoints: number }) {
    if (!stages.length) return null;
    return (
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        {stages.map((stage: any, index: number) => {
          const threshold = Number(stage.points || 0);
          const reached = memberPoints >= threshold;
          return (
            <div key={stage.id || index} className="flex min-w-fit flex-1 items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold ${reached ? "border-[var(--accent-peach)] bg-[color-mix(in_srgb,var(--accent-peach)_13%,transparent)] text-[var(--accent-peach)]" : "border-white/[0.08] text-white/40"}`}
              >
                {index + 1}
              </span>
              <span className="min-w-fit">
                <span className={`block text-xs font-bold ${reached ? "text-white/85" : "text-white/45"}`}>
                  {stage.name}
                </span>
                <span className="cool-text block text-[10px]">{threshold} Points</span>
              </span>
              {index < stages.length - 1 ? (
                <span className={`h-px min-w-6 flex-1 ${reached ? "bg-[var(--accent-peach)]/40" : "bg-white/[0.08]"}`} />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }
  function RecordRows({ memberId }: { memberId: string }) {
    const memberRecords = recordsByMember.get(memberId) || [];
    return (
      <div className="mt-4">
        <p className="text-sm font-bold text-white/80">Infractions</p>
        <div className="mt-2 overflow-x-auto">
          <div className="grid min-w-[560px] grid-cols-[minmax(160px,1fr)_170px_70px_minmax(160px,1.2fr)_auto] gap-3 border-b border-white/[0.08] px-1 pb-2 text-[11px] text-white/50">
            <span>Issued By</span>
            <span>Date</span>
            <span>Points</span>
            <span>Reason</span>
            <span />
          </div>
          {memberRecords.map((record: any, index: number) => {
            const issuer = (roster?.memberRows || []).find(
              (row: any) => String(row.id) === String(record.issued_by),
            );
            return (
              <div
                key={record.id || index}
                className="grid min-w-[560px] grid-cols-[minmax(160px,1fr)_170px_70px_minmax(160px,1.2fr)_auto] items-center gap-3 border-b border-white/[0.045] px-1 py-3 last:border-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {issuer?.avatar ? (
                    <img src={discordAvatarUrl(issuer.avatar) || ""} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-white/[0.06]" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-white/75">
                      {issuer?.name || record.issued_by_name || record.issued_by}
                    </span>
                  </span>
                </span>
                <span className="cool-text text-xs">
                  {record.created_at ? parseServerDate(record.created_at).toLocaleString() : "Unknown"}
                </span>
                <span className="text-xs font-bold text-white/70">{record.points ?? 0}</span>
                <span className="cool-text truncate text-xs" title={record.reason}>
                  {record.reason || "No reason given"}
                </span>
                <span className="flex items-center justify-end gap-1">
                  {Array.isArray(record.proof) && record.proof.length ? (
                    <button
                      type="button"
                      onClick={() => setProofRecord(record)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-2 py-2 text-[11px] font-semibold text-white/55 transition-colors hover:border-[var(--accent-peach)]/30 hover:text-white"
                    >
                      <IconPhoto size={13} />
                      Proof ({record.proof.length})
                    </button>
                  ) : null}
                  {canInfract ? (
                    <button
                      type="button"
                      onClick={() => void deleteInfraction(record)}
                      className="rounded-xl p-2 text-white/25 hover:text-[var(--tone-bad)]"
                      aria-label="Delete infraction"
                    >
                      <IconTrash size={14} />
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
          {!memberRecords.length ? (
            <p className="cool-text py-5 text-center text-xs">
              This member has no infractions…
            </p>
          ) : null}
        </div>
        <p className="mt-4 text-sm font-bold text-white/80">Suspensions</p>
        <p className="cool-text mt-2 py-3 text-center text-xs">
          This member has no previous suspensions…
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Subnav
        items={
          canAdmin
            ? ["Members", "Appeals", "Settings"]
            : canInfract
              ? ["Members", "Appeals"]
              : ["My Record"]
        }
        value={canInfract || canAdmin ? sub : "My Record"}
        onChange={setSub}
      />
      {sub === "Members" && canInfract ? (
        <SettingsCard
          title="Member Records"
          description="View and manage infraction records for all department members."
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3">
              <IconSearch size={15} className="text-white/30" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search for member by name"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
              />
            </label>
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="btn-pop btn-peach inline-flex h-10 items-center gap-2 px-4 text-xs"
            >
              <IconRefresh size={14} />
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {members.map((member) => {
              // Sums the member's own infraction records (`member.points` is
              // not populated here).
              const memberRecords = recordsByMember.get(String(member.id)) || [];
              const memberPoints =
                member.points ||
                memberRecords.reduce(
                  (total: number, record: any) => total + (record.points || 0),
                  0,
                );
              const open = expanded === member.id;
              return (
                <div
                  key={member.id}
                  className={`rounded-2xl border transition-colors ${open ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.08]"}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : member.id)}
                    className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
                  >
                    <img
                      src={discordAvatarUrl(member.avatar) || ""}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white/80">
                        {member.name}
                      </span>
                      <span className="cool-text block truncate text-[11px]">
                        @{member.username}
                      </span>
                    </span>
                    <span
                      className={`rounded-xl px-2 py-1 text-[10px] font-bold ${!memberPoints ? "bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]" : memberPoints < 4 ? "bg-[var(--tone-warn-soft)] text-[var(--tone-warn)]" : "bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]"}`}
                    >
                      {memberPoints} POINT{memberPoints === 1 ? "" : "S"} ·{" "}
                      {!memberPoints ? "GREAT" : memberPoints < 4 ? "GOOD" : "AT RISK"}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setPunishTargets([member]);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.stopPropagation();
                          setPunishTargets([member]);
                        }
                      }}
                      className="rounded-xl p-2 text-white/30 hover:text-[var(--accent-peach)]"
                      aria-label={`Issue infraction to ${member.name}`}
                    >
                      <IconGavel size={16} />
                    </span>
                    <IconChevronDown
                      size={16}
                      className={`text-white/35 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open ? (
                    <div className="border-t border-white/[0.08] px-4 pb-4">
                      <StageTrack memberPoints={memberPoints} />
                      <RecordRows memberId={member.id} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!members.length ? (
              <p className="cool-text py-8 text-center text-sm">
                {search ? "No members match that search." : "No members are on the roster yet."}
              </p>
            ) : null}
          </div>
          <p className="cool-text mt-4 text-[11px]">
            Points decide each member's standing. Configure automatic stages under Settings.
          </p>
        </SettingsCard>
      ) : null}
      {(!canInfract && !canAdmin) || sub === "My Record" ? (
        <SettingsCard
          title="My Record"
          description="Your infraction history in this department."
        >
          <StageTrack
            memberPoints={viewerRecords.reduce(
              (total: number, record: any) => total + (record.points || 0),
              0,
            )}
          />
          <div className="mt-4 space-y-3">
            {viewerRecords.map((record: any, index: number) => (
              <div
                key={record.id || index}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xl bg-[var(--tone-bad-soft)] px-2 py-1 text-[11px] font-bold text-[var(--tone-bad)]">
                    {record.points || 0} point{(record.points || 0) === 1 ? "" : "s"}
                  </span>
                  {record.type || record.action ? (
                    <span className="rounded-xl bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white/70">
                      {record.type || record.action}
                    </span>
                  ) : null}
                  <span className="cool-text ml-auto text-[11px]">
                    {record.created_at ? parseServerDate(record.created_at).toLocaleString() : ""}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/80">
                  {record.reason || "No reason provided."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.05] pt-3">
                  <span className="flex items-center gap-2">
                    {record.issuer?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={discordAvatarUrl(record.issuer.avatar) || ""}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-white/50">
                        {String(record.issuer?.name || record.issuerName || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-white/55">
                      Issued by{" "}
                      <span className="font-semibold text-white/80">
                        {record.issuer?.name || record.issuerName || "a manager"}
                      </span>
                    </span>
                  </span>
                  {Array.isArray(record.proof) && record.proof.length ? (
                    <button
                      type="button"
                      onClick={() => setProofRecord(record)}
                      className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent-peach)] hover:underline"
                    >
                      <IconPhoto size={14} />
                      View attached proof ({record.proof.length})
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!viewerRecords.length ? (
              <p className="cool-text py-10 text-center text-sm">
                You have a clean record. Keep it up!
              </p>
            ) : null}
          </div>
        </SettingsCard>
      ) : null}
      {sub === "Appeals" && canInfract ? (
        <SettingsCard
          title="Infraction Appeals"
          description="Review appeals submitted by department members."
        >
          <p className="cool-text py-10 text-center text-sm">
            No appeals are awaiting review.
          </p>
        </SettingsCard>
      ) : null}
      {sub === "Settings" && canAdmin ? (
        <>
          <SettingsCard
            title="Infraction Settings"
            description="Configure how infractions are handled in your department."
          >
            <label className="flex items-center gap-3">
              <Toggle
                checked={Boolean(feature.infractions?.expire)}
                onChange={(value) =>
                  onStage("infractions", {
                    ...(feature.infractions || {}),
                    expire: value,
                  })
                }
              />
              <span>
                <span className="block text-sm font-semibold text-white/75">
                  Expire infractions
                </span>
                <span className="cool-text text-xs">
                  Automatically expire points after a configured period.
                </span>
              </span>
            </label>
          </SettingsCard>
          <SettingsCard
            title="Points System"
            description="Configure how points are handled and automated in your department."
          >
            <DepartmentPointsSystem
              value={points}
              onChange={(value) => onStage("points_system", value)}
            />
          </SettingsCard>
        </>
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
      {proofRecord && typeof document !== "undefined"
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[230] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                onClick={() => setProofRecord(null)}
                aria-label="Close attached proof"
              />
              <section className="relative max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#131415] p-5 shadow-[0_28px_90px_rgba(0,0,0,.72)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-extrabold text-white/90">Attached proof</h3>
                    <p className="cool-text mt-1 text-xs">
                      Evidence attached when this infraction was issued.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofRecord(null)}
                    className="rounded-xl p-2 text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white"
                    aria-label="Close"
                  >
                    <IconX size={17} />
                  </button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(proofRecord.proof || []).map((source: string, index: number) =>
                    String(source).startsWith("data:video") ? (
                      <video
                        key={`${index}-${String(source).slice(0, 24)}`}
                        src={source}
                        controls
                        className="max-h-[420px] w-full rounded-xl border border-white/[0.08] bg-black object-contain"
                      />
                    ) : (
                      <button
                        key={`${index}-${String(source).slice(0, 24)}`}
                        type="button"
                        onClick={() => setZoomedProof(source)}
                        className="group block cursor-zoom-in overflow-hidden rounded-xl border border-white/[0.08] bg-black/25"
                        aria-label={`Zoom infraction proof ${index + 1}`}
                      >
                        <img
                          src={source}
                          alt={`Infraction proof ${index + 1}`}
                          className="max-h-[420px] w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      </button>
                    ),
                  )}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
      {/* Full-screen zoom (Discord-style) — click the backdrop or press Esc to
          close. Smooth scale-in, never a blank tab. */}
      {zoomedProof && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              className="dialog-backdrop fixed inset-0 z-[250] flex cursor-zoom-out items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
              onClick={() => setZoomedProof(null)}
              aria-label="Close zoomed image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedProof}
                alt="Infraction proof"
                className="dialog-pop max-h-full max-w-full rounded-xl object-contain shadow-[0_28px_90px_rgba(0,0,0,.8)]"
              />
            </button>,
            document.body,
          )
        : null}
    </div>
  );
}
