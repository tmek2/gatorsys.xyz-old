"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { IconLoader2, IconX } from "@tabler/icons-react";
import { useWorkspaceHost } from "../workspace-host";
import { FieldRow, SelectField, TextAreaField, TextField } from "../fields";
import type { ApplicationQuestion } from "../types";
import { DOCUMENT_FRAME_STYLE } from "./shared";
import { sanitizeDocumentHtml } from "@/utils/document-html";

/* A resource opened from the workspace, read in place. */

export function ResourceViewModal({
  resource,
  onClose,
}: {
  resource: any;
  onClose: () => void;
}) {
  const { guildId, setNotice } = useWorkspaceHost();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`/api/manage/${guildId}/deptresources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", id: resource.id, answers }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.detail || "Could not submit application");
      setNotice({ kind: "saved", text: `${resource.title} submitted` });
      onClose();
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not submit application",
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
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              {resource.title}
            </h3>
            <p className="cool-text mt-1 text-sm">{resource.description}</p>
          </div>
          <button onClick={onClose}>
            <IconX size={17} />
          </button>
        </div>
        {resource.kind === "document" ? (
          <iframe
            sandbox=""
            title={resource.title}
            srcDoc={`${DOCUMENT_FRAME_STYLE}${sanitizeDocumentHtml(resource.document_html)}`}
            className="mt-5 h-[65vh] w-full rounded-xl border border-white/[0.08]"
          />
        ) : (
          <div className="mt-5 space-y-4">
            {(resource.questions || []).map((question: ApplicationQuestion) => (
              <FieldRow
                key={question.id}
                label={question.question}
                description={question.required ? "Required" : undefined}
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
            <div className="flex justify-end">
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
                  "Submit application"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
