"use client";

import { useCallback, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";

interface UserAvatarProps {
  user: {
    image?: string | null;
    name?: string | null;
  };
  className?: string;
}

/**
 * A user's picture or their initial, never an empty circle. The initial is
 * always rendered, and the image is shown only once it has decoded, at which
 * point the initial stops being drawn (transparent PNG icons would otherwise
 * show the letter through them). Both states are tracked as which `src` they
 * belong to rather than as booleans reset in an effect (a ref callback runs
 * before effects and would be undone for already-cached images); a new src
 * invalidates both on its own.
 */
export function UserAvatar({ user, className }: UserAvatarProps) {
  const src = discordAvatarUrl(user.image);
  const [shown, setShown] = useState<string | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const failed = !!src && broken === src;
  const loaded = !!src && shown === src;

  /* A cached image is often complete before React attaches handlers, and
     `onLoad` does not fire for it, so the node itself is checked. */
  const check = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) setShown(src);
    },
    /* Deliberately keyed on `src`: React re-runs a ref callback whose identity
       changed, which is exactly when a new picture needs checking. */
    [src],
  );

  const initial = (user.name || "U").charAt(0).toUpperCase();
  return (
    <span
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.08] text-xs font-bold text-white/70 ${className || ""}`}
    >
      {src && !failed && loaded ? null : (
        <span aria-hidden={src && !failed ? "true" : undefined}>{initial}</span>
      )}
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={check}
          src={src}
          alt={user.name || "User avatar"}
          onLoad={() => setShown(src)}
          onError={() => setBroken(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}
