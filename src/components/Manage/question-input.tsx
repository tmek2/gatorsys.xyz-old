"use client";

import type { ApplicationQuestion } from "./types";

/**
 * The form's questions render through `FormQuestionCard`
 * (form-question-field.tsx); this file keeps the validation predicate.
 */

/** True when a required question has no usable answer. Sections are skipped. */
export function questionUnanswered(
  question: ApplicationQuestion,
  value: any,
): boolean {
  if ((question as any).type === "section") return false;
  if (question.required === false || !question.required) return false;
  if ((question as any).type === "multiple_choice_multi")
    return !Array.isArray(value) || value.length === 0;
  if (value === null || value === undefined) return true;
  return String(value).trim().length === 0;
}
