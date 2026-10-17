"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { IconLoader2, IconX } from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import {
  ChannelPicker,
  FieldRow,
  RolePicker,
  SelectField,
  TextAreaField,
  TextField,
} from "../fields";
import type { ApplicationQuestion } from "../types";
import type { ManagedChannel, ManagedRole } from "../types";
import { QuestionList } from "./questions";

/* Department actions: the editor (Settings) and the run dialog (opened from anywhere in the workspace). */

export function ActionEditorModal({
  draft,
  setDraft,
  roles,
  channels,
  onClose,
  onCreate,
  editing = false,
}: {
  draft: any;
  setDraft: (next: any) => void;
  roles: ManagedRole[];
  channels: ManagedChannel[];
  onClose: () => void;
  onCreate: () => void;
  /** Editing an existing action rather than creating one. */
  editing?: boolean;
}) {
  return createPortal(
    <div className="gator-overlay fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              {editing ? "Edit action" : "Create action"}
            </h3>
            <p className="cool-text mt-1 text-sm">
              Build a permission-controlled form members can run from the
              department.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/35 hover:text-white"
          >
            <IconX size={17} />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <FieldRow
            label="Name"
            description="Shown to members wherever this action appears"
          >
            <TextField
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
              placeholder="Arrest form"
            />
          </FieldRow>
          <FieldRow label="Description">
            <TextAreaField
              value={draft.description}
              onChange={(description) => setDraft({ ...draft, description })}
              rows={3}
            />
          </FieldRow>
          <FieldRow
            label="Required ranks"
            description="Leave empty to allow every department member"
          >
            <RolePicker
              roles={roles}
              multi
              value={draft.required_ranks}
              onChange={(value) =>
                setDraft({ ...draft, required_ranks: value as string[] })
              }
              placeholder="Select ranks"
            />
          </FieldRow>
          <FieldRow label="Discord log channel">
            <ChannelPicker
              channels={channels}
              value={draft.channel_id || null}
              onChange={(channel_id) =>
                setDraft({
                  ...draft,
                  channel_id: typeof channel_id === "string" ? channel_id : "",
                })
              }
              placeholder="Select channel"
            />
          </FieldRow>
          <div>
            <p className="mb-2 text-sm font-bold text-white/75">
              Form questions
            </p>
            <QuestionList
              questions={draft.questions}
              onChange={(questions) => setDraft({ ...draft, questions })}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-white/55"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!draft.name.trim()}
            onClick={onCreate}
            className="btn-pop btn-peach px-4 py-2 text-sm disabled:opacity-35"
          >
            {editing ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ActionRunModal({
  definition,
  profileId,
  onClose,
  onDone,
}: {
  definition: any;
  profileId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const questions: ApplicationQuestion[] = definition.questions || [];
  async function submit() {
    for (const question of questions)
      if (question.required && !answers[question.id]) {
        setNotice({ kind: "error", text: `Answer ${question.question}` });
        return;
      }
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/departmentaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          department_id: profileId,
          action_id: definition.id,
          answers,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Action failed");
      await onDone();
      setNotice({ kind: "saved", text: `${definition.name} submitted` });
      onClose();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Action failed",
      });
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div className="gator-overlay fixed inset-0 z-[130] flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              {definition.name}
            </h3>
            <p className="cool-text mt-1 text-sm">{definition.description}</p>
          </div>
          <button onClick={onClose}>
            <IconX size={17} />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {questions.map((question) => (
            <FieldRow
              key={question.id}
              label={question.question}
              hint={question.required ? "Required" : undefined}
            >
              {question.type.includes("long") ? (
                <TextAreaField
                  value={answers[question.id] || ""}
                  onChange={(value) =>
                    setAnswers({ ...answers, [question.id]: value })
                  }
                />
              ) : question.type.includes("choice") ? (
                <SelectField
                  value={answers[question.id] || null}
                  onChange={(value) =>
                    setAnswers({ ...answers, [question.id]: value })
                  }
                  options={(question.options || []).map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                />
              ) : (
                <TextField
                  value={answers[question.id] || ""}
                  onChange={(value) =>
                    setAnswers({ ...answers, [question.id]: value })
                  }
                />
              )}
            </FieldRow>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-white/55">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="btn-pop btn-peach inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? (
              <>
                <IconLoader2 size={15} className="animate-spin" />
                Submitting…
              </>
            ) : (
              `Submit ${definition.name}`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
