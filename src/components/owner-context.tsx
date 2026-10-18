"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconEye, IconEyeOff, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { ConfirmModal, type ConfirmState } from "@/components/confirm-modal";
import { Segments } from "@/components/Manage/segments";
import { HoverTip } from "@/components/site/hover-tip";
import { RippleButton, RippleButtonRipples } from "@/components/site/ripple-button";

type Kind = "outage" | "degraded" | "maintenance" | "notice";

interface Notice {
  id: string;
  kind: Kind;
  topic: string;
  body: string;
  expected_fix: string;
  active: boolean;
  expires_at: string | null;
  live: boolean;
}

/** The status of a notice, and the status tone it is written in. */
const KINDS: { id: Kind; label: string; tone: "bad" | "warn" | "info" | "idle" }[] = [
  { id: "outage", label: "Down", tone: "bad" },
  { id: "degraded", label: "Degraded", tone: "warn" },
  { id: "maintenance", label: "Maintenance", tone: "info" },
  { id: "notice", label: "Notice", tone: "idle" },
];

const BLANK = {
  kind: "outage" as Kind,
  topic: "",
  body: "",
  expected_fix: "",
  active: true,
};

/**
 * Global service notices: what every server's Assistant says while something is
 * broken ("applications are down for everyone, fix lands Thursday"), set once
 * here. Reversible: while a notice is live the assistant leads with it; delete
 * it and every server goes back to answering from the documentation.
 */
export function OwnerContext() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [draft, setDraft] = useState<typeof BLANK & { id?: string }>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/context", { cache: "no-store" });
      const json = res.ok ? await res.json() : { notices: [] };
      setNotices(json.notices || []);
    } catch {
      setNotices([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.message || "Failed");
      setNotices(json.notices || []);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft.body.trim()) {
      setError("A notice needs a body. That's what Assistant will say.");
      return;
    }
    if (await send({ action: "save", notice: draft })) setDraft(BLANK);
  }

  const editing = Boolean(draft.id);

  return (
    <div className="owner-ctx">
      <section className="owner-card owner-ctx-form">
        <h3 className="owner-ctx-title">{editing ? "Edit notice" : "New notice"}</h3>
        <p className="owner-ctx-say">
          Every server&apos;s Assistant leads with this instead of explaining how
          the feature normally works. Remove it and they all go back to the
          documentation immediately.
        </p>

        <div className="owner-ctx-field">
          <span className="owner-ctx-label">Status</span>
          <Segments<Kind>
            label="Status"
            value={draft.kind}
            options={KINDS.map((kind) => ({ value: kind.id, label: kind.label }))}
            onChange={(kind) => setDraft((current) => ({ ...current, kind }))}
          />
        </div>

        <div className="owner-ctx-pair">
          <label className="owner-ctx-field">
            <span className="owner-ctx-label">Topic</span>
            <input
              className="owner-ctx-input"
              value={draft.topic}
              onChange={(event) =>
                setDraft((current) => ({ ...current, topic: event.target.value }))
              }
              placeholder="applications"
            />
            <span className="owner-ctx-hint">
              Only mentioned when someone asks about this.
              Leave empty to apply to everything.
            </span>
          </label>
          <label className="owner-ctx-field">
            <span className="owner-ctx-label">Expected fix</span>
            <input
              className="owner-ctx-input"
              value={draft.expected_fix}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  expected_fix: event.target.value,
                }))
              }
              placeholder="Thursday"
            />
            <span className="owner-ctx-hint">Optional, quoted as written.</span>
          </label>
        </div>

        <label className="owner-ctx-field">
          <span className="owner-ctx-label">What&apos;s happening</span>
          <textarea
            className="owner-ctx-input"
            value={draft.body}
            onChange={(event) =>
              setDraft((current) => ({ ...current, body: event.target.value }))
            }
            rows={3}
            maxLength={1000}
            placeholder="Applications aren't submitting. We're on it."
          />
        </label>

        {error ? <p className="owner-ctx-error">{error}</p> : null}

        <div className="owner-ctx-acts">
          <RippleButton onClick={save} disabled={busy}>
            {editing ? <IconCheck size={15} aria-hidden="true" /> : <IconPlus size={15} aria-hidden="true" />}
            {editing ? "Save changes" : "Publish notice"}
            <RippleButtonRipples />
          </RippleButton>
          {editing ? (
            <RippleButton variant="ghost" onClick={() => setDraft(BLANK)}>
              Cancel
              <RippleButtonRipples />
            </RippleButton>
          ) : null}
        </div>
      </section>

      <div className="owner-ctx-list">
        {notices === null ? (
          [0, 1].map((index) => <div key={index} className="owner-skeleton" />)
        ) : notices.length === 0 ? (
          <p className="owner-empty">
            No notices. Assistant is answering from the documentation everywhere.
          </p>
        ) : (
          notices.map((notice) => {
            const kind = KINDS.find((row) => row.id === notice.kind) || KINDS[3];
            return (
              <article key={notice.id} className="owner-card owner-ctx-notice" data-live={notice.live ? "true" : "false"}>
                <div className="owner-ctx-meta">
                  <span className="owner-ctx-kind" data-tone={kind.tone}>
                    {kind.label}
                  </span>
                  <span className="owner-ctx-topic">
                    {notice.topic || "Applies to everything"}
                  </span>
                  <span className="owner-ctx-state" data-live={notice.live ? "true" : "false"}>
                    {notice.live ? "Live in every server" : "Off"}
                  </span>
                  <span className="owner-ctx-tools">
                    <HoverTip label={notice.active ? "Turn off" : "Turn on"}>
                      <RippleButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label={notice.active ? "Turn off" : "Turn on"}
                        disabled={busy}
                        onClick={() =>
                          send({ action: "save", notice: { ...notice, active: !notice.active } })
                        }
                      >
                        {notice.active ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                        <RippleButtonRipples />
                      </RippleButton>
                    </HoverTip>
                    <HoverTip label="Edit">
                      <RippleButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit"
                        disabled={busy}
                        onClick={() =>
                          setDraft({
                            id: notice.id,
                            kind: notice.kind,
                            topic: notice.topic,
                            body: notice.body,
                            expected_fix: notice.expected_fix,
                            active: notice.active,
                          })
                        }
                      >
                        <IconPencil size={15} />
                        <RippleButtonRipples />
                      </RippleButton>
                    </HoverTip>
                    <HoverTip label="Delete" align="end">
                      <RippleButton
                        variant="ghost"
                        size="icon-sm"
                        className="owner-ctx-delete"
                        aria-label="Delete"
                        disabled={busy}
                        onClick={() =>
                          setConfirm({
                            title: "Delete notice",
                            body: "Every server's Assistant goes back to answering from the documentation right away.",
                            confirmLabel: "Delete",
                            danger: true,
                            onConfirm: () => void send({ action: "delete", id: notice.id }),
                          })
                        }
                      >
                        <IconTrash size={15} />
                        <RippleButtonRipples />
                      </RippleButton>
                    </HoverTip>
                  </span>
                </div>
                <p className="owner-ctx-body">{notice.body}</p>
                {notice.expected_fix ? (
                  <p className="owner-ctx-hint">Expected fix: {notice.expected_fix}</p>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
