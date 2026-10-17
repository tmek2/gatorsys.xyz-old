"use client";

import { StatusScreen } from "@/components/status-screen";

/* The panel's own boundary. It printed the raw error message in red, under
   an exclamation, which told a member nothing they could act on. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <StatusScreen
      title="This panel didn’t load"
      actions={[
        { label: "Try again", onClick: () => reset() },
        { label: "Your servers", href: "/servers" },
      ]}
    >
      <p>Something went wrong while opening it. Try again in a moment.</p>
    </StatusScreen>
  );
}
