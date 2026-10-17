"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MemberAvatar } from "../../member-avatar";
import { FormQuestionCard } from "@/components/form-question-field";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import {
  IconCalendar,
  IconSearch,
  IconSend,
  IconAlertTriangle,
  IconUser,
  IconExternalLink,
  IconClock,
  IconArrowLeft,
  IconCheck,
  IconLoader2,
  IconRobot,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { randomGatorLine } from "../../gator-lines";
import { ConfirmModal, type ConfirmState } from "@/components/confirm-modal";
import {
  type AiDetection,
  type AiQuestionFlag,
  type QuestionIntegrity,
} from "@/components/application-integrity";
import { AuthorshipNotes, AuthorshipTags } from "../../authorship-notes";
import { BulkDecisionModal, type BulkDecision } from "@/components/Manage/bulk-decision-modal";
import type { ApplicationQuestion } from "../../types";
import { SkeletonRows } from "../../empty-state";

/* An application's submissions: the list, who each applicant is, their answers, the authorship scan and the decision. */

interface ApplicationResponse {
  id: string;
  applicationId: string;
  applicationName: string | null;
  userId: string | null;
  userName: string | null;
  userAvatar: string | null;
  roblox?: {
    id: string | null;
    username: string | null;
    displayName: string | null;
    profileLink: string | null;
    avatar: string | null;
  } | null;
  status: string;
  /** Per-question typing signals captured by the form, keyed by question id. */
  integrity?: Record<string, QuestionIntegrity> | null;
  /** The result of an authorship scan, present only once a reviewer has run
   *  one on this submission. */
  aiDetection?: AiDetection | null;
  /** Reviewer's note, shared across everything decided in the same batch. */
  decisionReason?: string | null;
  reviewedBy?: string | null;
  /** The @handle, which a display name is not. */
  userHandle?: string | null;
  /**
   * Whether the applicant is in this server. Someone who is not cannot be given
   * roles here.
   */
  isMember?: boolean | null;
  /** Resolved reviewer, so a decision is attributed to a person rather than
   *  to a bare snowflake. */
  reviewer?: { id: string; name: string; avatar: string | null } | null;
  decidedAt?: string | null;
  answers: Record<string, string>;
  score: number | null;
  maxScore: number | null;
  createdAt: string | null;
}

/** The submission states, normalised from the several names the stores use. */
type SubmissionState = "pending" | "staging" | "approved" | "denied";

const normStatus = (status: string): SubmissionState =>
  status === "staged_approved" || status === "staged_denied"
    ? "staging"
    : status === "accepted" || status === "approved"
      ? "approved"
      : status === "denied" || status === "rejected"
        ? "denied"
        : "pending";

/** Which way a staged submission is currently pointing. */
const stagedVerdict = (status: string): "approved" | "denied" | null =>
  status === "staged_approved"
    ? "approved"
    : status === "staged_denied"
      ? "denied"
      : null;

/**
 * A Discord account's creation date, from its id: a snowflake's top 42 bits are
 * a timestamp.
 */
function snowflakeCreatedAt(id: string | null | undefined): Date | null {
  if (!id || !/^\d{15,25}$/.test(id)) return null;
  // Number rather than BigInt: a snowflake exceeds 2^53, but the lost precision
  // is in the low 22 bits (sequence and worker), which this discards anyway.
  const ms = Math.floor(Number(id) / 4194304) + 1420070400000;
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/**
 * Who submitted this: display name, handle, account age, and whether they are
 * in the server.
 */
function SubmissionIdentity({ response }: { response: ApplicationResponse }) {
  const created = snowflakeCreatedAt(response.userId);
  const isMember = response.isMember;
  return (
    <div className="submission-identity">
      {isMember === false ? (
        <p className="submission-flag">
          <IconAlertTriangle size={14} />
          Not a member of this server, so roles can’t be applied here.
        </p>
      ) : null}
      <div className="submission-identity-head">
        <MemberAvatar
          src={response.userAvatar}
          name={response.userName}
          className="h-12 w-12"
        />
        <div className="min-w-0">
          <p className="submission-identity-name">
            {response.userName || response.userId || "Unknown"}
          </p>
          {response.userHandle ? (
            <p className="submission-identity-handle">@{response.userHandle}</p>
          ) : null}
        </div>
      </div>
      <dl className="submission-facts">
        {response.userId ? (
          <div className="submission-fact">
            <dt>
              <IconUser size={13} />
              User ID
            </dt>
            <dd className="font-mono">{response.userId}</dd>
          </div>
        ) : null}
        {created ? (
          <div className="submission-fact">
            <dt>
              <IconCalendar size={13} />
              Account created
            </dt>
            <dd>
              {created.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </dd>
          </div>
        ) : null}
        {response.createdAt ? (
          <div className="submission-fact">
            <dt>
              <IconClock size={13} />
              Submitted
            </dt>
            <dd>{new Date(response.createdAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>
      {response.roblox ? (
        <a
          href={response.roblox.profileLink || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="submission-roblox"
        >
          {response.roblox.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={response.roblox.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full bg-white/[0.06] object-cover" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-white/50">
              {(response.roblox.username || "?").slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {response.roblox.username || "Roblox account"}
            </span>
            <span className="cool-text block truncate text-[11px]">
              Link to Roblox profile
              {response.roblox.id ? ` · ${response.roblox.id}` : ""}
            </span>
          </span>
          <IconExternalLink size={14} className="shrink-0 opacity-60" />
        </a>
      ) : null}
    </div>
  );
}

/** How a decided submission was decided: by whom, when, and why. */
function SubmissionDecision({ response }: { response: ApplicationResponse }) {
  const status = normStatus(response.status);
  if (status === "pending") return null;
  const decidedLabel = status === "approved" ? "Accepted by" : "Denied by";
  const person = response.reviewer;
  if (!person && !response.decisionReason) return null;
  return (
    <div className="submission-decision">
      {person ? (
        <div>
          <p className="submission-decision-label">Reviewed by</p>
          <div className="submission-decision-person">
            <MemberAvatar src={person.avatar} name={person.name} className="h-7 w-7" />
            <span>{person.name}</span>
          </div>
          <p className="submission-decision-label mt-4">{decidedLabel}</p>
          <div className="submission-decision-person">
            <MemberAvatar src={person.avatar} name={person.name} className="h-7 w-7" />
            <span>{person.name}</span>
          </div>
        </div>
      ) : (
        <div />
      )}
      <div>
        <p className="submission-decision-label">Reason</p>
        <p className="submission-decision-reason">
          {response.decisionReason || (
            <span className="text-white/30">No reason given.</span>
          )}
        </p>
        {response.decidedAt ? (
          <>
            <p className="submission-decision-label mt-4">Decided</p>
            <p className="submission-decision-reason">
              {new Date(response.decidedAt).toLocaleString()}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One answer, shown as the applicant saw the question: the public form's own
 * `FormQuestionCard`, disabled and filled with the submission, so the record
 * cannot drift from the form. `data-bare` keeps the dashboard's blanket control
 * styles off it. `renderSubmittedAnswer` handles answers whose question no
 * longer exists.
 */
function SubmittedAnswer({
  question,
  fallbackLabel,
  answer,
  integrity,
  ai,
}: {
  question?: ApplicationQuestion;
  fallbackLabel: string;
  answer: unknown;
  integrity?: QuestionIntegrity;
  ai?: AiQuestionFlag;
}) {
  // Authorship notes under the answer, inside the same card. Nothing is shown
  // for an answer that was typed and reads as written.
  const note = <AuthorshipNotes integrity={integrity} answer={answer} ai={ai} />;

  if (!question) {
    return (
      <div className="submitted-answer">
        <p className="submitted-answer-meta">
          <span className="min-w-0 flex-1">{fallbackLabel}</span>
          <AuthorshipTags integrity={integrity} answer={answer} ai={ai} />
        </p>
        <div className="submitted-answer-value">
          {renderSubmittedAnswer(undefined, answer)}
        </div>
      </div>
    );
  }

  return (
    <div className="submitted-answer" data-bare="">
      <FormQuestionCard
        question={question as never}
        value={answer}
        onChange={() => undefined}
        disabled
        aside={<AuthorshipTags integrity={integrity} answer={answer} ai={ai} />}
        footer={note}
      />
    </div>
  );
}

/** Read-only submissions viewer for an application (the Responses tab). */
/** Render a submitted answer using its question type, so scales, choices and
 *  yes/no answers read as their widget instead of a raw value. */
function renderSubmittedAnswer(
  question: ApplicationQuestion | undefined,
  answer: unknown,
): React.ReactNode {
  const type = question?.type;
  const optionLabel = (value: unknown) => {
    const opt = (question?.options as any[] | undefined)?.find(
      (o) => (typeof o === "string" ? o : o.value) === value,
    );
    return (typeof opt === "string" ? opt : opt?.label) || String(value ?? "");
  };
  if (answer === undefined || answer === null || answer === "") {
    return <span className="text-white/30">No answer</span>;
  }
  if (type === "range" || type === "rating" || type === "range_slider") {
    const num = Number(answer);
    const max = Number(question?.max ?? (type === "rating" ? 5 : 10));
    return (
      <span className="inline-flex items-baseline gap-2">
        <span className="text-xl font-extrabold text-[var(--accent-peach)]">
          {Number.isFinite(num) ? num : "?"}
        </span>
        <span className="text-xs text-white/40">/ {max}</span>
      </span>
    );
  }
  if (type === "boolean") {
    const yes = answer === true || answer === "true" || answer === "yes";
    return (
      <span className={`rounded-xl px-2 py-1 text-xs font-bold ${yes ? "bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]" : "bg-white/[0.06] text-white/60"}`}>
        {yes ? "Yes" : "No"}
      </span>
    );
  }
  // Choice questions show every option with the picks marked, as the applicant
  // saw it.
  if (
    type === "multiple_choice_multi" ||
    type === "multiple_choice" ||
    type === "image_selection"
  ) {
    const options = (question?.options as any[] | undefined) || [];
    const chosen = Array.isArray(answer) ? answer : [answer];
    const isChosen = (value: unknown) =>
      chosen.some((pick) => String(pick) === String(value));
    const multi = type === "multiple_choice_multi";

    // Keeps picked options that were later edited or removed from the question.
    const known = new Set(
      options.map((o) => String(typeof o === "string" ? o : o.value)),
    );
    const orphans = chosen.filter(
      (pick) => pick !== undefined && pick !== null && pick !== "" && !known.has(String(pick)),
    );

    if (!options.length && !orphans.length) {
      return <span className="text-white/30">No answer</span>;
    }

    return (
      <ul className="submitted-options">
        {options.map((option, index) => {
          const value = typeof option === "string" ? option : option.value;
          const label = typeof option === "string" ? option : option.label;
          const picked = isChosen(value);
          return (
            <li
              key={index}
              data-picked={picked ? "true" : "false"}
              className="submitted-option"
            >
              <span
                aria-hidden="true"
                data-shape={multi ? "box" : "dot"}
                className="submitted-option-mark"
              />
              <span className="submitted-option-label">{label || String(value)}</span>
            </li>
          );
        })}
        {orphans.map((value, index) => (
          <li
            key={`orphan-${index}`}
            data-picked="true"
            className="submitted-option"
            title="This option is no longer on the question."
          >
            <span
              aria-hidden="true"
              data-shape={multi ? "box" : "dot"}
              className="submitted-option-mark"
            />
            <span className="submitted-option-label">
              {optionLabel(value)}
              <span className="submitted-option-note">removed since</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return <span className="whitespace-pre-wrap leading-6">{String(answer)}</span>;
}

/**
 * The authorship scan button. Never automatic: every scan is a model request
 * about a real person's writing, so it runs only when a reviewer asks for the
 * submission in front of them.
 */
function AiScanButton({
  busy,
  scanned,
  onScan,
}: {
  busy: boolean;
  scanned: boolean;
  onScan: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onScan}
      title={
        scanned
          ? "Scan again for AI-written answers"
          : "Check these answers for AI-written text"
      }
      aria-label={scanned ? "Scan again for AI-written answers" : "Check for AI"}
      className={`inline-flex h-7 items-center gap-2 rounded-xl border px-2 text-[11px] font-bold transition-colors disabled:opacity-50 ${
        scanned
          ? "border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.1)] text-[var(--accent-peach)]"
          : "border-white/[0.08] text-white/45 hover:border-[rgb(var(--accent-rgb)/0.3)] hover:text-[var(--accent-peach)]"
      }`}
    >
      {busy ? (
        <IconLoader2 size={14} className="animate-spin" />
      ) : (
        <IconRobot size={14} />
      )}
      <span className="hidden sm:inline">
        {busy ? "Scanning…" : scanned ? "Re-scan" : "Check for AI"}
      </span>
    </button>
  );
}

/**
 * What the scan found: a count, with the flags on the questions below. A clean
 * scan says so.
 */
function AiScanSummary({
  detection,
  error,
}: {
  detection?: AiDetection | null;
  error?: string | null;
}) {
  if (error) {
    return (
      <p className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-4 py-3 text-[12.5px] text-[var(--tone-bad)]">
        {error}
      </p>
    );
  }
  if (!detection) return null;
  const flagged = Object.values(detection.questions || {}).filter(
    (row) => row.verdict !== "clear",
  );
  const likely = flagged.filter((row) => row.verdict === "likely").length;
  const scannedCount = Object.keys(detection.questions || {}).length;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-[12.5px] ${
        likely
          ? "border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]"
          : flagged.length
            ? "border-[var(--tone-warn-line)] bg-[var(--tone-warn-soft)] text-[var(--tone-warn)]"
            : "border-white/[0.08] bg-white/[0.02] text-white/60"
      }`}
    >
      <IconRobot size={15} className="shrink-0" />
      <span className="font-semibold">
        {scannedCount === 0
          ? "Nothing long enough to check."
          : flagged.length === 0
            ? `Checked ${scannedCount} answer${scannedCount === 1 ? "" : "s"}. None look generated.`
            : `${flagged.length} of ${scannedCount} answer${scannedCount === 1 ? "" : "s"} flagged.`}
      </span>
      {detection.model_available === false ? (
        <span className="opacity-70">
          Offline check only. The model was unavailable, so this is less
          certain than usual.
        </span>
      ) : null}
      {flagged.length ? (
        <span className="opacity-70">Flags are on the answers below.</span>
      ) : null}
    </div>
  );
}

export function ApplicationResponses({
  guildId,
  appId,
  questions,
  endpoint,
  decisionEndpoint,
  stagingEnabled = false,
}: {
  guildId: string;
  appId: string;
  questions: ApplicationQuestion[];
  /** Alternate fetch URL — the member portal reads submissions through the
   *  department-scoped endpoint instead of the Manage Server one. */
  endpoint?: string;
  /** Whether this application holds decisions back for release in one pass. */
  stagingEnabled?: boolean;
  /** Alternate decision URL, for the same reason. Without one, review is
   *  read-only — which is what the portal was, permanently. */
  decisionEndpoint?: string;
}) {
  const [responses, setResponses] = useState<ApplicationResponse[] | null>(
    null,
  );
  const [open, setOpen] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubmissionState>("pending");
  const [publishing, setPublishing] = useState(false);
  /** Free-text filter over the submission list. */
  const [search, setSearch] = useState("");
  /** The search starts as an icon and opens into a field. A permanent bar
   *  spends full width on a control most visits never touch. */
  const [searchOpen, setSearchOpen] = useState(false);
  // Bulk review selection and the decision being confirmed. Cleared when the
  // filter changes, so hidden rows are never included in a batch.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkDecision, setBulkDecision] = useState<BulkDecision | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Scans run in this session, shown as soon as they return (they are also
  // stored on the submission).
  const [scans, setScans] = useState<Record<string, AiDetection>>({});
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  // A gator pun to keep the empty state friendly (another place to find them).
  const emptyHint = useMemo(() => randomGatorLine(), []);

  const fetchUrl =
    endpoint ||
    `/api/manage/${guildId}/applicationresponses?application=${encodeURIComponent(appId)}`;

  const load = useCallback(() => {
    setResponses(null);
    fetch(fetchUrl)
      .then((res) => (res.ok ? res.json() : { responses: [] }))
      .then((json) => setResponses(json.responses || []))
      .catch(() => setResponses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl]);

  // Reconcile with the server without flashing the skeleton — used after an
  // optimistic update so the UI already reflects the change.
  const silentRefresh = useCallback(() => {
    fetch(fetchUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setResponses(json.responses || []);
      })
      .catch(() => {});
  }, [fetchUrl]);

  // Approve and deny run the same decision flow as the Discord review buttons.
  // The department portal passes its own department-gated endpoint, so it gets
  // the same buttons.
  const decisionUrl =
    decisionEndpoint || `/api/manage/${guildId}/applicationdecision`;
  const canDecide = !endpoint || Boolean(decisionEndpoint);

  /** Release every held decision for this application in one pass. */
  async function publishStaged() {
    setPublishing(true);
    setDecisionError(null);
    try {
      const response = await fetch(
        `/api/manage/${guildId}/applicationpublishstaged`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ application: appId }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Could not publish");
      }
      // A decision that could not be delivered is still a decision; say so
      // rather than reporting a clean sweep.
      const undelivered = (data.undelivered || []).length;
      if (undelivered) {
        setDecisionError(
          `Published, but ${undelivered} applicant${undelivered === 1 ? "" : "s"} could not be messaged.`,
        );
      }
      await load();
    } catch (error) {
      setDecisionError(
        error instanceof Error ? error.message : "Could not publish",
      );
    } finally {
      setPublishing(false);
    }
  }
  async function decide(id: string, decision: "approve" | "deny") {
    setDeciding(`${id}:${decision}`);
    setDecisionError(null);
    // Optimistic: the decision flow (roles, DM, audit) is slow, so reflect the
    // new status immediately and reconcile in the background.
    const nextStatus = decision === "approve" ? "approved" : "denied";
    setResponses((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)) : prev,
    );
    try {
      const res = await fetch(decisionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.message || "Could not process the decision");
      setOpen(null);
      silentRefresh();
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Could not process the decision");
      load(); // revert the optimistic change to server truth
    } finally {
      setDeciding(null);
    }
  }

  // Bulk approve or deny. The bot decides each submission individually, so
  // roles, DMs, audit entries and automations all run; per-submission failures
  // are shown.
  async function decideMany(decision: BulkDecision, reason: string) {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    setDecisionError(null);
    const nextStatus = decision === "approve" ? "approved" : "denied";
    const snapshot = responses;
    setResponses((prev) =>
      prev
        ? prev.map((r) => (selected.has(r.id) ? { ...r, status: nextStatus } : r))
        : prev,
    );
    try {
      const res = await fetch(`/api/manage/${guildId}/applicationdecisionbulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, decision, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.detail || json.message || "Could not process the decisions",
        );
      }
      const failed: { id: string; error?: string }[] = json.failed || [];
      if (failed.length) {
        setDecisionError(
          `${failed.length} of ${ids.length} could not be processed: ${
            failed[0]?.error || "unknown error"
          }`,
        );
      }
      setBulkDecision(null);
      setSelected(new Set());
      setOpen(null);
      silentRefresh();
    } catch (error) {
      setDecisionError(
        error instanceof Error ? error.message : "Could not process the decisions",
      );
      setResponses(snapshot); // revert the optimistic sweep
    } finally {
      setBulkBusy(false);
    }
  }

  /**
   * Runs the authorship detector on one submission, only when a reviewer asks.
   * The bot stores the result, so it is paid for once unless a reviewer asks
   * again.
   */
  async function scanForAi(id: string) {
    setScanning(id);
    setScanError(null);
    try {
      const res = await fetch(`/api/manage/${guildId}/applicationaiscan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.detail || json.message || "Could not scan this submission",
        );
      }
      setScans((current) => ({ ...current, [id]: json.detection || { questions: {} } }));
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "Could not scan this submission",
      );
    } finally {
      setScanning(null);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Managers can delete a submission at any status. Optimistically drop it and
  // reconcile; restore on failure.
  async function remove(id: string) {
    setDeletingId(id);
    setDecisionError(null);
    const snapshot = responses;
    setResponses((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    setOpen((current) => (current === id ? null : current));
    try {
      const res = await fetch(`/api/manage/${guildId}/applicationresponsedelete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.message || "Could not delete the response");
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Could not delete the response");
      setResponses(snapshot); // restore
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Keeps the list current without a Refresh button. Paused while the tab is
   * hidden, while a decision is in flight, and while something is selected, so
   * a refresh never swaps the list under a click.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    const tick = () => {
      const busy = deciding !== null || bulkBusy || selected.size > 0;
      if (!document.hidden && !busy) void load();
      if (active) timer = setTimeout(tick, 20_000);
    };
    timer = setTimeout(tick, 20_000);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, deciding, bulkBusy, selected]);

  function questionLabel(id: string): string {
    return questions.find((q) => q.id === id)?.question || id;
  }

  return (
    <>
    <div className="responses-tab">
      {responses === null ? (
        <SkeletonRows rows={3} lead={false} label="Loading submissions…" />
      ) : responses.length === 0 ? (
        <div className="py-2">
          <p className="cool-text text-sm">No submissions yet.</p>
          <p className="mt-1 text-xs text-white/30">{emptyHint}</p>
        </div>
      ) : (
        (() => {
          const counts = { pending: 0, staging: 0, approved: 0, denied: 0 };
          for (const response of responses) counts[normStatus(response.status)]++;
          // Matches name, handle, id and the answers themselves.
          const term = search.trim().toLowerCase();
          const matches = (response: ApplicationResponse) => {
            if (!term) return true;
            const haystack = [
              response.userName,
              response.userHandle,
              response.userId,
              ...Object.values(response.answers || {}).map((value) =>
                Array.isArray(value) ? value.join(" ") : String(value ?? ""),
              ),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return haystack.includes(term);
          };
          const filtered = responses.filter(
            (response) =>
              normStatus(response.status) === statusFilter && matches(response),
          );
          // On mobile, the list or the detail (the detail only once a
          // submission is opened). On desktop both, with the first submission
          // selected.
          const explicitlyOpen =
            filtered.find((response) => response.id === open) || null;
          const chosen = explicitlyOpen || filtered[0] || null;
          // Counted against the visible list only, so "select all" always means
          // "all of the ones on screen".
          const selectedOnPage = filtered.filter((r) =>
            selected.has(r.id),
          ).length;
          const allOnPageSelected =
            filtered.length > 0 && selectedOnPage === filtered.length;
          const tabs: { id: SubmissionState; label: string }[] = [
            { id: "pending", label: "Pending" },
            // Only offered when the application actually holds decisions back;
            // an empty state nobody can reach is worse than no state at all.
            ...(stagingEnabled || counts.staging
              ? ([{ id: "staging", label: "Staging" }] as const)
              : []),
            { id: "approved", label: "Approved" },
            { id: "denied", label: "Denied" },
          ];
          const total = responses.length;
          // Pending is undecided; staging is decided but unreleased, so both
          // can still be acted on. Approved and denied are finished.
          const decidableFilter =
            statusFilter === "pending" || statusFilter === "staging";
          return (
            <div>
              {/* The tab's header: leads with the count, with the filter as four
                 states of one control. The rule across the top takes the
                 server's accent. */}
              <div className="responses-header">
                <span className="responses-header-rule" aria-hidden="true" />
                <div className="responses-header-body">
                  <div className="responses-header-top">
                    <p className="responses-header-count">
                      {total} {total === 1 ? "Response" : "Responses"}
                    </p>
                    {/* Publishing staged decisions is tab-wide, so it sits at
                       the top of the tab. */}
                    {canDecide && counts.staging > 0 ? (
                      <button
                        type="button"
                        disabled={publishing}
                        onClick={publishStaged}
                        className="btn-pop btn-peach inline-flex items-center gap-2 px-4 py-2 text-xs"
                      >
                        {publishing ? (
                          <IconLoader2 size={14} className="animate-spin" />
                        ) : (
                          <IconSend size={14} />
                        )}
                        Publish {counts.staging} staged
                      </button>
                    ) : null}
                  </div>
                  <div className="responses-status" role="tablist">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={statusFilter === t.id}
                        onClick={() => {
                          setStatusFilter(t.id);
                          setOpen(null);
                          // Never carry a pick across tabs — the reviewer
                          // would be acting on submissions they cannot see.
                          setSelected(new Set());
                        }}
                        className="responses-status-tab"
                      >
                        {t.label}
                        <span className="responses-status-count">
                          {counts[t.id]}
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Search shows as an icon until used and collapses again when
                     empty and unfocused. */}
                  <div
                    className="responses-search"
                    data-open={searchOpen || search ? "true" : "false"}
                  >
                    <button
                      type="button"
                      onClick={() => setSearchOpen((current) => !current)}
                      aria-expanded={searchOpen || Boolean(search)}
                      aria-label="Search submissions"
                      className="responses-search-toggle"
                    >
                      <IconSearch size={16} />
                    </button>
                    <input
                      type="search"
                      value={search}
                      autoFocus={searchOpen}
                      onBlur={() => {
                        if (!search.trim()) setSearchOpen(false);
                      }}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setOpen(null);
                        // A pick made under a wider filter is not visible under
                        // a narrower one, and must not ride into a batch.
                        setSelected(new Set());
                      }}
                      placeholder="Search submissions"
                      aria-label="Search submissions"
                    />
                  </div>
                </div>
              </div>
              {/* Bulk review bar. Appears only once something is ticked so it
                  never takes up room during ordinary one-at-a-time review. */}
              {/* Bulk review only in filters with something to decide
                 (re-approving an approved submission would resend the DM and
                 reapply roles). */}
              {canDecide && decidableFilter && selectedOnPage > 0 ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--accent-peach)_28%,transparent)] bg-[color-mix(in_srgb,var(--accent-peach)_7%,transparent)] px-3 py-2">
                  <span className="text-xs font-bold text-white/80">
                    {selectedOnPage} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-semibold text-white/45 underline-offset-2 transition-colors hover:text-white/75 hover:underline"
                  >
                    Clear
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkDecision("approve")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--tone-ok-line)] bg-[var(--tone-ok-wash)] px-3 py-2 text-xs font-bold text-[var(--tone-ok)] transition-colors hover:bg-[var(--tone-ok-wash)]"
                    >
                      <IconCheck size={13} />
                      Approve all
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkDecision("deny")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-wash)] px-3 py-2 text-xs font-bold text-[var(--tone-bad)] transition-colors hover:bg-[var(--tone-bad-wash)]"
                    >
                      <IconX size={13} />
                      Deny all
                    </button>
                  </div>
                </div>
              ) : null}
              {filtered.length === 0 ? (
                <p className="cool-text text-sm">
                  No {statusFilter} submissions.
                </p>
              ) : (
                // The list takes a share of the width rather than a fixed
                // 280px.
                <div className="grid gap-5 lg:grid-cols-[minmax(17.5rem,23%)_minmax(0,1fr)]">
                  {/* Left: response list. Hidden on mobile once a submission is
                      opened (the detail takes over). */}
                  <div className={`space-y-2 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto ${explicitlyOpen ? "hidden lg:block" : "block"}`}>
                    {canDecide && filtered.length > 1 ? (
                      <label className="mb-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white/45 transition-colors hover:text-white/70">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          ref={(node) => {
                            // Partial picks read as indeterminate rather than
                            // pretending the whole page is selected.
                            if (node)
                              node.indeterminate =
                                selectedOnPage > 0 && !allOnPageSelected;
                          }}
                          onChange={() =>
                            setSelected(
                              allOnPageSelected
                                ? new Set()
                                : new Set(filtered.map((r) => r.id)),
                            )
                          }
                          className="h-3.5 w-3.5 shrink-0 accent-[var(--accent-peach)]"
                        />
                        {selectedOnPage
                          ? `${selectedOnPage} selected`
                          : `Select all ${filtered.length}`}
                      </label>
                    ) : null}
                    {filtered.map((response) => (
                      <div
                        key={response.id}
                        className={`flex w-full items-center gap-2 rounded-xl border pr-1 transition-colors ${chosen?.id === response.id ? "border-white/20 bg-white/[0.04]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"}`}
                      >
                        {/* No checkboxes where nothing can be decided. */}
                        {canDecide && decidableFilter ? (
                          <label
                            className="flex shrink-0 cursor-pointer items-center py-4 pl-4"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(response.id)}
                              onChange={() => toggleSelected(response.id)}
                              aria-label={`Select ${response.userName || "submission"}`}
                              className="h-3.5 w-3.5 accent-[var(--accent-peach)]"
                            />
                          </label>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setOpen(response.id)}
                          className={`flex min-w-0 flex-1 items-center gap-3 py-3 text-left ${canDecide ? "" : "pl-3"}`}
                        >
                        {response.userAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={discordAvatarUrl(response.userAvatar) || ""}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-white/50">
                            {(response.userName || "?").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#f5f2f2]">
                            {response.userName || response.userId || "Unknown"}
                          </p>
                          <p className="cool-text truncate text-[11px]">
                            {response.createdAt
                              ? new Date(response.createdAt).toLocaleDateString()
                              : ""}
                          </p>
                        </div>
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Right: selected submission detail. On mobile it only shows
                      once a submission is opened, with a back button. */}
                  {chosen ? (
                    // The cards stack in a plain column, with no border around
                    // them.
                    <div className={`submission-detail ${explicitlyOpen ? "block" : "hidden lg:block"}`}>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className="flex w-full items-center gap-2 border-b border-white/[0.08] px-4 py-3 text-xs font-semibold text-white/55 hover:text-white lg:hidden"
                      >
                        <IconArrowLeft size={14} />
                        Back to submissions
                      </button>
                      {/* Who this is, then how it was decided. */}
                      {/* Actions sit above the card, away from the applicant's
                         details. */}
                      <div className="submission-actions">
                          {chosen.score != null ? (
                            <span className="rounded-xl bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-white/70">
                              {chosen.score}/{chosen.maxScore} pts
                            </span>
                          ) : null}
                          {/* No status chip: the tab's filter already shows the
                             state. */}
                          <AiScanButton
                            busy={scanning === chosen.id}
                            scanned={Boolean(
                              scans[chosen.id] || chosen.aiDetection,
                            )}
                            onScan={() => void scanForAi(chosen.id)}
                          />
                          {canDecide ? (
                            <button
                              type="button"
                              disabled={deletingId === chosen.id}
                              onClick={() =>
                                setConfirm({
                                  title: "Delete response",
                                  body: "This permanently deletes the response. This can't be undone.",
                                  confirmLabel: "Delete",
                                  danger: true,
                                  onConfirm: () => remove(chosen.id),
                                })
                              }
                              title="Delete this response"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.08] text-white/40 transition-colors hover:border-[var(--tone-bad-line)] hover:bg-[var(--tone-bad-soft)] hover:text-[var(--tone-bad)] disabled:opacity-40"
                            >
                              {deletingId === chosen.id ? (
                                <IconLoader2 size={14} className="animate-spin" />
                              ) : (
                                <IconTrash size={14} />
                              )}
                            </button>
                          ) : null}
                      </div>
                      <SubmissionIdentity response={chosen} />
                      <SubmissionDecision response={chosen} />
                      <AiScanSummary
                        detection={scans[chosen.id] || chosen.aiDetection}
                        error={scanning === chosen.id ? null : scanError}
                      />
                      {/* The submitted answers — the form's own cards, at the
                          form's own spacing. */}
                      <div className="space-y-4">
                        {Object.keys(chosen.answers).length === 0 ? (
                          <p className="cool-text text-sm">No answers recorded.</p>
                        ) : (
                          Object.entries(chosen.answers).map(
                            ([id, answer]) => (
                              <SubmittedAnswer
                                key={id}
                                question={questions.find((q) => q.id === id)}
                                fallbackLabel={questionLabel(id)}
                                answer={answer}
                                integrity={chosen.integrity?.[id]}
                                ai={
                                  (scans[chosen.id] || chosen.aiDetection)
                                    ?.questions?.[id]
                                }
                              />
                            ),
                          )
                        )}
                      </div>
                      {/* A staged decision and which way it points. The switch
                         flips it until it is published. */}
                      {canDecide && stagedVerdict(chosen.status) ? (
                        <div className="staged-bar">
                          <div className="min-w-0">
                            <p className="staged-bar-title">Held for release</p>
                            <p className="staged-bar-hint">
                              Nothing has been sent yet. Publish to apply this.
                            </p>
                          </div>
                          <div className="staged-switch" role="group">
                            {(["approved", "denied"] as const).map((verdict) => (
                              <button
                                key={verdict}
                                type="button"
                                disabled={deciding !== null}
                                aria-pressed={stagedVerdict(chosen.status) === verdict}
                                onClick={() =>
                                  decide(
                                    chosen.id,
                                    verdict === "approved" ? "approve" : "deny",
                                  )
                                }
                                className="staged-switch-option"
                                data-verdict={verdict}
                              >
                                {verdict === "approved" ? "Accepted" : "Denied"}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {/* Approve and deny at the foot of the submission, after
                         the answers they judge. */}
                      {canDecide && (chosen.status || "pending") === "pending" ? (
                        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] p-4 sm:p-5">
                          <button
                            type="button"
                            disabled={deciding !== null}
                            onClick={() => decide(chosen.id, "approve")}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--tone-ok-line)] bg-[var(--tone-ok-wash)] px-3 py-2 text-sm font-bold text-[var(--tone-ok)] transition-colors hover:bg-[var(--tone-ok-wash)] disabled:opacity-40"
                          >
                            {deciding === `${chosen.id}:approve` ? (
                              <IconLoader2 size={15} className="animate-spin" />
                            ) : (
                              <IconCheck size={15} />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={deciding !== null}
                            onClick={() => decide(chosen.id, "deny")}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-3 py-2 text-sm font-bold text-[var(--tone-bad)] transition-colors hover:bg-[var(--tone-bad-wash)] disabled:opacity-40"
                          >
                            {deciding === `${chosen.id}:deny` ? (
                              <IconLoader2 size={15} className="animate-spin" />
                            ) : (
                              <IconX size={15} />
                            )}
                            Deny
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
    <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    <BulkDecisionModal
      decision={bulkDecision}
      count={selected.size}
      busy={bulkBusy}
      onCancel={() => setBulkDecision(null)}
      onConfirm={(reason) => {
        if (bulkDecision) decideMany(bulkDecision, reason);
      }}
    />
    </>
  );
}
