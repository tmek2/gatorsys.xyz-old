"use client";

import React, { useEffect, useRef, useState } from "react";
import { questionUnanswered } from "../question-input";
import { FormQuestionCard } from "@/components/form-question-field";
import {
  createIntegrityTracker as createQuestionIntegrityTracker,
} from "@/components/application-integrity";
import {
  IconBook2,
  IconChevronDown,
  IconClipboard,
  IconLoader2,
  IconRefresh,
  IconTable,
} from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import type { ApplicationQuestion } from "../types";
import type { DepartmentProfile } from "../types";
import { DOCUMENT_FRAME_STYLE, timeAgo } from "./shared";

/* The department's documents, spreadsheets and forms, as the Resources tab lists them. */

/**
 * Copy-paste and typing-speed signals for a department application. Records the
 * whole-submission counters (the API derives flags from them, and older
 * submissions only have these) plus a per-question breakdown from the same
 * tracker as the public form, sent as `questions`. The question is read from
 * the event target's `data-question-id`, set by the form card, because these
 * are container-level capture handlers.
 */
export function createIntegrityTracker() {
  const state = {
    startedAt: 0,
    pastedChars: 0,
    pasteEvents: 0,
    typedKeys: 0,
    tabOuts: 0,
  };
  const perQuestion = createQuestionIntegrityTracker();

  const questionOf = (event: { target: unknown }): string => {
    const node = event.target as HTMLElement | null;
    return node?.closest?.("[data-question-id]")?.getAttribute("data-question-id") || "";
  };

  return {
    onPasteCapture: (event: React.ClipboardEvent) => {
      const text = event.clipboardData?.getData("text") || "";
      if (!state.startedAt) state.startedAt = Date.now();
      state.pastedChars += text.length;
      state.pasteEvents += 1;
      const id = questionOf(event);
      if (id) perQuestion.paste(id, text.length);
    },
    onKeyDownCapture: (event: React.KeyboardEvent) => {
      if (!state.startedAt) state.startedAt = Date.now();
      state.typedKeys += 1;
      // Only keys that produce text count as typing.
      const id = questionOf(event);
      if (id && event.key && event.key.length === 1) perQuestion.typed(id, 1);
    },
    onFocusCapture: (event: React.FocusEvent) => {
      const id = questionOf(event);
      if (id) perQuestion.focus(id);
    },
    onBlurCapture: (event: React.FocusEvent) => {
      const id = questionOf(event);
      if (id) perQuestion.blur(id);
    },
    onBlur: () => {
      if (state.startedAt) state.tabOuts += 1;
    },
    payload: (answers: Record<string, any>) => {
      const totalChars = Object.values(answers).reduce(
        (total: number, value) => total + String(value ?? "").length,
        0,
      );
      return {
        seconds: state.startedAt
          ? Math.round((Date.now() - state.startedAt) / 1000)
          : 0,
        pasted_chars: state.pastedChars,
        paste_events: state.pasteEvents,
        typed_chars: state.typedKeys,
        tab_outs: state.tabOuts,
        total_chars: totalChars,
        questions: perQuestion.snapshot(),
      };
    },
  };
}

/** Gator read-only library: sidebar of resources, reader pane with
 *  next-page navigation. Used for members without manage_resources. */
export function ResourceLibrary({
  profile,
  resources,
  applications: migratedApplications = [],
  initialOpenId,
  onRefresh,
}: {
  profile: DepartmentProfile;
  resources: any[];
  /** Migrated (unified) applications — same objects server manage edits. */
  applications?: any[];
  initialOpenId?: string | null;
  onRefresh: () => Promise<void>;
}) {
  const { guildId, setNotice, portalBase } = useWorkspaceHost();
  // Members without edit permission open documents/spreadsheets in the
  // full-page read-only reader (editor chrome, no editing).
  const readerBase = portalBase || `/departments/${guildId}/${profile.id}`;
  const documents = resources.filter((item) => item.kind === "document");
  const spreadsheets = resources.filter((item) => item.kind === "spreadsheet");
  // Unified applications replace their legacy resource copies (same ids) so
  // members always see the version the editor actually maintains.
  const migratedIds = new Set(
    migratedApplications.map((app: any) => String(app.id)),
  );
  const applications = [
    ...migratedApplications.map((app: any) => ({
      ...app,
      kind: "application",
      title: app.name || app.title || "Untitled Application",
      __migrated: true,
    })),
    ...resources.filter(
      (item) =>
        item.kind === "application" && !migratedIds.has(String(item.id)),
    ),
  ];
  const ordered = [...documents, ...spreadsheets, ...applications];
  const [openId, setOpenId] = useState<string | null>(
    initialOpenId || ordered[0]?.id || null,
  );
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const integrity = useRef(createIntegrityTracker());
  const current = ordered.find((item) => item.id === openId) || ordered[0];
  const currentIndex = current
    ? ordered.findIndex((item) => item.id === current.id)
    : -1;
  const next = currentIndex >= 0 ? ordered[currentIndex + 1] : undefined;
  const previous = currentIndex > 0 ? ordered[currentIndex - 1] : undefined;
  const subdocuments = Array.isArray(current?.subdocuments)
    ? current.subdocuments
    : [];
  const [subId, setSubId] = useState<string>("root");
  const activeHtml =
    subId === "root"
      ? current?.document_html || ""
      : subdocuments.find((item: any) => item.id === subId)?.html || "";
  const draftKey = current ? `gator-app-draft-${guildId}-${current.id}` : "";
  const missingRequired = Boolean(
    current?.kind === "application" &&
      (current.questions || []).some((question: ApplicationQuestion) =>
        questionUnanswered(question, answers[question.id]),
      ),
  );
  function openResource(id: string) {
    // Documents and spreadsheets open in the dedicated full-page reader
    // (editor chrome, login-gated); applications stay inline to submit.
    const target = ordered.find((item) => String(item.id) === String(id));
    if (target && (target.kind === "document" || target.kind === "spreadsheet")) {
      window.location.href = `${readerBase}/doc/${id}`;
      return;
    }
    setOpenId(id);
    setSubId("root");
    setAnswers({});
    integrity.current = createIntegrityTracker();
  }
  useEffect(() => {
    if (
      initialOpenId &&
      ordered.some((item) => String(item.id) === String(initialOpenId))
    ) {
      openResource(initialOpenId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenId, resources]);
  // Restore any saved draft for this application so tabbing out / reloading
  // never loses typed answers.
  useEffect(() => {
    if (!draftKey || current?.kind !== "application") return;
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) setAnswers(JSON.parse(stored) || {});
    } catch {
      /* ignore corrupt drafts */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  // Persist the draft on every change and count tab-outs as an integrity
  // signal (people paste AI answers from another tab).
  useEffect(() => {
    if (!draftKey || current?.kind !== "application") return;
    try {
      if (Object.keys(answers).length) {
        localStorage.setItem(draftKey, JSON.stringify(answers));
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {
      /* storage may be unavailable */
    }
  }, [answers, draftKey, current?.kind]);
  useEffect(() => {
    const onBlur = () => integrity.current.onBlur?.();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);
  async function submitApplication() {
    if (!current || missingRequired) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/deptresources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          id: current.id,
          answers,
          integrity: integrity.current.payload(answers),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.detail || "Could not submit application");
      setAnswers({});
      try {
        if (draftKey) localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      integrity.current = createIntegrityTracker();
      setNotice({ kind: "saved", text: `${current.title} submitted` });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Could not submit application",
      });
    } finally {
      setSubmitting(false);
    }
  }
  if (!ordered.length)
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center">
        <IconBook2 size={24} className="mx-auto text-white/20" />
        <p className="mt-3 text-sm font-bold text-white/70">No resources yet</p>
        <p className="cool-text mt-1 text-xs">
          Applications and documents shared with you will appear here.
        </p>
      </div>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-white/[0.08] bg-white/[0.015] p-3">
        <p className="flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent-peach)]">
          <IconBook2 size={15} />
          Resources
        </p>
        {ordered.map((item) => (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => openResource(item.id)}
              className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors ${current?.id === item.id ? "border border-white/[0.08] bg-white/[0.04] text-white" : "text-white/50 hover:bg-white/[0.02] hover:text-white"}`}
            >
              {item.kind === "application" ? (
                <IconClipboard size={15} className="shrink-0 text-[var(--accent-peach)]" />
              ) : item.kind === "spreadsheet" ? (
                <IconTable size={15} className="shrink-0 text-[var(--accent-peach)]" />
              ) : (
                <IconBook2 size={15} className="shrink-0 text-[var(--accent-peach)]" />
              )}
              <span className="truncate">{item.title}</span>
            </button>
            {current?.id === item.id &&
            item.kind === "document" &&
            (item.subdocuments || []).length ? (
              <div className="ml-6 border-l border-white/[0.08] pl-2">
                {[{ id: "root", title: item.title }, ...(item.subdocuments || [])].map(
                  (page: any) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setSubId(page.id)}
                      className={`mt-1 block w-full truncate rounded-xl px-3 py-2 text-left text-xs ${subId === page.id ? "bg-white/[0.04] text-white" : "text-white/40 hover:text-white/70"}`}
                    >
                      {page.title}
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ))}
      </aside>
      {current ? (
        <section className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
            <div className="h-28 border-b border-[var(--accent-peach)]/70 bg-[radial-gradient(circle_at_18%_0%,rgb(var(--accent-rgb) / .16),transparent_60%),linear-gradient(150deg,#1f1f1f,#141414)]" />
            <div className="p-6">
              <h2 className="text-2xl font-extrabold text-white">
                {current.title}
              </h2>
              {current.description ? (
                <p className="cool-text mt-2 text-sm leading-6">
                  {current.description}
                </p>
              ) : null}
              {current.kind === "document" ? (
                <iframe
                  sandbox=""
                  title={current.title}
                  srcDoc={`${DOCUMENT_FRAME_STYLE}${activeHtml}`}
                  className="mt-5 h-[62vh] w-full rounded-xl border border-white/[0.08]"
                />
              ) : current.kind === "spreadsheet" ? (
                <div className="mt-5 max-h-[62vh] overflow-auto rounded-xl border border-white/[0.08]">
                  <table className="min-w-max border-collapse text-xs">
                    <tbody>
                      {(current.spreadsheet_data || []).map((row: any[], rowIndex: number) => (
                        <tr key={rowIndex}>
                          {(row || []).map((cell, columnIndex) => (
                            <td key={columnIndex} className="min-w-28 border border-white/[0.08] px-3 py-2 text-white/65">
                              {String(cell || "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (current as any).__migrated ? (
                // Unified applications submit through the same form as the
                // shareable link, so answers land in the editor's Responses
                // tab.
                <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                  <p className="text-sm font-bold text-white/85">
                    {(current.questions || []).length} question
                    {(current.questions || []).length === 1 ? "" : "s"}
                  </p>
                  <p className="cool-text mt-1 text-xs">
                    Open the application to fill it out and submit.
                  </p>
                  <a
                    href={`/application/${guildId}/${current.id}`}
                    className="btn-pop btn-peach mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
                  >
                    <IconClipboard size={15} />
                    Open application
                  </a>
                </div>
              ) : (
                <div
                  /* `data-bare` keeps the dashboard's blanket control styles
                     off the form: it is the public form rendered inside the
                     dashboard. */
                  data-bare=""
                  className="mt-5 space-y-4"
                  onPasteCapture={integrity.current.onPasteCapture}
                  onKeyDownCapture={integrity.current.onKeyDownCapture}
                  /* Focus and blur time each question, needed to detect answers
                     that appeared faster than anyone types. */
                  onFocusCapture={integrity.current.onFocusCapture}
                  onBlurCapture={integrity.current.onBlurCapture}
                >
                  {current.banner ? (
                    <img
                      src={current.banner}
                      alt=""
                      className="max-h-44 w-full rounded-xl border border-white/[0.08] object-cover"
                    />
                  ) : null}
                  {(current.questions || []).map(
                    (question: ApplicationQuestion) => (
                      <FormQuestionCard
                        key={question.id}
                        question={question as never}
                        value={answers[question.id]}
                        onChange={(value) =>
                          setAnswers({ ...answers, [question.id]: value })
                        }
                      />
                    ),
                  )}
                  {missingRequired ? (
                    <p className="text-xs font-semibold text-[var(--tone-warn)]">
                      Answer every required question before submitting.
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={submitting || missingRequired}
                      onClick={() => void submitApplication()}
                      className="btn-pop btn-peach inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <IconLoader2 size={15} className="animate-spin" />
                          Submitting…
                        </>
                      ) : (
                        "Submit application"
                      )}
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-6 flex items-stretch gap-3">
                {previous ? (
                  <button
                    type="button"
                    onClick={() => openResource(previous.id)}
                    className="flex flex-1 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-left transition-colors hover:border-[var(--accent-peach)]/35"
                  >
                    <IconChevronDown size={16} className="rotate-90 shrink-0 text-white/35" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white/85">
                        Previous
                      </span>
                      <span className="cool-text mt-1 block truncate text-xs">
                        {previous.title}
                      </span>
                    </span>
                  </button>
                ) : null}
                {next ? (
                  <button
                    type="button"
                    onClick={() => openResource(next.id)}
                    className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-left transition-colors hover:border-[var(--accent-peach)]/35"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white/85">
                        Next
                      </span>
                      <span className="cool-text mt-1 block truncate text-xs">
                        {next.title}
                      </span>
                    </span>
                    <IconChevronDown size={16} className="-rotate-90 shrink-0 text-white/35" />
                  </button>
                ) : null}
              </div>
              <p className="cool-text mt-5 inline-flex items-center gap-2 text-xs">
                <IconRefresh size={13} />
                Updated {timeAgo(current.updated_at || current.created_at)}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
