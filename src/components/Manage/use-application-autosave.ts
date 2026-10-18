"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Try each draft once. A failed write waits for a new edit or an explicit retry. */
export function useApplicationAutosave({ dirty, paused, revision, save }: {
  dirty: boolean;
  paused: boolean;
  revision: string;
  save: () => Promise<boolean>;
}) {
  const attempted = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => {
    attempted.current = null;
    setRetryCount((count) => count + 1);
  }, []);
  useEffect(() => {
    if (!dirty) {
      attempted.current = null;
      setFailed(false);
      return;
    }
    if (paused || attempted.current === revision) return;
    const timer = setTimeout(() => {
      attempted.current = revision;
      setFailed(false);
      void save().then((ok) => setFailed(!ok), () => setFailed(true));
    }, 650);
    return () => clearTimeout(timer);
  }, [dirty, paused, revision, retryCount, save]);
  return { failed, retry };
}
