"use client";

import { StatusScreen } from "@/components/status-screen";

/* Shown when the page exists but this account may not open it (a transcript
   from another server, a panel for a server you do not staff). */
export default function UnauthorizedScreen() {
  return (
    <StatusScreen
      title="You can’t open this"
      actions={[
        { label: "Go back", onClick: () => window.history.back() },
        { label: "Your servers", href: "/servers" },
      ]}
    >
      <p>
        Your account doesn’t have access to it. If it should, ask a server admin, or sign in
        with the account that does.
      </p>
    </StatusScreen>
  );
}
