"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resourceDraftFingerprint } from "./resource-save";

type Resource = Record<string, any>;

/** Share one save queue between the timer, manual save and close controls. */
export function useResourceAutosave(resource: Resource, onSave: (snapshot: Resource) => Promise<void>, delay: number) {
  const current = useRef(resource);
  const save = useRef(onSave);
  current.current = resource;
  save.current = onSave;
  const saved = useRef<string | null>(null);
  if (saved.current === null) saved.current = resourceDraftFingerprint(resource);
  const failed = useRef<string | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) {
      await inFlight.current;
      return resourceDraftFingerprint(current.current) === saved.current;
    }
    const snapshot = structuredClone(current.current);
    const fingerprint = resourceDraftFingerprint(snapshot);
    if (fingerprint === saved.current) return true;
    setSaveState("saving");
    setSaveError(null);
    const pending = (async () => {
      try {
        await save.current(snapshot);
        saved.current = fingerprint;
        failed.current = null;
        const unchanged = resourceDraftFingerprint(current.current) === fingerprint;
        setSaveState(unchanged ? "saved" : "dirty");
        return unchanged;
      } catch (error) {
        failed.current = fingerprint;
        setSaveState("dirty");
        setSaveError(error instanceof Error ? error.message : "Could not save this resource. Try again.");
        return false;
      }
    })();
    inFlight.current = pending;
    try {
      return await pending;
    } finally {
      inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    const fingerprint = resourceDraftFingerprint(resource);
    if (fingerprint === saved.current) {
      if (saveState !== "saving") setSaveState("saved");
      return;
    }
    // A newer edit queues another save after the active request completes.
    // A failed unchanged draft waits for an explicit retry, not a tight loop.
    if (saveState === "saving" || fingerprint === failed.current) return;
    setSaveState("dirty");
    const timer = window.setTimeout(() => void saveNow(), delay);
    return () => window.clearTimeout(timer);
  }, [resource, saveState, saveNow, delay]);

  return { saveState, saveError, saveNow };
}
