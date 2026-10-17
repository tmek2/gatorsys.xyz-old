"use client";

import React from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmState {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

/** In-site confirmation dialog, in place of the browser's `confirm()`. */
export function ConfirmModal({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md border-[var(--gator-border-strong)] bg-[var(--gator-surface)] p-6">
        <AlertDialogHeader className="flex-row items-start gap-3 space-y-0 text-left">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              state?.danger
                ? "bg-[var(--tone-bad-wash)] text-[var(--tone-bad)]"
                : "bg-[var(--gator-accent-soft)] text-[var(--gator-accent)]"
            }`}
          >
            <IconAlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <AlertDialogTitle className="text-base font-bold text-[var(--gator-text)]">
              {state?.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="cool-text mt-2 text-sm leading-relaxed">
                {state?.body}
              </div>
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel className="gator-control">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              state?.onConfirm();
            }}
            className={`gator-control font-bold ${
              state?.danger
                ? "border-[var(--tone-bad-line)] bg-[var(--tone-bad-wash)] text-[var(--tone-bad)] hover:bg-[var(--tone-bad-wash)]"
                : "gator-control-primary"
            }`}
          >
            {state?.confirmLabel || "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
