"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/status-screen";

/**
 * App-level error boundary for errors a nested boundary does not handle, so the
 * site shows a way on.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it for debugging without breaking the page.
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      title="Something went wrong"
      actions={[
        { label: "Try again", onClick: () => reset() },
        { label: "Go home", href: "/" },
      ]}
    >
      <p>That one is on us. Try again, and if it keeps happening, head home and come back in a minute.</p>
    </StatusScreen>
  );
}
