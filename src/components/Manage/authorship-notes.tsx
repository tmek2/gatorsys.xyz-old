"use client";

import React from "react";
import { IconAlertTriangle, IconRobot } from "@tabler/icons-react";
import {
  AI_VERDICT_LABEL,
  VERDICT_LABEL,
  verdictFor,
  type AiQuestionFlag,
  type QuestionIntegrity,
} from "@/components/application-integrity";

/**
 * What a reviewer is told about how one answer came to exist. Two signals, kept
 * visibly apart:
 *
 * Paste: counted by the form while the answer was written. A measurement. AI:
 * judged by a detector afterwards, when a reviewer asked. An estimate.
 *
 * They show as tags beside the question and, when there is something to say, a
 * note under the answer, always closing with: a hint, not a verdict. Shared by
 * both review surfaces (the server Responses tab and the department workspace).
 */

const TONE_TAG: Record<"good" | "warn" | "flag", string> = {
  good: "border-[var(--tone-ok-line)] bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]",
  warn: "border-[var(--tone-warn-line)] bg-[var(--tone-warn-soft)] text-[var(--tone-warn)]",
  flag: "border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]",
};

const TONE_NOTE: Record<"good" | "warn" | "flag", string> = {
  good: "border-[var(--tone-ok-line)] bg-[var(--tone-ok-soft)] text-[var(--tone-ok)]",
  warn: "border-[var(--tone-warn-line)] bg-[var(--tone-warn-soft)] text-[var(--tone-warn)]",
  flag: "border-[var(--tone-bad-line)] bg-[var(--tone-bad-soft)] text-[var(--tone-bad)]",
};

function Tag({
  tone,
  icon,
  label,
  title,
}: {
  tone: "good" | "warn" | "flag";
  icon: React.ReactNode;
  label: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${TONE_TAG[tone]}`}
    >
      {icon}
      {label}
    </span>
  );
}

/**
 * The tag row beside a question. The expected outcomes ("typed", "reads as
 * written") show no tag, so a tag always means something.
 */
export function AuthorshipTags({
  integrity,
  answer,
  ai,
}: {
  integrity?: QuestionIntegrity;
  answer: unknown;
  ai?: AiQuestionFlag;
}) {
  const paste = verdictFor(
    integrity,
    typeof answer === "string" ? answer.length : 0,
  );
  const showPaste = paste && paste !== "typed";
  const showAi = ai && ai.verdict !== "clear";
  if (!showPaste && !showAi) return null;
  return (
    <span className="inline-flex shrink-0 flex-wrap items-center gap-1">
      {showPaste ? (
        <Tag
          tone={VERDICT_LABEL[paste].tone}
          icon={<IconAlertTriangle size={11} />}
          label={VERDICT_LABEL[paste].label}
          title={VERDICT_LABEL[paste].detail}
        />
      ) : null}
      {showAi ? (
        <Tag
          tone={AI_VERDICT_LABEL[ai.verdict].tone}
          icon={<IconRobot size={11} />}
          label={AI_VERDICT_LABEL[ai.verdict].label}
          title={AI_VERDICT_LABEL[ai.verdict].detail}
        />
      ) : null}
    </span>
  );
}

/** The explanation under the answer, in the same card. Returns null when there
 *  is nothing worth interrupting the reviewer for. */
export function AuthorshipNotes({
  integrity,
  answer,
  ai,
}: {
  integrity?: QuestionIntegrity;
  answer: unknown;
  ai?: AiQuestionFlag;
}) {
  const paste = verdictFor(
    integrity,
    typeof answer === "string" ? answer.length : 0,
  );
  const showPaste = paste && paste !== "typed";
  const showAi = ai && ai.verdict !== "clear";
  if (!showPaste && !showAi) return null;

  return (
    <div className="mt-3 space-y-2">
      {showPaste ? (
        <p
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed ${TONE_NOTE[VERDICT_LABEL[paste].tone]}`}
        >
          <IconAlertTriangle size={15} className="mt-1 shrink-0" />
          <span>
            {paste === "fast"
              ? "This answer appeared faster than it could reasonably be typed."
              : paste === "pasted"
                ? "This answer might have been copy-pasted. Nearly all of it arrived in one paste."
                : "Part of this answer might have been copy-pasted."}{" "}
            <span className="opacity-60">
              Drafting elsewhere is normal; this is a hint, not a verdict.
            </span>
          </span>
        </p>
      ) : null}
      {showAi ? (
        <p
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed ${TONE_NOTE[AI_VERDICT_LABEL[ai.verdict].tone]}`}
        >
          <IconRobot size={15} className="mt-1 shrink-0" />
          <span>
            {AI_VERDICT_LABEL[ai.verdict].detail}
            {ai.reasons.length ? (
              <>
                {" "}
                <span className="opacity-70">{ai.reasons.join(" ")}</span>
              </>
            ) : null}{" "}
            <span className="opacity-60">
              Detection is an estimate, not evidence. Read the answer before
              deciding anything.
            </span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
