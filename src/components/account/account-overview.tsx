"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  IconArrowRight,
  IconChevronRight,
  IconLogout,
  IconRefresh,
  IconShieldCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { UserAvatar } from "@/components/user-avatar";
import { RobloxLogo } from "@/components/brand-icons";
import { SUPPORT_URL } from "@/config/site";
import {
  RippleButton,
  RippleButtonRipples,
} from "@/components/site/ripple-button";

type ConnectedRoblox = {
  linked: boolean;
  id?: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  avatar?: string;
};
export function AccountOverview({
  user,
  serversSlot,
}: {
  user: { id: string; name: string; image: string | null };
  /* The servers sheet, rendered on the server behind its own Suspense boundary
     and passed in, so the page does not wait for the bot (see
     account-servers.tsx). */
  serversSlot: ReactNode;
}) {
  const [roblox, setRoblox] = useState<ConnectedRoblox | null>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const mountedUser = useRef(user.id);
  useEffect(() => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 12000);
    let live = true;
    setChecking(true);
    setFailed(false);
    if (mountedUser.current !== user.id) {
      setRoblox(null);
      mountedUser.current = user.id;
    }
    fetch("/api/account/roblox", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const payload = await response.json();
        if (typeof payload.roblox?.linked !== "boolean")
          throw new Error("Invalid connection response");
        if (!live) return;
        const result: ConnectedRoblox = payload.roblox;
        setRoblox(result);
        setAvatarBroken(false);
        try {
          const key = `gator:connection:${user.id}`;
          const previous = sessionStorage.getItem(key);
          if (previous === "unlinked" && result.linked) setCelebrate(true);
          sessionStorage.setItem(key, result.linked ? "linked" : "unlinked");
        } catch {
          /* Connection checks work without browser storage. */
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        clearTimeout(deadline);
        if (live) setChecking(false);
      });
    return () => {
      live = false;
      clearTimeout(deadline);
      controller.abort();
    };
  }, [user.id, attempt]);
  return (
    <div className="account-stack">
      {/* The page in ERM's settings layout: a plain title, then two columns of
         sheets, each a hairline box with a header band and rows divided by
         hairlines. Palette, type and accent are Gator's. */}
      <header className="account-head">
        <h1>Account</h1>
        <p>Your connections and the servers Gator is in with you.</p>
      </header>

      <div className="account-grid">
        <div className="account-col">
          {/* Discord. The account you are signed in as, and the way out. */}
          <section className="account-card">
            <h2 className="account-card-eyebrow">Discord</h2>
            <div className="account-who">
              <UserAvatar
                user={{ name: user.name, image: user.image ?? undefined }}
                className="account-who-face"
              />
              <div>
                <p className="account-who-name">{user.name}</p>
                <p className="account-who-id">{user.id}</p>
              </div>
            </div>
            <RippleButton
              className="account-button"
              variant="outline"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <IconLogout size={15} />
              Sign out
              <RippleButtonRipples />
            </RippleButton>
          </section>

          {/* Roblox. */}
          <section className="account-card" aria-busy={checking}>
            <h2 className="account-card-eyebrow">Roblox</h2>

            {roblox?.linked ? (
              <div className="account-who">
                {roblox.avatar && !avatarBroken ? (
                  <img
                    src={roblox.avatar}
                    alt=""
                    className="account-who-face account-who-square"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  <span className="account-who-face account-who-square account-who-mark">
                    <RobloxLogo size={22} />
                  </span>
                )}
                <div>
                  <p className="account-who-name">
                    {roblox.displayName || roblox.username || "Roblox account"}
                  </p>
                  <p className="account-who-id">
                    @{roblox.username || roblox.id}
                  </p>
                </div>
              </div>
            ) : (
              <p className="account-note" role="status">
                <IconAlertTriangle size={15} />
                <span>
                  {checking
                    ? "Checking your Roblox connection."
                    : failed
                      ? "Gator could not reach Roblox just now."
                      : "No Roblox account linked. Applications and in-game checks use it."}
                </span>
              </p>
            )}

            <div className="account-card-actions">
              {failed ? (
                <RippleButton
                  className="account-button"
                  variant="outline"
                  onClick={() => setAttempt((v) => v + 1)}
                  disabled={checking}
                >
                  <IconRefresh size={15} />
                  Try again
                  <RippleButtonRipples />
                </RippleButton>
              ) : (
                <RippleButton
                  as={Link}
                  href="/account/roblox?callbackUrl=%2Faccount"
                  className="account-button"
                  variant="outline"
                >
                  {roblox?.linked ? "Manage connection" : "Link account"}
                  <IconArrowRight size={15} />
                  <RippleButtonRipples />
                </RippleButton>
              )}
            </div>

            {celebrate && (
              <p className="account-said" role="status">
                Roblox connected.
              </p>
            )}
          </section>
        </div>

        <div className="account-col">
          {/* The servers, as a grouped list: a header band, then one row each,
              divided by hairlines. */}
          <section className="account-card account-card-flush">
            <div className="account-card-head">
              <div>
                <h2>Servers you manage</h2>
                <p>Gator is in these with you.</p>
              </div>
              <RippleButton
                as={Link}
                href="/servers"
                className="account-button"
                variant="outline"
              >
                View all
                <IconArrowRight size={15} />
                <RippleButtonRipples />
              </RippleButton>
            </div>

            {serversSlot}
          </section>

          {/* Your data, as the same grouped list. */}
          <section className="account-card account-card-flush">
            <div className="account-card-head">
              <div>
                <h2>Your data</h2>
                <p>What Gator knows, and how to change it.</p>
              </div>
              <IconShieldCheck size={18} className="account-card-mark" />
            </div>
            {/* The data rows answer in place (a list of what Gator holds)
               instead of linking into the privacy policy, which stays available
               for the exact wording. The third row (a privacy request) is a
               conversation with a person, so it stays a link with an arrow. */}
            <ul className="account-rows account-rows-open">
              <li>
                <details className="account-fold">
                  <summary>
                    <span className="account-row-name">
                      What Gator collects
                    </span>
                    <IconChevronRight size={16} className="account-fold-mark" />
                  </summary>
                  <dl className="account-facts">
                    <div>
                      <dt>From Discord</dt>
                      <dd>
                        Your user ID, username, avatar, and the servers you can
                        manage.
                      </dd>
                    </div>
                    <div>
                      <dt>From a server</dt>
                      <dd>
                        Roles, channels, permissions, and whatever the modules
                        you switch on record: infractions, tickets and
                        transcripts, shifts, staff activity.
                      </dd>
                    </div>
                    <div>
                      <dt>From this site</dt>
                      <dd>
                        A session cookie, a short cache of your server list, and
                        request and error logs.
                      </dd>
                    </div>
                    {/* The way to the exact wording in the policy, naming the
                       part it points to: the site's one button, like every
                       other action on this page. */}
                    <RippleButton
                      as={Link}
                      className="account-facts-more account-button"
                      href="/privacy#information-we-collect"
                      aria-label="More on what Gator collects, in the privacy policy"
                      variant="outline"
                      size="sm"
                    >
                      Read the policy
                      <IconArrowRight size={14} />
                      <RippleButtonRipples />
                    </RippleButton>
                  </dl>
                </details>
              </li>
              <li>
                <details className="account-fold">
                  <summary>
                    <span className="account-row-name">Your choices</span>
                    <IconChevronRight size={16} className="account-fold-mark" />
                  </summary>
                  <dl className="account-facts">
                    <div>
                      <dt>A copy, a correction, or deletion</dt>
                      <dd>
                        Ask support. They check it is you, then act on it.
                      </dd>
                    </div>
                    <div>
                      <dt>Stop collecting in a server</dt>
                      <dd>Remove Gator from it.</dd>
                    </div>
                    <div>
                      <dt>Stop entirely</dt>
                      <dd>
                        Disconnect Gator in Discord, or sign out of this site.
                      </dd>
                    </div>
                    <RippleButton
                      as={Link}
                      className="account-facts-more account-button"
                      href="/privacy#your-choices-and-rights"
                      aria-label="More on your choices, in the privacy policy"
                      variant="outline"
                      size="sm"
                    >
                      Read the policy
                      <IconArrowRight size={14} />
                      <RippleButtonRipples />
                    </RippleButton>
                  </dl>
                </details>
              </li>
              <li>
                <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
                  <span className="account-row-name">
                    Make a privacy request
                  </span>
                  <IconArrowRight size={16} />
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
