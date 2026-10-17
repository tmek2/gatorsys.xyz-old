"use client";

import { useEffect, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";

/**
 * A member's picture in a list. The bot sends null when it cannot resolve a
 * member, which would show a broken-image glyph, so there are three states in
 * order: 1. the normalised URL; 2. on failure, the same URL without `size` and
 * with a .gif extension (how an animated avatar must be requested); 3. on
 * failure, the member's initial.
 *
 * A failing URL is written to `data-avatar-error` so a missing picture can be
 * diagnosed from the element.
 */
export function MemberAvatar({
  src,
  name,
  className = "h-9 w-9",
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
}) {
  const url = discordAvatarUrl(src);
  const [attempt, setAttempt] = useState(0);

  // Rows are recycled as the roster filters and re-sorts, so one member's
  // failure must not stick to whoever lands in the slot next.
  useEffect(() => {
    setAttempt(0);
  }, [url]);

  let showing = url;
  if (url && attempt === 1) {
    try {
      const retry = new URL(url);
      retry.search = "";
      retry.pathname = /\.[a-z0-9]+$/i.test(retry.pathname)
        ? retry.pathname.replace(/\.[a-z0-9]+$/i, ".gif")
        : `${retry.pathname}.gif`;
      showing = retry.toString();
    } catch {
      showing = null;
    }
  }

  if (!showing || attempt > 1) {
    return (
      <span
        aria-hidden="true"
        data-avatar-error={url || undefined}
        className={`${className} flex shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-white/45`}
      >
        {(name || "?").charAt(0).toUpperCase()}
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      key={attempt}
      src={showing}
      alt=""
      onError={() => setAttempt((current) => current + 1)}
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  );
}
