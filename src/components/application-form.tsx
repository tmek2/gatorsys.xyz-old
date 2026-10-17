"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconLink,
  IconLoader2,
  IconSend,
} from "@tabler/icons-react";
import { DiscordLogo } from "@/components/brand-icons";
import { PreviewText } from "@/components/Manage/embed-editor";
import { createIntegrityTracker } from "@/components/application-integrity";
import { ConfirmModal, type ConfirmState } from "@/components/confirm-modal";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import {
  FormQuestionCard,
  type FormQuestion,
} from "@/components/form-question-field";

type Question = FormQuestion;

interface FormData {
  guild: { name: string; icon: string | null };
  application: {
    id: string;
    name: string;
    description: string | null;
    accent_color: string | null;
    questions: Question[];
    responses_open: boolean;
    require_roblox?: boolean;
  };
  eligible: boolean;
  alreadySubmitted: boolean;
}

type Viewer = { id: string; name: string; image?: string | null };
type RobloxIdentity = {
  linked: boolean;
  id?: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  avatar?: string | null;
};

type QuestionPage = {
  id: string;
  title?: string;
  description?: string;
  questions: Question[];
};

function buildQuestionPages(questions: Question[]): QuestionPage[] {
  const pages: QuestionPage[] = [{ id: "page-1", questions: [] }];
  for (const question of questions) {
    if (question.type === "section") {
      pages.push({
        id: question.id,
        title: question.question || "Untitled section",
        description: question.description,
        questions: [],
      });
    } else {
      pages[pages.length - 1].questions.push(question);
    }
  }
  if (pages.length > 1 && pages[0].questions.length === 0) pages.shift();
  return pages.length ? pages : [{ id: "page-1", questions: [] }];
}

/** Sign in, then come back to this exact page. */
export function ApplicationSignInGate({
  guildId,
  appId,
}: {
  guildId: string;
  appId: string;
}) {
  const pathname = usePathname();
  const callbackUrl =
    pathname && pathname.startsWith("/")
      ? pathname
      : `/application/${guildId}/${appId}`;
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-peach)_10%,transparent)] text-[var(--accent-peach)]">
        <DiscordLogo size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-[#f5f2f2]">
        Link Discord to continue
      </h1>
      <p className="cool-text mt-2 text-sm leading-6">
        Applications are tied to your Discord identity so the server can check
        eligibility and deliver the response to the right account.
      </p>
      <Link
        href={getDiscordSignInUrl(callbackUrl)}
        className="btn-pop btn-peach mt-6 inline-flex h-10 items-center gap-2 px-5 text-sm"
      >
        <IconLink size={16} />
        Link Discord
      </Link>
    </div>
  );
}

/** Roblox headshot for the shared-identity card — the real avatar, with a
 *  letter-circle fallback instead of a placeholder cube. */
function RobloxAvatar({ roblox }: { roblox: RobloxIdentity }) {
  const label = (roblox.username || roblox.displayName || "?").slice(0, 2).toUpperCase();
  if (roblox.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={roblox.avatar}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full bg-white/[0.06] object-cover"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-bold text-white/60">
      {label}
    </span>
  );
}

export function ApplicationForm({
  guildId,
  appId,
  viewer,
  embedded = false,
  onSubmitted,
  caseId = null,
}: {
  guildId: string;
  appId: string;
  viewer: Viewer;
  embedded?: boolean;
  onSubmitted?: () => void;
  /** The infraction being appealed, from `?case=` on the appeal button. */
  caseId?: string | null;
}) {
  const [data, setData] = useState<FormData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "notfound">(
    "loading",
  );
  const [answers, setAnswers] = useState<Record<string, any>>({});
  // Per-question authorship signals in a ref, so typing does not re-render the
  // form on every keystroke.
  const integrity = useRef(createIntegrityTracker());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(-1);
  const [roblox, setRoblox] = useState<RobloxIdentity | null>(null);
  const [robloxLoading, setRobloxLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  // Autosave draft answers so a refresh / accidental tab close never loses work.
  const draftKey = `gator-app-draft-${guildId}-${appId}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") setAnswers(parsed);
      }
    } catch {
      /* ignore malformed drafts */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    try {
      if (Object.keys(answers).length)
        localStorage.setItem(draftKey, JSON.stringify(answers));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [answers, draftKey]);

  // Clear the saved draft for people who don't want their progress kept.
  const resetProgress = () => {
    setAnswers({});
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setPageIndex(-1);
  };

  useEffect(() => {
    fetch(`/api/application/${guildId}/${appId}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) {
          setStatus("notfound");
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        if (json) {
          setData(json);
          setStatus("ok");
        }
      })
      .catch(() => setStatus("error"));
  }, [guildId, appId]);

  const accent = data?.application.accent_color || "#f7a8c4";
  // Pick readable text for the accent so themed buttons work for light (peach)
  // and dark (blue) accents alike.
  const accentText = (() => {
    const hex = accent.replace("#", "");
    if (hex.length < 6) return "#0b0b0b";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#0b0b0b" : "#ffffff";
  })();
  const questions = data?.application.questions || [];
  const questionPages = useMemo(
    () => buildQuestionPages(questions),
    [questions],
  );
  const activePage = pageIndex >= 0 ? questionPages[pageIndex] : null;
  const pageHasRequired = (activePage?.questions || []).some(
    (q) => q.type !== "section" && q.required !== false,
  );

  const [showIssues, setShowIssues] = useState(false);
  // Clear the incomplete indicator once the applicant edits or changes page.
  useEffect(() => {
    setShowIssues(false);
  }, [answers, pageIndex]);

  /** Human hint for a validation rule (mirrors the builder's descriptions). */
  function describeRule(rule: any): string {
    if (rule?.message) return String(rule.message);
    switch (rule?.type) {
      case "length":
        if (rule.min != null && rule.max != null)
          return `Must be between ${rule.min} and ${rule.max} characters`;
        if (rule.min != null) return `Must be at least ${rule.min} characters`;
        if (rule.max != null) return `Must be at most ${rule.max} characters`;
        return "Invalid length";
      case "starts_with":
        return `Must start with "${rule.value ?? ""}"`;
      case "ends_with":
        return `Must end with "${rule.value ?? ""}"`;
      case "contains":
        return `Must contain "${rule.value ?? ""}"`;
      case "excludes":
        return `Must not contain "${rule.value ?? ""}"`;
      case "number_range":
        return `Must be between ${rule.min ?? "?"} and ${rule.max ?? "?"}`;
      case "minimum_words":
        return `Must be at least ${rule.min ?? 1} words`;
      default:
        return "Invalid input";
    }
  }

  /** Lightweight client-side check of the active page's required answers and
   *  validation rules — surfaces missing/invalid answers before proceeding. */
  function collectIssuesThroughPage(lastPageIndex: number, firstPageIndex = 0) {
    const issues: { label: string; messages: string[] }[] = [];
    const visibleQuestions = questionPages
      .slice(Math.max(0, firstPageIndex), Math.max(0, lastPageIndex) + 1)
      .flatMap((page) => page.questions || []);
    for (const q of visibleQuestions) {
      if (q.type === "section") continue;
      const value = answers[q.id];
      const messages: string[] = [];
      const empty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);
      if (q.required !== false && empty) {
        messages.push("This question requires an answer");
      }
      if (!empty && typeof value === "string" && Array.isArray(q.validation)) {
        for (const rule of q.validation as any[]) {
          const text = value;
          let ok = true;
          switch (rule?.type) {
            case "length": {
              const len = text.length;
              if (rule.min != null && len < Number(rule.min)) ok = false;
              if (rule.max != null && len > Number(rule.max)) ok = false;
              break;
            }
            case "starts_with":
              ok = text.startsWith(String(rule.value ?? ""));
              break;
            case "ends_with":
              ok = text.endsWith(String(rule.value ?? ""));
              break;
            case "contains":
              ok = text.includes(String(rule.value ?? ""));
              break;
            case "excludes":
              ok = !text.includes(String(rule.value ?? ""));
              break;
            case "regex":
              try {
                ok = new RegExp(String(rule.pattern ?? "")).test(text);
              } catch {
                ok = true;
              }
              break;
            // These two had descriptions but no check, so an answer outside the
            // range or under the word count sailed through.
            case "number_range": {
              const numeric = Number(text.trim());
              if (!Number.isFinite(numeric)) {
                ok = false;
              } else {
                if (rule.min != null && numeric < Number(rule.min)) ok = false;
                if (rule.max != null && numeric > Number(rule.max)) ok = false;
              }
              break;
            }
            case "minimum_words": {
              const words = text.trim().split(/\s+/).filter(Boolean).length;
              ok = words >= Number(rule.min ?? 1);
              break;
            }
            default:
              ok = true;
          }
          if (!ok) messages.push(describeRule(rule));
        }
      }
      if (messages.length)
        issues.push({ label: q.question || "Question", messages });
    }
    return issues;
  }

  const sectionIssues = useMemo(
    () => collectIssuesThroughPage(pageIndex),
    [answers, pageIndex, questionPages],
  );
  // Just this page. Moving on is gated on it, so the message has to name what
  // is wrong here rather than counting everything behind the applicant too.
  const currentPageIssues = useMemo(
    () => collectIssuesThroughPage(pageIndex, pageIndex),
    [answers, pageIndex, questionPages],
  );
  const allIssues = useMemo(
    () => collectIssuesThroughPage(questionPages.length - 1),
    [answers, questionPages],
  );

  useEffect(() => {
    if (!data?.application.require_roblox) return;
    let cancelled = false;
    fetch("/api/account/roblox", { cache: "no-store" })
      .then((response) =>
        response.ok ? response.json() : { roblox: { linked: false } },
      )
      .then((payload) => {
        if (!cancelled) setRoblox(payload.roblox || { linked: false });
      })
      .catch(() => {
        if (!cancelled) setRoblox({ linked: false });
      });
    return () => {
      cancelled = true;
    };
  }, [data?.application.require_roblox]);

  async function linkRoblox() {
    setRobloxLoading(true);
    setError(null);
    try {
      const start = await fetch("/api/account/roblox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const session = await start.json().catch(() => ({}));
      if (!start.ok)
        throw new Error(
          session.detail ||
            session.message ||
            "Could not start Roblox verification",
        );
      if (session.status === "verified" && session.roblox) {
        setRoblox(session.roblox);
        return;
      }
      const popup = window.open(
        session.verifyUrl,
        "gator-roblox-verification",
        "popup=yes,width=560,height=760",
      );
      if (!popup) throw new Error("Allow popups to verify your Roblox account");
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const response = await fetch("/api/account/roblox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", sid: session.sid }),
        });
        const statusPayload = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(
            statusPayload.detail ||
              `Roblox verification is cooling down. Try again in ${statusPayload.retryAfter || 60} seconds.`,
          );
        }
        if (statusPayload.status === "verified" && statusPayload.roblox) {
          setRoblox(statusPayload.roblox);
          popup.close();
          return;
        }
        if (["expired", "failed", "cancelled"].includes(statusPayload.status)) {
          throw new Error(
            statusPayload.message || "Roblox verification did not complete",
          );
        }
        if (popup.closed && attempt > 3) break;
      }
      throw new Error("Roblox verification was not completed");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Roblox verification failed",
      );
    } finally {
      setRobloxLoading(false);
    }
  }

  const missing = useMemo(() => {
    return questions.filter((q) => {
      if (q.type === "section" || q.required === false) return false;
      const value = answers[q.id];
      if (q.type === "multiple_choice_multi")
        return !Array.isArray(value) || value.length === 0;
      if (q.type === "boolean") return false;
      return value == null || value === "";
    });
  }, [questions, answers]);

  async function submit() {
    if (missing.length > 0) {
      setError("Please answer all required questions.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/application/${guildId}/${appId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          integrity: integrity.current.snapshot(),
          // Only when there is one, so an ordinary application does not carry
          // an empty appeal field into every submission record.
          ...(caseId ? { caseId } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(json?.detail || json?.message || "Submission failed");
      setSubmitted(json.submissionStatus || "pending");
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      if (json.submittedMessage)
        setSubmittedMessage(String(json.submittedMessage));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className={`flex items-center justify-center ${embedded ? "min-h-48" : "min-h-[60vh]"}`}>
        <IconLoader2 size={28} className="animate-spin text-white/40" />
      </div>
    );
  }
  if (status === "notfound" || status === "error") {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 text-center ${embedded ? "min-h-48" : "min-h-[60vh]"}`}>
        <Image
          src="/gator-logo.png"
          alt=""
          width={44}
          height={44}
          className="opacity-40"
        />
        <h1 className="text-xl font-extrabold text-[#f5f2f2]">
          Application unavailable
        </h1>
        <p className="cool-text max-w-sm text-sm">
          This application doesn&apos;t exist, isn&apos;t accepting responses,
          or you&apos;re not in the server.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`mx-auto flex max-w-lg flex-col items-center justify-center gap-4 text-center ${embedded ? "min-h-64 py-6" : "min-h-[60vh]"}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--tone-ok-wash)] text-[var(--tone-ok)]">
          <IconCircleCheck size={30} />
        </span>
        <h1 className="text-2xl font-extrabold text-[#f5f2f2]">
          {submitted === "auto_failed"
            ? "Application received"
            : "Application submitted"}
        </h1>
        {submittedMessage ? (
          <p className="max-w-md rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white/80">
            {submittedMessage}
          </p>
        ) : null}
        <p className="cool-text text-sm">
          Thanks for applying to{" "}
          <span className="text-white/80">{data?.application.name}</span> in{" "}
          {data?.guild.name}. You can check its status with{" "}
          <code className="rounded bg-white/[0.06] px-2 py-1 text-[var(--accent-peach)]">
            the application page
          </code>{" "}
          in the server.
        </p>
        {embedded ? (
          <button
            type="button"
            onClick={onSubmitted}
            className="btn-pop btn-peach h-9 px-4 text-sm"
          >
            Done
          </button>
        ) : (
          <Link
            href="/servers"
            className="btn-pop btn-peach h-9 px-4 text-sm leading-9"
          >
            Back to dashboard
          </Link>
        )}
      </div>
    );
  }

  const disabled =
    !data?.eligible ||
    data?.alreadySubmitted ||
    !data?.application.responses_open;
  const identityReady =
    !data?.application.require_roblox || Boolean(roblox?.linked);

  return (
    <div
      className={`app-respond mx-auto w-full ${embedded ? "max-w-3xl pb-2" : ""}`}
      // The application's chosen colour drives every accent on the form.
      style={{ "--accent-peach": accent } as React.CSSProperties}
    >
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1b1b1b]">
        <div className="h-1.5" style={{ backgroundColor: accent }} />
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-extrabold text-[#f5f2f2]">
            {data?.application.name}
          </h1>
          {data?.application.description ? (
            <div className="cool-text mt-2 text-pretty text-[15px] leading-relaxed">
              <PreviewText text={data.application.description} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Shared-identity + progress card — kept visible on every section so the
          applicant always sees what's shared and can reset their draft. */}
      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#1b1b1b] px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-3 text-sm text-white/70">
              <IconCircleCheck size={18} className="shrink-0 text-[var(--tone-ok)]" />
              Your Discord profile is shared with application reviewers
            </div>
            {data?.application.require_roblox ? (
              roblox?.linked ? (
                <>
                  <div className="flex items-center gap-3">
                    <RobloxAvatar roblox={roblox} />
                    <span className="text-sm font-bold text-white">
                      {roblox.username || roblox.displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <IconCircleCheck size={18} className="shrink-0 text-[var(--tone-ok)]" />
                    Your Roblox profile is shared with application reviewers
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={linkRoblox}
                  disabled={robloxLoading || roblox === null}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/25 disabled:opacity-45"
                >
                  {robloxLoading || roblox === null ? (
                    <IconLoader2 size={14} className="animate-spin" />
                  ) : (
                    <IconLink size={14} />
                  )}
                  {robloxLoading
                    ? "Verifying..."
                    : roblox === null
                      ? "Checking..."
                      : "Link your Roblox account"}
                </button>
              )
            ) : null}
          </div>
          <button
            type="button"
            onClick={() =>
              setConfirm({
                title: "Reset progress",
                body: "This clears your saved answers for this application. This can't be undone.",
                confirmLabel: "Reset",
                danger: true,
                onConfirm: resetProgress,
              })
            }
            title="Clear your saved answers"
            className="shrink-0 text-xs font-semibold text-white/40 underline-offset-2 transition-colors hover:text-white/75 hover:underline"
          >
            Reset progress
          </button>
        </div>
      </div>

      {pageIndex === -1 && !disabled ? (
        <button
          type="button"
          disabled={!identityReady}
          onClick={() => setPageIndex(0)}
          style={{ backgroundColor: accent, color: accentText }}
          className="btn-pop mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <IconArrowRight size={16} />
        </button>
      ) : null}

      {disabled ? (
        <p className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white/70">
          {data?.alreadySubmitted
            ? "You've already submitted this application."
            : !data?.eligible
              ? "You don't have the required role to apply."
              : "This application isn't accepting responses right now."}
        </p>
      ) : null}

      {pageIndex === -1 ? null : (
        <>
          {/* Section title card — clean and simple (no page counter or pills). */}
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#1b1b1b] p-5 sm:p-6">
            <h2 className="text-2xl font-extrabold text-[#f5f2f2]">
              {activePage?.title || data?.application.name}
            </h2>
            {activePage?.description ? (
              <div className="cool-text mt-2 text-pretty text-sm">
                <PreviewText text={activePage.description} />
              </div>
            ) : null}
            {/* The asterisks on individual questions only mean something if the
             *  form says what they mean. */}
            {pageHasRequired ? (
              <p className="mt-3 border-t border-white/[0.08] pt-3 text-[13px] font-medium text-[var(--tone-bad)]">
                <span aria-hidden="true">*</span> Indicates required question
              </p>
            ) : null}
          </div>
          <div className="mt-4 space-y-4">
            {(activePage?.questions || []).map((q) => {
              const value = answers[q.id];
              const set = (next: any) => {
                // Only text answers carry a typed/pasted distinction; a radio
                // or a date has nothing meaningful to measure.
                if (typeof next === "string") {
                  const before = typeof value === "string" ? value.length : 0;
                  integrity.current.typed(q.id, next.length - before);
                }
                setAnswers((prev) => ({ ...prev, [q.id]: next }));
              };
              const authorship = {
                onPaste: (event: React.ClipboardEvent) => {
                  const text = event.clipboardData?.getData("text") || "";
                  integrity.current.paste(q.id, text.length);
                  // The paste also fires onChange, which would count the same
                  // characters as typed. Discount them there.
                  integrity.current.typed(q.id, -text.length);
                },
                onFocus: () => integrity.current.focus(q.id),
                onBlur: () => integrity.current.blur(q.id),
              };
              return (
                <FormQuestionCard
                  key={q.id}
                  question={q}
                  value={value}
                  onChange={set}
                  disabled={disabled}
                  authorship={authorship}
                />
              );
            })}
          </div>
        </>
      )}

      {error ? (
        <p className="mt-4 rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-4 py-3 text-sm text-[var(--tone-bad)]">
          {error}
        </p>
      ) : null}

      {!disabled && pageIndex >= 0 ? (
        <div className="relative mt-6 flex items-center gap-3 pb-2">
          {pageIndex > 0 ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowIssues(false);
                setPageIndex((current) => current - 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              style={{ backgroundColor: accent, color: accentText }}
              className="btn-pop inline-flex h-12 flex-1 items-center justify-center gap-2 text-[15px] font-bold transition-opacity hover:opacity-90"
            >
              <IconArrowLeft size={18} />
              Back
            </button>
          ) : null}
          {pageIndex < questionPages.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                // No moving on with this page unanswered or answered wrongly —
                // the click opens the list of what needs fixing instead.
                if (currentPageIssues.length) {
                  setShowIssues(true);
                  return;
                }
                setError(null);
                setShowIssues(false);
                setPageIndex((current) => current + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-disabled={currentPageIssues.length > 0}
              title={
                currentPageIssues.length > 0
                  ? `${currentPageIssues.length} question${currentPageIssues.length === 1 ? "" : "s"} on this page need${currentPageIssues.length === 1 ? "s" : ""} attention`
                  : undefined
              }
              style={
                currentPageIssues.length
                  ? undefined
                  : { backgroundColor: accent, color: accentText }
              }
              className={`btn-pop inline-flex h-12 flex-1 items-center justify-center gap-2 text-[15px] font-bold transition-opacity ${
                currentPageIssues.length
                  ? "cursor-not-allowed border border-white/[0.08] bg-white/[0.06] text-white/45"
                  : "hover:opacity-90"
              }`}
            >
              {currentPageIssues.length
                ? `${currentPageIssues.length} to fix on this page`
                : "Next"}
              <IconArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (allIssues.length) {
                  setShowIssues(true);
                  return;
                }
                void submit();
              }}
              disabled={submitting || allIssues.length > 0}
              title={
                allIssues.length > 0
                  ? `${allIssues.length} question${allIssues.length === 1 ? "" : "s"} need attention across the form`
                  : undefined
              }
              style={{ backgroundColor: accent, color: accentText }}
              className="btn-pop inline-flex h-12 flex-1 items-center justify-center gap-2 text-[15px] font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <IconLoader2 size={18} className="animate-spin" />
              ) : (
                <IconSend size={18} />
              )}
              {submitting
                ? "Submitting…"
                : allIssues.length > 0
                  ? `${allIssues.length} to fix`
                  : "Submit application"}
            </button>
          )}
          {/* Red indicator when the section has missing/invalid answers. */}
          {sectionIssues.length ? (
            <span className="group/ind relative shrink-0">
              <button
                type="button"
                onClick={() => setShowIssues((v) => !v)}
                aria-label="Show incomplete or invalid questions"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--tone-bad-wash)] text-[var(--tone-bad)] transition-colors hover:bg-[var(--tone-bad-wash)]"
              >
                <IconAlertCircle size={18} />
              </button>
              <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden w-max max-w-[220px] rounded-xl border border-white/[0.08] bg-[#141414] px-3 py-2 text-[11px] font-semibold text-white/80 shadow-xl group-hover/ind:block">
                Some required questions are missing or invalid. Click to see them
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      {showIssues && sectionIssues.length ? (
        <div className="gator-overlay fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowIssues(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="dialog-pop relative flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-[var(--tone-bad-line)] bg-[#161616]">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-5 py-4">
              <IconAlertCircle size={20} className="text-[var(--tone-bad)]" />
              <h3 className="text-base font-extrabold text-white">
                Questions to complete
              </h3>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {sectionIssues.map((issue, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
                >
                  <p className="text-sm font-bold text-white/90">
                    {issue.label}
                  </p>
                  {issue.messages.map((message, mi) => (
                    <p key={mi} className="mt-1 text-[13px] text-[var(--tone-bad)]">
                      {message}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <p className="border-t border-white/[0.08] px-5 py-3 text-center text-xs text-white/50">
              This includes the current page and every earlier page. The next
              page unlocks once this one is answered correctly.
            </p>
          </div>
        </div>
      ) : null}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
