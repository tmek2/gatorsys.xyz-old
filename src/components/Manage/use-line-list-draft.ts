"use client";

import { useEffect, useRef, useState } from "react";

/** Keep typed newlines until the parent replaces the list, for example on discard. */
export function useLineListDraft(values: string[], onChange: (values: string[]) => void, maxItems = Infinity) {
  const savedKey = JSON.stringify(values);
  const emittedKey = useRef(savedKey);
  const [text, setText] = useState(() => values.join("\n"));
  useEffect(() => {
    if (savedKey === emittedKey.current) return;
    emittedKey.current = savedKey;
    setText(values.join("\n"));
  }, [savedKey, values]);
  return {
    value: text,
    onChange(nextText: string) {
      setText(nextText);
      const next = nextText.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, maxItems);
      emittedKey.current = JSON.stringify(next);
      onChange(next);
    },
  };
}
