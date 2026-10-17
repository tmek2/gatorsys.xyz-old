"use client";
import { useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { IconArrowUpRight, IconPin, IconPinnedOff } from "@tabler/icons-react";
import {
  communityTransition,
  useCommunityLink,
} from "@/components/servers/community-navigation";
import "@/components/servers/server-card.css";

type ServerCardProps = {
  name: string;
  iconUrl: string | null;
  bannerUrl?: string | null;
  splashUrl?: string | null;
  id: string;
  memberCount?: number;
  moduleCount?: number;
  pinned?: boolean;
  onPin?: () => void;
  role?: string;
  channelCount?: number;
  roleCount?: number;
  isAdmin?: boolean;
  isManager?: boolean;
};

/**
 * Shows the navigation as pending once started (`/manage` is server-rendered
 * and takes a moment), via `useLinkStatus` from the surrounding `Link`.
 */
function OpenMark({ transitioning }: { transitioning: boolean }) {
  const status = useLinkStatus();
  const pending = transitioning || status.pending;
  return (
    <span role="status">
      {pending ? (
        <>
          <span className="sv-spin" aria-hidden="true" />
          Opening…
        </>
      ) : (
        <>
          Manage
          <IconArrowUpRight size={14} />
        </>
      )}
    </span>
  );
}

/**
 * One server in the picker, on ERM's guild-card layout: a banner with the
 * card's ground faded up over it, the icon hanging off it with a ring of that
 * ground, the name, the member count, and the way in as a button across the
 * foot. One surface.
 */
export default function ServerCard({
  name,
  iconUrl,
  bannerUrl,
  splashUrl,
  id,
  memberCount,
  pinned = false,
  onPin,
}: ServerCardProps) {
  const way = useRef<HTMLAnchorElement>(null);
  const [broken, setBroken] = useState(false);
  const [artBroken, setArtBroken] = useState(false);
  const href = `/manage/${id}/overview`;
  const navigation = useCommunityLink({ id, name, icon: iconUrl }, href);
  const artwork = bannerUrl || splashUrl;
  const hasArt = Boolean(artwork) && !artBroken;
  const monogram = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <article
      className="sv-frame"
      data-pinned={pinned ? "true" : "false"}
      data-pin={onPin ? "true" : "false"}
      data-art={hasArt ? "true" : "false"}
      /* Which server this card is, so the picker can find the cards that are
         about to leave a filter and take them apart before they go. */
      data-server-id={id}
      /* Clicking anywhere on the card opens the server by clicking the way-in
         link (keeping its prefetch, pending state and view transition). The
         link remains the one focusable, announced control. Controls inside the
         card (the pin) handle their own clicks. */
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        way.current?.click();
      }}
    >
      {/* The banner edge to edge, with the card's ground faded up over it so the
         icon and name stay legible on any artwork. */}
      <span className="sv-band" data-art={hasArt ? "true" : "false"}>
        {hasArt ? (
          <img
            className="sv-band-art"
            src={artwork as string}
            alt=""
            loading="lazy"
            onError={() => setArtBroken(true)}
          />
        ) : null}
      </span>

      <div className="sv-body">
        {/* Hung off the banner, with a ring of the card's ground around it. */}
        <span
          className="sv-tile"
          style={{ viewTransitionName: communityTransition(id) }}
        >
          {iconUrl && !broken ? (
            <img
              className="sv-tile-art"
              src={iconUrl}
              alt=""
              loading="lazy"
              onError={() => setBroken(true)}
            />
          ) : (
            <span className="sv-tile-art sv-tile-monogram">{monogram}</span>
          )}
        </span>

        <h2 className="sv-name" title={name}>
          {name}
        </h2>

        {/* One line at the foot where the count (at rest) and the way in (on
           hover) take turns at the same height, so hovering never changes the
           card's height and nothing below moves. */}
        <div className="sv-foot">
          {typeof memberCount === "number" ? (
            <p className="sv-sub">
              {memberCount.toLocaleString("en-US")}{" "}
              {memberCount === 1 ? "member" : "members"}
            </p>
          ) : null}

          {/* The way in: a button that says where it goes. The corner is left
             for the pin. */}
          <div className="sv-actions">
            <Link
              ref={way}
              className="sv-go"
              href={href}
              aria-busy={navigation.pending}
              onClick={navigation.onClick}
            >
              <OpenMark transitioning={navigation.pending} />
            </Link>
          </div>
        </div>
      </div>

      {onPin ? (
        <button
          className="sv-pin"
          type="button"
          aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
          aria-pressed={pinned}
          onClick={onPin}
        >
          {pinned ? <IconPinnedOff size={13} /> : <IconPin size={13} />}
        </button>
      ) : null}
    </article>
  );
}
