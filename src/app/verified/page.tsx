"use client";

import { use, useEffect, useState } from "react";
import { StatusScreen } from "@/components/status-screen";
import { getDiscordBotInviteUrl } from "@/utils/discord-links";

/* Where the Roblox link lands once it worked: the status screen, with the
   member's Roblox picture in place of the mark once loaded, telling them they
   can go back to Discord. */
export default function Page({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  // A promise in this version of Next; read synchronously it warned on every
  // visit and will stop working in the next.
  const u = use(searchParams).u || "";
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    async function fetchRobloxData() {
      try {
        const response = await fetch(`/api/roblox?id=${encodeURIComponent(u)}`);
        const data = await response.json();
        if (data.error) return;
        setUsername(data.username || "");
        setAvatarUrl(data.avatarUrl || "");
      } catch {
        /* the page still says it worked; the picture is a nicety */
      }
    }
    if (u) fetchRobloxData();
  }, [u]);

  return (
    <StatusScreen
      label="Verified"
      title={username ? `Welcome, ${username}` : "You’re verified"}
      mark={
        avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="gs-status-avatar" />
        ) : undefined
      }
      actions={[
        { label: "Add Bot to a server", href: getDiscordBotInviteUrl() },
        { label: "Your servers", href: "/servers" },
      ]}
    >
      <p>Your Roblox account is linked. You can close this page and go back to Discord.</p>
    </StatusScreen>
  );
}
