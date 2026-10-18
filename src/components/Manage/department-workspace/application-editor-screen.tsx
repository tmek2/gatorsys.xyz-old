"use client";

import React, { useEffect, useRef, useState } from "react";
import { DevelopingImage } from "@/components/motion";
import {
  verdictFor,
  type AiDetection,
  type QuestionIntegrity,
} from "@/components/application-integrity";
import { AuthorshipNotes, AuthorshipTags } from "../authorship-notes";
import { createPortal } from "react-dom";
import {
  IconArrowLeft,
  IconCheck,
  IconClipboard,
  IconUpload,
  IconLink,
  IconListCheck,
  IconLoader2,
  IconRobot,
  IconSend,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import { ChannelPicker, FieldRow, SettingsCard, TextAreaField, TextField, Toggle } from "../fields";
import { StatusPill, StatusDot } from "../indicator";
import type { DepartmentProfile, ManagedChannel } from "../types";
import { QuestionList } from "./questions";
import { formatDuration, parseServerDate } from "./shared";

/* One application: its editor and its submissions. */

function SubmissionsPanel({
  profile,
  resources,
  responses,
  initialOpenId,
  onRefresh,
}: {
  profile: DepartmentProfile;
  resources: any[];
  responses: any[];
  initialOpenId?: string | null;
  onRefresh: () => Promise<void>;
}) {
  const { guildId, setNotice, portalBase } = useWorkspaceHost();
  const [open, setOpen] = useState<any | null>(
    initialOpenId
      ? responses.find((item: any) => item.id === initialOpenId) || null
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [answerTab, setAnswerTab] = useState(0);
  // Authorship scans run in this sitting, keyed by submission id.
  const [scans, setScans] = useState<Record<string, AiDetection>>({});
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    setAnswerTab(0);
  }, [open]);

  /**
   * The two authorship signals for one answer on the open submission:
   * `integrity` (counted by the form, always present) and `ai` (only after a
   * reviewer runs a scan). Both per question.
   */
  const openDetection: AiDetection | undefined = open
    ? scans[String(open.id)] || open.ai_detection || open.aiDetection
    : undefined;
  const integrityFor = (key: string): QuestionIntegrity | undefined => {
    const rows = open?.integrity?.questions || open?.integrity;
    const row = rows && typeof rows === "object" ? rows[key] : undefined;
    // The older whole-submission shape uses the same key without per-question
    // rows, so it is ignored here.
    return row && typeof row === "object" && "typed" in row
      ? (row as QuestionIntegrity)
      : undefined;
  };

  /** Scan the open submission. Manage-side only: the endpoint is guarded by
   *  Manage Server, which a department portal visitor does not have. */
  async function scanForAi() {
    if (!open) return;
    setScanning(true);
    try {
      const result = await fetch(`/api/manage/${guildId}/applicationaiscan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission: open.id }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok)
        throw new Error(data.detail || data.message || "Could not scan this submission");
      setScans((current) => ({
        ...current,
        [String(open.id)]: data.detection || { questions: {} },
      }));
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not scan this submission",
      });
    } finally {
      setScanning(false);
    }
  }
  async function review(response: any, status: "accepted" | "denied") {
    setBusy(true);
    try {
      const result = await fetch(`/api/manage/${guildId}/deptresources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          id: response.id,
          status,
          note: note.trim() || undefined,
        }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok)
        throw new Error(data.detail || "Could not update the submission");
      await onRefresh();
      setOpen(null);
      setNote("");
      setNotice({ kind: "saved", text: data.message || `Submission ${status}` });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not update the submission",
      });
    } finally {
      setBusy(false);
    }
  }
  const [copiedResponseId, setCopiedResponseId] = useState<string | null>(null);
  function copyResponseLink(response: any) {
    const link = `${window.location.origin}/departments/${guildId}/${profile.id}?tab=resources&app=${response.resource_id}&response=${response.id}`;
    void navigator.clipboard.writeText(link);
    setCopiedResponseId(String(response.id));
    window.setTimeout(() => setCopiedResponseId(null), 1600);
    setNotice({ kind: "saved", text: "Response link copied" });
  }
  const statusChip = (status?: string) =>
    status === "accepted" ? (
      <StatusPill tone="ok">Accepted</StatusPill>
    ) : status === "denied" ? (
      <StatusPill tone="bad">Denied</StatusPill>
    ) : (
      <StatusPill tone="warn">Pending</StatusPill>
    );
  return (
    <SettingsCard
      title="Application submissions"
      description="Review submissions and notify applicants on Discord."
    >
      {Array.from(
        responses.reduce((groups: Map<string, any[]>, response: any) => {
          const key = String(response.resource_id || "unknown");
          groups.set(key, [...(groups.get(key) || []), response]);
          return groups;
        }, new Map<string, any[]>()),
      ).map(([resourceId, group]) => {
        const application = resources.find((item) => item.id === resourceId);
        const pending = group.filter((item: any) => !item.status).length;
        return (
          <div key={resourceId} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
              <IconClipboard size={15} className="text-[var(--accent-peach)]" />
              <p className="text-sm font-bold text-white/85">
                {application?.title || group[0]?.resource_title || "Application"}
              </p>
              <span className="cool-text text-xs">
                {group.length} submission{group.length === 1 ? "" : "s"}
              </span>
              {pending ? (
                <StatusPill tone="warn" className="ml-auto">
                  {pending} pending
                </StatusPill>
              ) : null}
            </div>
            {group.map((response: any) => (
              <div
                key={response.id}
                className="flex w-full flex-wrap items-center gap-3 border-b border-white/[0.05] py-3 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => setOpen(response)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-white/80">
                    {response.user_name || response.user_id}
                    {response.join_request ? (
                      <span className="rounded bg-[rgb(var(--accent-rgb)/0.12)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--accent-peach)]">
                        Join request
                      </span>
                    ) : null}
                    {(response.integrity?.flags || []).length ? (
                      <span
                        className="rounded bg-[var(--tone-bad-soft)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tone-bad)]"
                        title={(response.integrity.flags || []).join("\n")}
                      >
                        Flagged
                      </span>
                    ) : null}
                  </p>
                  <p className="cool-text truncate text-[11px]">
                    {response.created_at
                      ? parseServerDate(response.created_at).toLocaleString()
                      : ""}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => copyResponseLink(response)}
                  className={`rounded-xl p-2 transition-colors ${copiedResponseId === String(response.id) ? "text-[var(--tone-ok)]" : "text-white/30 hover:text-white"}`}
                  aria-label="Copy response link"
                  title={
                    copiedResponseId === String(response.id)
                      ? "Copied!"
                      : "Copy response link"
                  }
                >
                  {copiedResponseId === String(response.id) ? (
                    <IconCheck size={14} />
                  ) : (
                    <IconLink size={14} />
                  )}
                </button>
                <span>{statusChip(response.status)}</span>
              </div>
            ))}
          </div>
        );
      })}
      {!responses.length ? (
        <p className="cool-text py-10 text-center text-sm">
          No submissions yet. Share an application with your members to get
          started.
        </p>
      ) : null}
      {open
        ? createPortal(
            <div className="gator-overlay fixed inset-0 z-[145] flex items-center justify-center p-4">
              <button
                type="button"
                className="dialog-backdrop absolute inset-0 bg-black/75 backdrop-blur-sm"
                onClick={() => setOpen(null)}
                aria-label="Close"
              />
              <div className="dialog-pop relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#131415] shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-peach)]/15 text-sm font-bold text-[var(--accent-peach)]">
                      {String(open.user_name || open.user_id || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-extrabold text-white">
                        {open.user_name || open.user_id}
                      </h3>
                      <p className="cool-text mt-1 truncate text-xs">
                        {open.resource_title || "Submission"}
                        {open.created_at
                          ? ` · ${parseServerDate(open.created_at).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Dashboard only: the scan endpoint requires Manage Server,
                       which portal visitors do not have. */}
                    {!portalBase ? (
                      <button
                        type="button"
                        disabled={scanning}
                        onClick={() => void scanForAi()}
                        title={
                          openDetection
                            ? "Scan again for AI-written answers"
                            : "Check these answers for AI-written text"
                        }
                        className={`inline-flex h-7 items-center gap-2 rounded-xl border px-2 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                          openDetection
                            ? "border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.1)] text-[var(--accent-peach)]"
                            : "border-white/[0.08] text-white/45 hover:border-[rgb(var(--accent-rgb)/0.3)] hover:text-[var(--accent-peach)]"
                        }`}
                      >
                        {scanning ? (
                          <IconLoader2 size={14} className="animate-spin" />
                        ) : (
                          <IconRobot size={14} />
                        )}
                        <span className="hidden sm:inline">
                          {scanning
                            ? "Scanning…"
                            : openDetection
                              ? "Re-scan"
                              : "Check for AI"}
                        </span>
                      </button>
                    ) : null}
                    {statusChip(open.status)}
                  </div>
                </div>
                {(() => {
                  const entries = Object.entries(open.answers || {});
                  const resource = resources.find(
                    (item) => item.id === open.resource_id,
                  );
                  const questionFor = (key: string) =>
                    (resource?.questions || []).find(
                      (item: any) => String(item.id) === String(key),
                    );
                  if (!entries.length) {
                    return (
                      <p className="cool-text px-5 py-10 text-center text-sm">
                        This submission has no answers.
                      </p>
                    );
                  }
                  const active = Math.min(answerTab, entries.length - 1);
                  const [activeKey, activeValue] = entries[active];
                  const activeQuestion = questionFor(activeKey);
                  return (
                    <div className="p-5">
                      {/* One numbered tab per question — click to view that answer
                          on its own, big and easy to read. */}
                      <div className="mb-4 flex flex-wrap gap-2">
                        {entries.map(([key, value], index) => {
                          const q = questionFor(key);
                          // A dot on a question's tab when that answer carries
                          // a signal.
                          const flagged =
                            (() => {
                              const verdict = verdictFor(
                                integrityFor(key),
                                typeof value === "string" ? value.length : 0,
                              );
                              return Boolean(verdict && verdict !== "typed");
                            })() ||
                            (openDetection?.questions?.[key]?.verdict ?? "clear") !==
                              "clear";
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setAnswerTab(index)}
                              title={q?.question || `Answer ${index + 1}`}
                              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                                index === active
                                  ? "bg-[var(--accent-peach)]/15 text-[var(--accent-peach)]"
                                  : "bg-white/[0.02] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                              }`}
                            >
                              <span
                                className={`grid h-4 w-4 place-items-center rounded text-[10px] ${
                                  index === active
                                    ? "bg-[var(--accent-peach)]/25"
                                    : "bg-white/[0.06]"
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span className="max-w-[140px] truncate">
                                {q?.question || `Answer ${index + 1}`}
                              </span>
                              {flagged ? (
                                <StatusDot tone="warn" className="shrink-0" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] bg-white/[0.015] px-5 py-4">
                          <p className="flex items-start gap-2 text-[15px] font-bold text-white/90">
                            <span className="mt-px text-[var(--accent-peach)]">{active + 1}.</span>
                            {activeQuestion?.question || "Answer"}
                          </p>
                          {/* The tags sit on the question they are about. */}
                          <AuthorshipTags
                            integrity={integrityFor(activeKey)}
                            answer={activeValue}
                            ai={openDetection?.questions?.[activeKey]}
                          />
                        </div>
                        <div className="max-h-[42vh] overflow-y-auto px-5 py-4">
                          <p className="whitespace-pre-wrap text-[15px] leading-7 text-white/85">
                            {String(activeValue) || (
                              <span className="text-white/30">No answer</span>
                            )}
                          </p>
                          <AuthorshipNotes
                            integrity={integrityFor(activeKey)}
                            answer={activeValue}
                            ai={openDetection?.questions?.[activeKey]}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="px-5 pb-5">
                {/* status/actions below */}
                {open.integrity &&
                (open.integrity.flags || []).length + (open.integrity.total_chars || 0) > 0 ? (
                  <div
                    className={`mt-4 rounded-xl border p-3 ${(open.integrity.flags || []).length ? "border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)]" : "border-white/[0.08] bg-white/[0.015]"}`}
                  >
                    <p className="text-xs font-bold text-white/75">
                      Integrity check
                    </p>
                    {(open.integrity.flags || []).map((flag: string, index: number) => (
                      <p key={index} className="mt-1 text-xs text-[var(--tone-bad)]">
                        ⚠ {flag}
                      </p>
                    ))}
                    <p className="cool-text mt-1 text-[11px]">
                      {Math.round((open.integrity.paste_ratio || 0) * 100)}% pasted ·{" "}
                      {open.integrity.paste_events || 0} paste event
                      {(open.integrity.paste_events || 0) === 1 ? "" : "s"} · completed in{" "}
                      {formatDuration(open.integrity.seconds || 0)}
                    </p>
                  </div>
                ) : null}
                {open.status ? (
                  <p className="cool-text mt-4 text-xs">
                    Reviewed by {open.reviewed_by_name || "a manager"}
                    {open.reviewed_at
                      ? ` on ${parseServerDate(open.reviewed_at).toLocaleString()}`
                      : ""}
                    {open.review_note ? `: “${open.review_note}”` : ""}
                  </p>
                ) : (
                  <>
                    <div className="mt-4">
                      <TextField
                        value={note}
                        onChange={setNote}
                        placeholder="Optional note sent to the applicant"
                      />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void review(open, "denied")}
                        className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-4 py-2 text-sm font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)] disabled:opacity-40"
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void review(open, "accepted")}
                        className="btn-pop btn-peach px-4 py-2 text-sm disabled:opacity-40"
                      >
                        {busy ? "Working…" : "Accept"}
                      </button>
                    </div>
                  </>
                )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </SettingsCard>
  );
}

/**
 * Full-screen department application editor, like the document editor:
 * Questions, Settings, Share and a live Submissions queue, with autosave.
 */
export function ApplicationEditorScreen({
  resource,
  profile,
  channels,
  responses,
  resources,
  isJoinApplication,
  onSetJoinApplication,
  initialResponseId,
  onChange,
  onSave,
  onClose,
  onDelete,
  onRefresh,
}: {
  resource: any;
  profile: DepartmentProfile;
  channels: ManagedChannel[];
  responses: any[];
  resources: any[];
  isJoinApplication?: boolean;
  onSetJoinApplication?: (id: string | null) => void;
  initialResponseId?: string | null;
  onChange: (next: any) => void;
  onSave: () => Promise<boolean>;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [tab, setTab] = useState<"questions" | "settings" | "submissions">(
    initialResponseId ? "submissions" : "questions",
  );
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const resourceRef = useRef(resource);
  resourceRef.current = resource;
  const lastSavedRef = useRef(JSON.stringify(resource));
  async function saveNow(): Promise<boolean> {
    const snapshot = JSON.stringify(resourceRef.current);
    if (snapshot === lastSavedRef.current) return true;
    setSaveState("saving");
    setSaveError(null);
    try {
      const ok = await onSave();
      if (!ok) throw new Error("Could not save this application. Try again.");
      lastSavedRef.current = snapshot;
      setSaveState(
        JSON.stringify(resourceRef.current) === snapshot ? "saved" : "dirty",
      );
      return JSON.stringify(resourceRef.current) === snapshot;
    } catch (error) {
      setSaveState("dirty");
      setSaveError(error instanceof Error ? error.message : "Could not save this application. Try again.");
      return false;
    }
  }
  async function closeEditor() {
    if (await saveNow()) onClose();
  }
  useEffect(() => {
    if (JSON.stringify(resource) === lastSavedRef.current) return;
    setSaveState((state) => (state === "saving" ? state : "dirty"));
    const timer = setTimeout(() => void saveNow(), 1200);
    return () => clearTimeout(timer);
  }, [resource]);
  const pendingCount = responses.filter((item: any) => !item.status).length;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const submissionUrl =
    isJoinApplication && profile.join_code
      ? `${origin}/departments/join/${profile.join_code}`
      : `${origin}/departments/${guildId}/${profile.id}?tab=resources&app=${resource.id}`;
  const tabs = [
    { id: "questions" as const, label: "Questions", icon: <IconListCheck size={15} /> },
    { id: "settings" as const, label: "Settings", icon: <IconSettings size={15} /> },
    {
      id: "submissions" as const,
      label: pendingCount ? `Submissions (${pendingCount})` : "Submissions",
      icon: <IconSend size={15} />,
    },
  ];
  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-[#131415] text-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.08] bg-[#131313] px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => void closeEditor()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-white/60 hover:text-white"
        >
          <IconArrowLeft size={14} />
          Back
        </button>
        <IconClipboard size={26} className="shrink-0 text-[var(--accent-peach)]" />
        <div className="min-w-0 flex-1">
          <input
            value={resource.title}
            onChange={(event) => onChange({ ...resource, title: event.target.value })}
            className="w-full max-w-md bg-transparent text-base font-extrabold text-white/90 outline-none focus:rounded-lg focus:bg-white/[0.04] focus:px-2"
            aria-label="Application title"
          />
          <p className="cool-text text-xs">
            {profile.name} · Department application
            {isJoinApplication ? " · used for joining" : ""}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-white/55"
          title="Changes save automatically"
        >
          {saveState === "saving" ? (
            <IconLoader2 size={14} className="animate-spin text-[var(--accent-peach)]" />
          ) : saveState === "saved" ? (
            <IconCloudCheckFilledIcon />
          ) : (
            <StatusDot tone="warn" />
          )}
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Unsaved"}
        </span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(submissionUrl);
            setLinkCopied(true);
            window.setTimeout(() => setLinkCopied(false), 1600);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-white/55 hover:border-white/[0.16] hover:text-white"
          title={
            isJoinApplication && profile.join_code
              ? "Applicants join through this link"
              : "Members open the application form through this link"
          }
        >
          {linkCopied ? <IconCheck size={14} /> : <IconLink size={14} />}
          {linkCopied
            ? "Copied"
            : isJoinApplication && profile.join_code
              ? "Copy join link"
              : "Copy application link"}
        </button>
        <button
          type="button"
          onClick={() => void closeEditor()}
          className="rounded-xl p-2 text-white/40 hover:bg-white/[0.06] hover:text-white"
          aria-label="Close"
        >
          <IconX size={19} />
        </button>
      </header>
      {saveError ? <p role="alert" className="px-4 py-2 text-sm text-[var(--tone-bad)]">{saveError} Your changes are still open here.</p> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.08] bg-[#131415] p-3 lg:w-60 lg:flex-col lg:border-b-0 lg:border-r">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${tab === item.id ? "border border-white/[0.08] bg-white/[0.04] text-white" : "text-white/50 hover:bg-white/[0.02] hover:text-white"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="hidden flex-1 lg:block" />
          <button
            type="button"
            onClick={() => void onDelete()}
            className="hidden shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-[var(--tone-bad)] transition-colors hover:bg-[var(--tone-bad-soft)] lg:flex"
          >
            <IconTrash size={15} />
            Delete application
          </button>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-[#151515] p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {tab === "questions" ? (
              <>
                <FieldRow label="Description" description="Shown above the form.">
                  <TextAreaField
                    value={resource.description || ""}
                    onChange={(description) => onChange({ ...resource, description })}
                    rows={3}
                  />
                </FieldRow>
                <p className="pt-2 text-sm font-bold text-white/75">Questions</p>
                <QuestionList
                  questions={resource.questions || []}
                  onChange={(questions) => onChange({ ...resource, questions })}
                />
              </>
            ) : null}
            {tab === "settings" ? (
              <>
                <SettingsCard
                  title="Banner"
                  description="Shown at the top of the application when members fill it out."
                >
                  {resource.banner ? (
                    <div className="relative overflow-hidden rounded-xl border border-white/[0.08]">
                      <DevelopingImage
                        key={resource.banner}
                        src={resource.banner}
                        alt="Application banner"
                        className="max-h-44 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onChange({ ...resource, banner: "" })}
                        className="absolute right-2 top-2 rounded-xl bg-black/60 p-2 text-white/70 backdrop-blur hover:text-white"
                        aria-label="Remove banner"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.14] py-8 text-xs font-bold text-white/50 transition-colors hover:border-[rgb(var(--accent-rgb)/.45)] hover:text-white">
                      <IconUpload size={15} />
                      Upload a banner image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (file.size > 1024 * 1024) {
                            setNotice({
                              kind: "error",
                              text: "Choose a banner smaller than 1 MB",
                            });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            onChange({
                              ...resource,
                              banner: String(reader.result || ""),
                            });
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                </SettingsCard>
                <SettingsCard
                  title="Submission log channel"
                  description="Every submission is also posted to this Discord channel."
                >
                  <ChannelPicker
                    channels={channels}
                    value={resource.channel_id || null}
                    onChange={(channel_id) => onChange({ ...resource, channel_id })}
                  />
                </SettingsCard>
                <SettingsCard
                  title="Review messages"
                  description="Included in the DM applicants receive when their submission is reviewed."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <FieldRow label="Acceptance message">
                      <TextAreaField
                        value={resource.accept_message || ""}
                        onChange={(accept_message) =>
                          onChange({ ...resource, accept_message })
                        }
                        rows={3}
                        placeholder="Welcome aboard! Report to training…"
                      />
                    </FieldRow>
                    <FieldRow label="Denial message">
                      <TextAreaField
                        value={resource.deny_message || ""}
                        onChange={(deny_message) =>
                          onChange({ ...resource, deny_message })
                        }
                        rows={3}
                        placeholder="You may re-apply in 14 days."
                      />
                    </FieldRow>
                  </div>
                </SettingsCard>
                {onSetJoinApplication ? (
                  <SettingsCard
                    title="Use as join application"
                    description="New members must complete this application to join the department. Accepting a submission accepts the member."
                  >
                    <label className="flex items-center gap-3">
                      <Toggle
                        checked={Boolean(isJoinApplication)}
                        onChange={(value) =>
                          onSetJoinApplication(value ? resource.id : null)
                        }
                      />
                      <span className="text-sm text-white/70">
                        {isJoinApplication
                          ? "This is the department's join application"
                          : "Not used for joining"}
                      </span>
                    </label>
                  </SettingsCard>
                ) : null}
                <SettingsCard
                  title="Danger zone"
                  description="Deleting an application also hides its past submissions."
                >
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    className="rounded-xl border border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] px-3 py-2 text-xs font-semibold text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)]"
                  >
                    Delete application
                  </button>
                </SettingsCard>
              </>
            ) : null}
            {tab === "submissions" ? (
              <SubmissionsPanel
                profile={profile}
                resources={resources}
                responses={responses}
                initialOpenId={initialResponseId}
                onRefresh={onRefresh}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function IconCloudCheckFilledIcon() {
  return <IconCheck size={14} className="text-[var(--tone-ok)]" />;
}
