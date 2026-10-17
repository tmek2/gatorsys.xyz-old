import type { Metadata } from "next";
import { StatusScreen } from "@/components/status-screen";

/**
 * The 404 page (`error.tsx` handles thrown errors). Most 404s here are deleted
 * share links, closed ticket panels or expired invites, so the copy names those
 * cases and offers two places worth going. The gator says something when
 * pressed.
 */
export const metadata: Metadata = {
  title: "Page not found",
  // A 404 in the index is a 404 in the search results.
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <StatusScreen
      label="404"
      title="This page isn’t here"
      lines={[
        "It went for a swim.",
        "Even gators get lost sometimes.",
        "Nothing in this part of the swamp.",
        "Still nothing. The gator checked twice.",
      ]}
      actions={[
        { label: "Go home", href: "/" },
        { label: "Your servers", href: "/servers" },
      ]}
    >
      <p>
        The link may have expired, or what it pointed at was deleted. Shared documents,
        ticket panels and invites stop working once they’re removed, so if someone sent you
        this, ask them for a new link.
      </p>
    </StatusScreen>
  );
}
