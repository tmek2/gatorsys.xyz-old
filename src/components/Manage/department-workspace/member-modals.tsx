"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconArrowBackUp, IconArrowRightCircle, IconUpload, IconX } from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import { DateField, TimeField, NumberField, SelectField, TextAreaField } from "../fields";
import { type PointsSystem } from "../department-points";
import { MemberAvatar } from "../member-avatar";
import { Check } from "./shared";

/* Promote and punish dialogs, opened from the roster and the Infractions tab. */

/** Gator "Create Promotion" flow. */
export function PromotionModal({
  targets,
  ranks,
  profileId,
  mode = "promote",
  onClose,
  onDone,
}: {
  targets: { id: string; name: string; username?: string; avatar?: string; rankName?: string }[];
  ranks: { id: string; name: string }[];
  profileId: string;
  /** "demote" flips the copy and only offers ranks below the member's. */
  mode?: "promote" | "demote";
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [toRank, setToRank] = useState<string | null>(null);
  const [createShout, setCreateShout] = useState(mode === "promote");
  const [dmMembers, setDmMembers] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  // Step 2 (only when a shout is enabled): write the announcement itself.
  const [step, setStep] = useState<"details" | "shout">("details");
  const [shoutMessage, setShoutMessage] = useState("");
  const first = targets[0];
  const demoting = mode === "demote";
  // Never the member's current rank: for one member, promoting offers ranks
  // above theirs and demoting ranks below (ranks are ordered highest first).
  const firstRankIndex = ranks.findIndex((rank) => rank.name === first?.rankName);
  const rankOptions = ranks.filter((rank, index) => {
    if (rank.name === first?.rankName) return false;
    if (targets.length === 1 && firstRankIndex >= 0) {
      if (!demoting && index >= firstRankIndex) return false;
      if (demoting && index <= firstRankIndex) return false;
    }
    return true;
  });

  /**
   * The announcement this promotion writes, derived on demand so it follows the
   * rank chosen on the previous step.
   */
  function defaultShout() {
    const rankName =
      ranks.find((rank) => String(rank.id) === String(toRank))?.name || "their new rank";
    const names = targets.map((target) => `@${target.name}`).join(", ");
    return demoting
      ? `${names} has been demoted to ${rankName}.`
      : `${names} has been promoted to ${rankName}!`;
  }
  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "promotion_create",
          department_id: profileId,
          member_ids: targets.map((target) => target.id),
          to_rank_id: toRank,
          kind: mode,
          create_shout: createShout,
          shout_message: createShout ? shoutMessage.trim() || undefined : undefined,
          dm_members: dmMembers,
          scheduled_for: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || data.message || "Promotion failed");
      await onDone();
      setNotice({ kind: "saved", text: data.message || "Promotion created" });
      onClose();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Promotion failed",
      });
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div className="gator-overlay fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-extrabold text-white">
            {demoting ? "Create Demotion" : "Create Promotion"}
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-white/35 hover:text-white">
            <IconX size={16} />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          {first?.avatar ? (
            <MemberAvatar src={first.avatar} name={first.name} className="h-9 w-9" />
          ) : (
            <span className="h-9 w-9 rounded-full bg-white/[0.06]" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-white/85">
              {targets.length === 1 ? first?.name : `${targets.length} members`}
            </span>
            <span className="cool-text block truncate text-[11px]">
              {targets.length === 1
                ? `@${first?.username || "member"}`
                : targets.map((target) => target.name).join(", ")}
            </span>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <p className="cool-text mb-1 text-[11px] font-bold uppercase tracking-[0.1em]">From</p>
            <div className="flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 text-sm text-white/60">
              <span className="truncate">
                {targets.length === 1 ? first?.rankName || "Unranked" : "Current ranks"}
              </span>
            </div>
          </div>
          <IconArrowRightCircle size={18} className="mt-5 text-white/30" />
          <div>
            <p className="cool-text mb-1 text-[11px] font-bold uppercase tracking-[0.1em]">To</p>
            <SelectField
              value={toRank}
              onChange={setToRank}
              options={rankOptions.map((rank) => ({ value: rank.id, label: rank.name }))}
              placeholder="Select rank"
            />
          </div>
        </div>
        <label className="mt-4 flex items-start gap-3">
          <Check checked={createShout} onChange={setCreateShout} label="Create shout" />
          <span>
            <span className="block text-sm font-semibold text-white/80">Create shout</span>
            <span className="cool-text block text-xs">
              {demoting
                ? "Write a shout to announce these demotions to the department."
                : "Write a shout to announce these promotions to the department."}
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3">
          <Check
            checked={dmMembers}
            onChange={setDmMembers}
            label={demoting ? "DM demoted members" : "DM promoted members"}
          />
          <span>
            <span className="block text-sm font-semibold text-white/80">
              {demoting ? "DM Demoted Members" : "DM Promoted Members"}
            </span>
            <span className="cool-text block text-xs">
              {demoting
                ? "Should a DM be sent notifying each of the demoted members?"
                : "Should a DM be sent notifying each of the promoted members?"}
            </span>
          </span>
        </label>
        <div className="mt-4">
          <p className="text-sm font-semibold text-white/80">Scheduled Date</p>
          <p className="cool-text mt-1 text-xs">
            Should this promotion be scheduled for a future date &amp; time?
          </p>
          <div className="mt-2 grid grid-cols-[1fr_120px] gap-2">
            <DateField
              value={scheduledAt.split("T")[0] || ""}
              onChange={(date) =>
                setScheduledAt(
                  date ? `${date}T${scheduledAt.split("T")[1] || "12:00"}` : "",
                )
              }
              placeholder="Leave empty to post now"
            />
            <TimeField
              value={scheduledAt.split("T")[1] || ""}
              disabled={!scheduledAt.split("T")[0]}
              onChange={(time) =>
                setScheduledAt(
                  `${scheduledAt.split("T")[0] || ""}T${time || "12:00"}`,
                )
              }
            />
          </div>
        </div>
        {step === "details" ? (
          <button
            type="button"
            disabled={busy || !toRank}
            onClick={() => {
              if (!createShout) {
                void submit();
                return;
              }
              // Anything typed is kept — Restore Default on the next step is
              // how you go back to the generated line.
              setShoutMessage((current) => current || defaultShout());
              setStep("shout");
            }}
            className="btn-pop btn-peach mt-5 h-10 w-full text-sm disabled:opacity-40"
          >
            {busy ? "Working…" : createShout ? "Next" : "Continue"}
          </button>
        ) : (
          <div className="mt-5">
            <p className="text-sm font-semibold text-white/80">
              {demoting
                ? "Write a shout to announce this demotion"
                : "Write a shout to announce this promotion"}
            </p>
            <p className="cool-text mt-1 text-xs">
              Mentions are highlighted in the feed and mentioned members are
              notified.
            </p>
            <textarea
              value={shoutMessage}
              onChange={(event) => setShoutMessage(event.target.value)}
              rows={3}
              className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-[rgb(var(--accent-rgb)/.4)]"
            />
            {/* Resets the announcement to the generated line (also picks up a
               rank changed on the previous step). Hidden when it already
               matches. */}
            {shoutMessage !== defaultShout() ? (
              <button
                type="button"
                onClick={() => setShoutMessage(defaultShout())}
                className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent-peach)] transition-opacity hover:opacity-80"
              >
                <IconArrowBackUp size={13} />
                Restore default
              </button>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-white/55 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || !shoutMessage.trim()}
                onClick={() => void submit()}
                className="btn-pop btn-peach h-10 px-6 text-sm disabled:opacity-40"
              >
                {busy ? "Working…" : "Create Now"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Gator "Punish Member" flow — proof uploads, 0 points = note. */
export function PunishModal({
  targets,
  profileId,
  stages = [],
  onClose,
  onDone,
}: {
  targets: { id: string; name: string; username?: string; avatar?: string; points?: number }[];
  profileId: string;
  /** The department's escalation ladder, so the form can say where this
   *  infraction lands the member before it is issued. */
  stages?: PointsSystem["stages"];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState<number | "">(0);
  const [expiresInDays, setExpiresInDays] = useState<string>("0");
  const [proof, setProof] = useState<{ name: string; data: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const proofRef = useRef<HTMLInputElement>(null);
  const first = targets[0];

  // Where these points take the member on the configured ladder (which the bot
  // evaluates), so an automatic termination is visible before issuing. Single
  // target only: several members start from different totals.
  const added = Number(points || 0);
  const newTotal = (first?.points || 0) + added;
  const triggered =
    targets.length === 1 && added > 0
      ? [...stages]
          .sort((a, b) => (Number(a.points) || 0) - (Number(b.points) || 0))
          .filter((stage) => newTotal >= (Number(stage.points) || 0))
          .pop() || null
      : null;
  // Only worth saying if this infraction is what crosses the line.
  const crossed =
    triggered && (first?.points || 0) < (Number(triggered.points) || 0) ? triggered : null;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "infract",
          department_id: profileId,
          member_ids: targets.map((target) => target.id),
          reason: reason.trim(),
          points: Number(points || 0),
          expires_in_days: Number(expiresInDays || 0),
          proof: proof.map((item) => item.data),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || data.message || "Could not issue infraction");
      await onDone();
      setNotice({
        kind: "saved",
        text: `Infraction issued to ${targets.length === 1 ? first?.name : `${targets.length} members`}`,
      });
      onClose();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not issue infraction",
      });
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div className="gator-overlay fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
        <h3 className="text-base font-extrabold text-white">Punish Member</h3>
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex items-center gap-3">
            {first?.avatar ? (
              <MemberAvatar src={first.avatar} name={first.name} className="h-9 w-9" />
            ) : (
              <span className="h-9 w-9 rounded-full bg-white/[0.06]" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-white/85">
                {targets.length === 1 ? first?.name : `${targets.length} members`}
              </span>
              <span className="cool-text block truncate text-[11px]">
                {targets.length === 1 ? `@${first?.username || "member"}` : targets.map((t) => t.name).join(", ")}
              </span>
            </span>
            {targets.length === 1 ? (
              <span className="text-right">
                <span className="block text-sm font-extrabold text-white/85">{first?.points || 0}</span>
                <span className="cool-text block text-[10px] uppercase tracking-[0.1em]">Points</span>
              </span>
            ) : null}
          </div>
          {added === 0 ? (
            <p className="mt-3 rounded-xl bg-white/[0.02] px-3 py-2 text-xs text-white/55">
              This member won’t get any points. The infraction works as a note.
            </p>
          ) : crossed ? (
            // Red for the two outcomes that end membership, amber for a
            // warning.
            <p
              className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                crossed.type === "warning"
                  ? "bg-[var(--tone-warn-soft)] text-[var(--tone-warn)]"
                  : "bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]"
              }`}
            >
              Takes {targets.length === 1 ? first?.name : "them"} to{" "}
              <span className="font-bold">{newTotal}</span> points, which triggers{" "}
              <span className="font-bold">{crossed.name || "a stage"}</span>
              {crossed.type === "termination"
                ? ", which is an automatic termination."
                : crossed.type === "suspension"
                  ? ", which is an automatic suspension."
                  : "."}
            </p>
          ) : targets.length === 1 ? (
            <p className="mt-3 rounded-xl bg-white/[0.02] px-3 py-2 text-xs text-white/55">
              Takes {first?.name} to <span className="font-bold text-white/75">{newTotal}</span>{" "}
              points.
            </p>
          ) : null}
        </div>
        <div className="mt-6">
          <p className="text-sm font-semibold text-white/80">
            Reason <span className="text-[var(--tone-bad)]">*</span>
          </p>
          <p className="cool-text mb-3 mt-1 text-xs">The reason for giving this infraction.</p>
          <TextAreaField value={reason} onChange={setReason} rows={3} placeholder="What happened?" />
        </div>
        <input
          ref={proofRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files || []).slice(0, 3 - proof.length);
            for (const file of files) {
              const reader = new FileReader();
              reader.onload = () =>
                setProof((current) =>
                  current.length >= 3
                    ? current
                    : [...current, { name: file.name, data: String(reader.result || "") }],
                );
              reader.readAsDataURL(file);
            }
            event.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={proof.length >= 3}
          onClick={() => proofRef.current?.click()}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] text-xs font-bold text-white/65 transition-colors hover:border-white/[0.2] hover:text-white disabled:opacity-40"
        >
          <IconUpload size={15} />
          Upload Proof (Max 3)
        </button>
        {proof.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {proof.map((item, index) => (
              <span
                key={index}
                className="g-arrive inline-flex max-w-[160px] items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] text-white/65"
              >
                <span className="truncate">{item.name}</span>
                <button
                  type="button"
                  onClick={() => setProof(proof.filter((_, i) => i !== index))}
                  className="text-white/35 hover:text-white"
                  aria-label={`Remove ${item.name}`}
                >
                  <IconX size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-6">
          <p className="text-sm font-semibold text-white/80">
            Points <span className="text-[var(--tone-bad)]">*</span>
          </p>
          <p className="cool-text mb-3 mt-1 text-xs">
            The points that will be given to this member. Can be set to zero if you wish for the
            infraction to act as a note.
          </p>
          <NumberField value={points} min={0} max={100} onChange={setPoints} />
        </div>
        <div className="mt-6">
          <p className="text-sm font-semibold text-white/80">Expiration</p>
          <p className="cool-text mb-3 mt-1 text-xs">
            When this infraction lapses. Choose “Never” for a permanent record.
          </p>
          <SelectField
            value={expiresInDays}
            options={[
              { value: "0", label: "Never" },
              { value: "1", label: "1 day" },
              { value: "3", label: "3 days" },
              { value: "7", label: "1 week" },
              { value: "14", label: "2 weeks" },
              { value: "30", label: "1 month" },
              { value: "90", label: "3 months" },
            ]}
            onChange={(next) => setExpiresInDays(next || "0")}
          />
        </div>
        <div className="mt-7 flex justify-end gap-2 border-t border-white/[0.08] pt-4">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-white/55 hover:text-white">
            Close
          </button>
          <button
            type="button"
            disabled={!reason.trim() || busy}
            onClick={() => void submit()}
            className="rounded-xl bg-[var(--tone-bad)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy ? "Punishing…" : "Punish"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
