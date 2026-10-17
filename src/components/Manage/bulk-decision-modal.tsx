"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type BulkDecision = "approve" | "deny";

/**
 * Approve or deny several submissions with one note. Not built on ConfirmModal,
 * which stores its body as a node in state (a controlled field there would read
 * stale); this owns the reason field and returns the text on confirm.
 */
export function BulkDecisionModal({
  decision,
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  decision: BulkDecision | null;
  count: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Start clean each time it opens so a note from a previous batch is never
  // sent to a new set of applicants by accident.
  useEffect(() => {
    if (decision) {
      setReason("");
      const focus = window.setTimeout(() => fieldRef.current?.focus(), 60);
      return () => window.clearTimeout(focus);
    }
  }, [decision]);

  const approving = decision === "approve";
  const noun = count === 1 ? "response" : "responses";

  return (
    <AlertDialog
      open={Boolean(decision)}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-md border-[var(--gator-border-strong)] bg-[var(--gator-surface)] p-6">
        <AlertDialogHeader className="flex-row items-start gap-3 space-y-0 text-left">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              approving
                ? "bg-[var(--tone-ok-wash)] text-[var(--tone-ok)]"
                : "bg-[var(--tone-bad-wash)] text-[var(--tone-bad)]"
            }`}
          >
            {approving ? <IconCheck size={20} /> : <IconX size={20} />}
          </span>
          <div className="min-w-0">
            <AlertDialogTitle className="text-base font-bold text-[var(--gator-text)]">
              {approving ? "Approve" : "Deny"} {count} {noun}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="cool-text mt-2 text-sm leading-relaxed">
                Every applicant gets the roles, the DM and the audit entry they
                would from a single decision. The note below is shared by all{" "}
                {count} and is included in their DM.
              </div>
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--gator-text-muted)]">
            Shared reason
            <span className="ml-2 font-semibold normal-case tracking-normal opacity-60">
              optional
            </span>
          </span>
          <textarea
            ref={fieldRef}
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 1000))}
            rows={3}
            disabled={busy}
            placeholder={
              approving
                ? "Welcome aboard! Check your DMs for next steps."
                : "Thanks for applying. We're looking for a bit more detail next time."
            }
            className="gator-control mt-2 w-full resize-y rounded-xl px-3 py-2 text-sm leading-6 disabled:opacity-50"
          />
          <span className="mt-1 block text-right text-[11px] text-[var(--gator-text-muted)]">
            {reason.length}/1000
          </span>
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="gator-control rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={busy}
            className={`gator-control rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60 ${
              approving
                ? "border-[var(--tone-ok-line)] bg-[var(--tone-ok-wash)] text-[var(--tone-ok)] hover:bg-[var(--tone-ok-wash)]"
                : "border-[var(--tone-bad-line)] bg-[var(--tone-bad-wash)] text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)]"
            }`}
          >
            {busy
              ? `${approving ? "Approving" : "Denying"}…`
              : `${approving ? "Approve" : "Deny"} ${count}`}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
