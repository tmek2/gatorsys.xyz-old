"use client";

import React, { useEffect, useState } from "react";
import { TextAreaField } from "../../fields";
import { useManage } from "../../manage-context";
import { EmptyState } from "../../empty-state";
import { AddButton, TicketGroup } from "./shared";

/* The AI view: questions the ticket assistant could not answer, and the context it is given. */

/** Suppio-style AI knowledge gaps: questions the ticket AI couldn't answer from
 *  saved context. Answering one appends it to the AI's context store. */
export function AiGapsCard({ onCount }: { onCount?: (count: number) => void }) {
  const { guildId, setNotice } = useManage();
  const [gaps, setGaps] = useState<any[] | null>(null);
  // The view switcher shows how many are waiting, so they are found from any
  // view rather than only by opening this one.
  useEffect(() => {
    onCount?.(gaps?.length ?? 0);
  }, [gaps, onCount]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/manage/${guildId}/aigaps`, { cache: "no-store" });
      const json = response.ok ? await response.json() : { gaps: [] };
      setGaps(Array.isArray(json.gaps) ? json.gaps : []);
    } catch {
      setGaps([]);
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "answer" | "dismiss", answerText?: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/aigaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, answer: answerText }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.message || "Request failed");
      }
      setNotice({
        kind: "saved",
        text: action === "answer" ? "Answer added to the AI's context" : "Gap dismissed",
      });
      setOpenId(null);
      setAnswer("");
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  if (!gaps || gaps.length === 0) return null;

  return (
    <TicketGroup
      title="Questions it couldn't answer"
      say="Answer one and the AI knows it from the next ticket on."
      count={gaps.length}
    >
      {gaps.map((gap) => (
        <div key={gap.id} className="gw-tk-row">
          <div className="gw-tk-row-main">
            <div className="gw-tk-row-copy">
              <p className="gw-tk-row-text">{gap.question || gap.neededContext}</p>
              {gap.neededContext && gap.question ? (
                <p className="gw-tk-row-meta">{gap.neededContext}</p>
              ) : null}
              <p className="gw-tk-row-meta">
                Asked {gap.occurrences} time{gap.occurrences === 1 ? "" : "s"}
              </p>
            </div>
            <div className="gw-tk-row-acts">
              <button
                type="button"
                className="gw-tk-ghost"
                data-tone="accent"
                onClick={() => {
                  setOpenId(openId === gap.id ? null : gap.id);
                  setAnswer("");
                }}
              >
                {openId === gap.id ? "Cancel" : "Answer"}
              </button>
              <button
                type="button"
                className="gw-tk-ghost"
                disabled={busy}
                onClick={() => act(gap.id, "dismiss")}
              >
                Dismiss
              </button>
            </div>
          </div>
          <div className="gw-set-roll" data-open={openId === gap.id ? "true" : "false"}>
            <div className="gw-set-roll-clip" inert={openId !== gap.id}>
              <div className="gw-tk-form">
                <TextAreaField
                  value={openId === gap.id ? answer : ""}
                  onChange={setAnswer}
                  rows={3}
                  placeholder="The answer, as you'd tell a new staff member"
                />
                <div className="gw-tk-form-acts">
                  <button
                    type="button"
                    disabled={busy || !answer.trim()}
                    onClick={() => act(gap.id, "answer", answer.trim())}
                    className="gw-tk-create-go"
                  >
                    {busy ? "Saving…" : "Save answer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </TicketGroup>
  );
}

/**
 * Openers that make a line an instruction rather than a statement. A copy of
 * the bot's list (utils/ai_knowledge.py), used only to preview how an unsaved
 * item will be treated; the bot's copy decides.
 */
const DIRECTIVE_OPENERS = [
  "after", "always", "any time", "anytime", "as soon as", "avoid", "before",
  "close", "dm", "do not", "don't", "dont", "ensure", "escalate", "for any",
  "hand", "if", "instruct", "keep", "make sure", "mention", "never",
  "notify", "on any", "once", "only", "ping", "post", "refuse", "remember",
  "reply", "respond", "send", "should", "stop", "tag", "tell", "under no",
  "unless", "upon", "wait", "when", "whenever", "you must", "you should",
];

function detectDirective(text: string): boolean {
  return String(text || "")
    .split("\n")
    .some((line) => {
      // Markdown ornament first, so "-# don't reply further" and "**Never** …"
      // are read as the instructions they are.
      const stripped = line.replace(/^[\s>*_~`#\-–—•\d.)\]]+/, "").trim().toLowerCase();
      return stripped.length > 0 && DIRECTIVE_OPENERS.some((o) => stripped.startsWith(o));
    });
}

/**
 * Whether an item is sent on every ticket or only when it matches. Three
 * states: unset items are judged from their text, and the switch shows that
 * judgement and why; choosing either way pins it.
 */
function AlwaysToggle({
  value,
  detected,
  onChange,
}: {
  value: boolean | null;
  detected: boolean;
  onChange: (next: boolean | null) => void;
}) {
  const effective = value === null ? detected : value;
  return (
    <button
      type="button"
      onClick={() => onChange(effective ? false : true)}
      title={
        value === null
          ? detected
            ? "Read as an instruction, so it's sent on every ticket. Click to make it a fact instead."
            : "Read as a fact, so it's sent when it matches the question. Click to send it on every ticket."
          : effective
            ? "Pinned on: sent on every ticket. Click to make it a fact."
            : "Pinned off: sent when it matches the question. Click to send it every time."
      }
      // The dashboard's chip: accent when on, hairline when off. Its `title`
      // shows as the window's own tooltip.
      className="gw-always"
      data-on={effective ? "true" : undefined}
    >
      {effective ? "Always applies" : "When it matches"}
      {value === null ? <span className="gw-always-auto">auto</span> : null}
    </button>
  );
}

export function AiContextCard() {
  const { guildId, setNotice } = useManage();
  const [items, setItems] = useState<any[] | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftAlways, setDraftAlways] = useState<boolean | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editAlways, setEditAlways] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/manage/${guildId}/aicontext`, { cache: "no-store" });
      const json = response.ok ? await response.json() : { items: [] };
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setItems([]);
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>, successText: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/aicontext`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.message || "Request failed");
      }
      setNotice({ kind: "saved", text: successText });
      setOpen(false);
      setDraft("");
      setDraftAlways(null);
      setEditIndex(null);
      setEditText("");
      setEditAlways(null);
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  if (items === null) return null;

  return (
    <TicketGroup
      title="AI knowledge"
      say={
        <>
          What the ticket AI knows. Write facts, or instructions like &ldquo;tell
          them to wait for a human&rdquo;.
        </>
      }
      count={items.length}
      action={
        <AddButton
          open={open}
          onClick={() => {
            setOpen((prev) => !prev);
            setDraft("");
          }}
        >
          Add
        </AddButton>
      }
    >
      <div className="gw-set-roll" data-open={open ? "true" : "false"}>
        <div className="gw-set-roll-clip" inert={!open}>
          <div className="gw-tk-form">
            <TextAreaField
              value={draft}
              onChange={setDraft}
              rows={3}
              placeholder="Refunds are handled in #billing within 48 hours. Never promise a date."
            />
            <div className="gw-tk-form-acts" data-split="true">
              <AlwaysToggle
                value={draftAlways}
                detected={detectDirective(draft)}
                onChange={setDraftAlways}
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() =>
                  act(
                    { action: "add", text: draft.trim(), always: draftAlways },
                    "Added to the AI's knowledge",
                  )
                }
                className="gw-tk-create-go"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        items.map((item) => (
          <div key={item.index} className="gw-tk-row">
            {editIndex === item.index ? (
              <div className="gw-tk-form" data-inline="true">
                <TextAreaField value={editText} onChange={setEditText} rows={3} />
                <div className="gw-tk-form-acts" data-split="true">
                  <AlwaysToggle
                    value={editAlways}
                    detected={detectDirective(editText)}
                    onChange={setEditAlways}
                  />
                  <div className="gw-tk-row-acts">
                    <button
                      type="button"
                      className="gw-tk-ghost"
                      onClick={() => {
                        setEditIndex(null);
                        setEditText("");
                        setEditAlways(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy || !editText.trim()}
                      onClick={() =>
                        act(
                          {
                            action: "edit",
                            index: item.index,
                            text: editText.trim(),
                            always: editAlways,
                          },
                          "Knowledge updated",
                        )
                      }
                      className="gw-tk-create-go"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gw-tk-row-main">
                <div className="gw-tk-row-copy">
                  <p className="gw-tk-row-text">{item.text}</p>
                  {/* Shown on the row: which items are sent on every ticket
                     decides whether an instruction reaches the AI. */}
                  <p className="gw-tk-row-meta">
                    {(item.always === null || item.always === undefined
                      ? item.detected
                      : item.always)
                      ? "Sent on every ticket"
                      : "Sent when it matches the question"}
                  </p>
                </div>
                <div className="gw-tk-row-acts">
                  <button
                    type="button"
                    className="gw-tk-ghost"
                    onClick={() => {
                      setEditIndex(item.index);
                      setEditText(item.text || "");
                      setEditAlways(item.always === undefined ? null : item.always);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="gw-tk-ghost"
                    data-tone="bad"
                    disabled={busy}
                    onClick={() => act({ action: "delete", index: item.index }, "Knowledge removed")}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      ) : !open ? (
        <EmptyState variant="row" title="Nothing saved yet" hint="Add the facts your AI keeps missing." />
      ) : null}
    </TicketGroup>
  );
}
