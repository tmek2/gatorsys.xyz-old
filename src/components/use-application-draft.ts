"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";

type Answers = Record<string, unknown>;
const EMPTY: Answers = {};

export function applicationDraftKey(userId: string, guildId: string, applicationId: string) {
  return `application-draft:${userId}:${guildId}:${applicationId}`;
}

/** Bind answers to their owner so a route/account change cannot save old data. */
export function useApplicationDraft(userId: string, guildId: string, applicationId: string) {
  const key = userId && guildId && applicationId ? applicationDraftKey(userId, guildId, applicationId) : "";
  const [draft, setDraft] = useState<{ key: string; answers: Answers }>({ key: "", answers: EMPTY });
  const answers = draft.key === key ? draft.answers : EMPTY;

  useEffect(() => {
    let restored: Answers = {};
    try {
      const saved = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
      if (saved && typeof saved === "object" && !Array.isArray(saved)) restored = saved;
    } catch {
      // A malformed or unavailable local draft must not block the form.
    }
    setDraft({ key, answers: restored });
  }, [key]);

  useEffect(() => {
    if (!key || draft.key !== key) return;
    try {
      if (Object.keys(draft.answers).length) localStorage.setItem(key, JSON.stringify(draft.answers));
      else localStorage.removeItem(key);
    } catch {
      // Editing still works when browser storage is full or disabled.
    }
  }, [draft, key]);

  const setAnswers = useCallback((next: SetStateAction<Answers>) => {
    setDraft((current) => ({
      key,
      answers: typeof next === "function" ? next(current.key === key ? current.answers : EMPTY) : next,
    }));
  }, [key]);

  const clearDraft = useCallback(() => {
    try { if (key) localStorage.removeItem(key); } catch { /* optional storage */ }
    setDraft({ key, answers: {} });
  }, [key]);

  return { key, answers, setAnswers, clearDraft };
}
