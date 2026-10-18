"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCheck,
  IconLoader2,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApplicationForm,
  ApplicationSignInGate,
} from "@/components/application-form";

export function DepartmentJoinForm({
  embedded = false,
  initialCode = "",
  autoSubmit = false,
  onClose,
  viewer,
}: {
  embedded?: boolean;
  initialCode?: string;
  autoSubmit?: boolean;
  onClose?: () => void;
  viewer?: { id: string; name: string; image?: string | null } | null;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(
    (initialCode || searchParams.get("code") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 16),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  // Application-gated joins: the bot returns the department's join
  // application; the member answers it here and a manager reviews it.
  const [gate, setGate] = useState<{
    serverId: string;
    departmentId: string;
    department: string;
    application: {
      id: string;
      title: string;
      description?: string;
      questions: any[];
      source?: "standard" | "legacy";
    };
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const integrity = useRef({ startedAt: 0, pasted: 0, events: 0, typed: 0 });
  const autoSubmitted = useRef(false);
  useEffect(() => {
    // Deep links land here with ?code=…&auto=1 — apply the code once.
    if (
      autoSubmitted.current ||
      !code ||
      (!autoSubmit && searchParams.get("auto") !== "1")
    )
      return;
    autoSubmitted.current = true;
    void submit({ preventDefault: () => undefined } as React.FormEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/departments/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          action: "join",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          body.detail || body.message || "Could not join that department",
        );
      if (body.state === "application_required") {
        setGate({
          serverId: String(body.server_id),
          departmentId: String(body.department_id),
          department: String(body.department || "this department"),
          application: body.application,
        });
        return;
      }
      if (body.state === "requested") {
        setResult({
          kind: "ok",
          text: `Request sent! A ${body.department} manager needs to accept you before you appear on the roster.`,
        });
      } else {
        setResult({
          kind: "ok",
          text: `You joined ${body.department} with the ${body.role} role.`,
        });
        if (embedded) {
          onClose?.();
          router.refresh();
        } else {
          router.push("/servers?joined=1");
          router.refresh();
        }
      }
    } catch (error) {
      setResult({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not join that department",
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault();
    if (!gate) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(`/api/manage/${gate.serverId}/deptresources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          id: gate.application.id,
          answers,
          integrity: {
            seconds: integrity.current.startedAt
              ? Math.round((Date.now() - integrity.current.startedAt) / 1000)
              : 0,
            pasted_chars: integrity.current.pasted,
            paste_events: integrity.current.events,
            typed_chars: integrity.current.typed,
            total_chars: Object.values(answers).reduce(
              (total, value) => total + String(value ?? "").length,
              0,
            ),
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.detail || body.message || "Could not submit the application");
      setGate(null);
      setAnswers({});
      setResult({
        kind: "ok",
        text: `Application submitted! A ${gate.department} manager will review it, and you join automatically once it is accepted.`,
      });
    } catch (error) {
      setResult({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not submit the application",
      });
    } finally {
      setBusy(false);
    }
  }

  if (gate?.application.source === "standard")
    return (
      <div className={embedded ? "w-full" : "mx-auto flex min-h-screen max-w-2xl items-center px-4 pb-16 pt-28"}>
        <section className="glass-panel max-h-[90vh] w-full overflow-y-auto rounded-2xl p-5 sm:p-7">
          <button
            type="button"
            onClick={() => setGate(null)}
            className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-white/40 transition-colors hover:text-white"
          >
            <IconArrowLeft size={14} /> Different code
          </button>
          {viewer ? (
            <ApplicationForm
              guildId={gate.serverId}
              appId={gate.application.id}
              viewer={viewer}
              embedded
              onSubmitted={() => {
                setGate(null);
                onClose?.();
                router.refresh();
              }}
            />
          ) : (
            <ApplicationSignInGate
              guildId={gate.serverId}
              appId={gate.application.id}
            />
          )}
        </section>
      </div>
    );

  if (gate)
    return (
      <div className={embedded ? "w-full" : "mx-auto flex min-h-screen max-w-xl items-center px-4 pb-16 pt-28"}>
        <section className="glass-panel max-h-[85vh] w-full overflow-y-auto rounded-2xl p-6 sm:p-8">
          <button
            type="button"
            onClick={() => setGate(null)}
            className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-white/40 transition-colors hover:text-white"
          >
            <IconArrowLeft size={14} /> Different code
          </button>
          <h1 className="text-xl font-extrabold text-[#f5f2f2]">
            {gate.application.title || "Join application"}
          </h1>
          <p className="cool-text mt-1 text-sm leading-6">
            {gate.application.description ||
              `${gate.department} requires this application before you can join.`}
          </p>
          <form
            onSubmit={submitApplication}
            className="mt-6 space-y-4"
            onPasteCapture={(event) => {
              const text = event.clipboardData?.getData("text") || "";
              if (!integrity.current.startedAt) integrity.current.startedAt = Date.now();
              integrity.current.pasted += text.length;
              integrity.current.events += 1;
            }}
            onKeyDownCapture={() => {
              if (!integrity.current.startedAt) integrity.current.startedAt = Date.now();
              integrity.current.typed += 1;
            }}
          >
            {(gate.application as any).banner ? (
              <img
                src={(gate.application as any).banner}
                alt=""
                className="max-h-40 w-full rounded-xl border border-white/[0.08] object-cover"
              />
            ) : null}
            {(gate.application.questions || []).map((question: any) => (
              <label key={question.id} className="block">
                <span className="mb-2 block text-xs font-bold text-white/60">
                  {question.question}
                  {question.required ? " *" : ""}
                </span>
                {String(question.type || "").includes("long") ? (
                  <textarea
                    value={answers[question.id] || ""}
                    onChange={(event) =>
                      setAnswers({ ...answers, [question.id]: event.target.value })
                    }
                    rows={4}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[rgb(var(--accent-rgb)/0.45)]"
                  />
                ) : (
                  <input
                    value={answers[question.id] || ""}
                    onChange={(event) =>
                      setAnswers({ ...answers, [question.id]: event.target.value })
                    }
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[rgb(var(--accent-rgb)/0.45)]"
                  />
                )}
              </label>
            ))}
            <button
              disabled={
                busy ||
                (gate.application.questions || []).some(
                  (question: any) =>
                    question.required && !String(answers[question.id] || "").trim(),
                )
              }
              className="btn-pop btn-peach flex h-11 w-full items-center justify-center text-sm disabled:opacity-40"
            >
              {busy ? (
                <IconLoader2 className="mr-2 animate-spin" size={16} />
              ) : (
                <IconCheck className="mr-2" size={16} />
              )}
              Submit application
            </button>
          </form>
          {result ? (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${result.kind === "ok" ? "border-[rgb(var(--accent-rgb)/0.25)] bg-[rgb(var(--accent-rgb)/0.06)] text-[#ffd0cb]" : "border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]"}`}
            >
              {result.text}
            </div>
          ) : null}
        </section>
      </div>
    );

  return (
    <div className={embedded ? "w-full" : "mx-auto flex min-h-screen max-w-lg items-center px-4 pb-16 pt-28"}>
      <section className="glass-panel w-full rounded-2xl p-6 sm:p-8">
        {embedded ? (
          <button
            type="button"
            onClick={onClose}
            className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-white/40 transition-colors hover:text-white"
          >
            <IconX size={14} /> Close
          </button>
        ) : (
          <Link
            href="/servers"
            className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-white/40 transition-colors hover:text-white"
          >
            <IconArrowLeft size={14} /> Back to dashboard
          </Link>
        )}
        <div className="flex items-center gap-3">
          <Image src="/icon.svg" alt="Bot" width={42} height={42} />
          <div>
            <h1 className="text-xl font-extrabold text-[#f5f2f2]">
              Join a department
            </h1>
            <p className="cool-text mt-1 text-sm">
              Use the code shared by your department manager.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-white/60">
              Department code
            </span>
            <input
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 16),
                )
              }
              placeholder="LSPD7K4Q"
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 font-mono text-sm font-bold tracking-[0.12em] text-white outline-none placeholder:text-white/25 focus:border-[rgb(var(--accent-rgb)/0.45)]"
            />
          </label>
          <button
            disabled={busy || code.length < 6}
            className="btn-pop btn-peach flex h-11 w-full items-center justify-center text-sm disabled:opacity-40"
          >
            {busy ? (
              <IconLoader2 className="mr-2 animate-spin" size={16} />
            ) : (
              <IconUsersGroup className="mr-2" size={16} />
            )}
            Join department
          </button>
        </form>
        {result ? (
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${result.kind === "ok" ? "border-[rgb(var(--accent-rgb)/0.25)] bg-[rgb(var(--accent-rgb)/0.06)] text-[#ffd0cb]" : "border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]"}`}
          >
            {result.kind === "ok" ? (
              <IconCheck className="mt-1 shrink-0" size={14} />
            ) : null}
            {result.text}
          </div>
        ) : null}
      </section>
    </div>
  );
}
