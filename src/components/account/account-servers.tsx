"use client";

import "@/components/site/skeleton.css";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconChevronRight,
  IconRefresh,
} from "@tabler/icons-react";
import { UserAvatar } from "@/components/user-avatar";
import {
  RippleButton,
  RippleButtonRipples,
} from "@/components/site/ripple-button";

export type AccountServer = { id: string; name: string; icon: string | null };

/**
 * The servers sheet, on its own so the page does not wait for it: the list
 * comes from the bot (a 4 to 6 second deadline with a retry), while everything
 * else on the page is already available. As the only thing behind a Suspense
 * boundary, the page draws immediately with this sheet as a placeholder.
 */
export function AccountServers({
  servers,
  failed = false,
}: {
  servers: AccountServer[];
  failed?: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  if (failed) {
    return (
      <div className="account-card-body">
        <p className="account-note" role="status">
          <IconAlertTriangle size={15} />
          <span>We couldn’t check your server access.</span>
        </p>
        <div className="account-card-actions">
          <RippleButton
            className="account-button"
            variant="outline"
            disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}
          >
            <IconRefresh size={15} />
            {refreshing ? "Checking…" : "Try again"}
            <RippleButtonRipples />
          </RippleButton>
        </div>
      </div>
    );
  }

  if (!servers.length) {
    return (
      <div className="account-card-body">
        <p className="account-note">
          <IconAlertTriangle size={15} />
          <span>
            Gator has to be in a server you administer before it appears here.
          </span>
        </p>
        <div className="account-card-actions">
          <RippleButton
            as={Link}
            href="/servers"
            className="account-button"
            variant="outline"
          >
            Choose a server
            <IconArrowRight size={15} />
            <RippleButtonRipples />
          </RippleButton>
        </div>
      </div>
    );
  }

  /* The same arrival as the picker's cards (`gator-stagger` from motion.css,
     capped so long lists do not queue). The placeholder rows have the same
     height, so the arrival animation is what shows the rows landed. */
  return (
    <ul className="account-rows gator-stagger">
      {servers.slice(0, 6).map((server) => (
        <li key={server.id}>
          <Link href={`/manage/${server.id}/overview`}>
            <UserAvatar
              user={{ name: server.name, image: server.icon }}
              className="account-row-face"
            />
            <span className="account-row-name">{server.name}</span>
            <IconChevronRight size={16} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* The sheet while the bot is asked: four rows at the real rows' height. The
   heading is drawn normally, since it is known. */
export function AccountServersLoading() {
  return (
    <ul className="account-rows" aria-busy="true">
      <li className="sr-only" role="status">
        Checking your server access
      </li>
      {[0, 1, 2, 3].map((row) => (
        <li key={row} className="account-row-skel">
          <span className="skel-dot account-row-face" />
          <span
            className="skel-bar"
            style={{ width: `${[58, 44, 66, 38][row]}%` }}
          />
        </li>
      ))}
    </ul>
  );
}
