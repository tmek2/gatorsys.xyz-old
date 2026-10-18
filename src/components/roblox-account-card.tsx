"use client";

import {
  RippleButton,
  RippleButtonRipples,
} from "@/components/site/ripple-button";
import { useEffect, useState } from "react";
import {
  IconArrowRight,
  IconCheck,
  IconExternalLink,
  IconLink,
  IconLoader2,
  IconRefresh,
  IconUserCog,
} from "@tabler/icons-react";
import { RobloxLogo } from "@/components/brand-icons";

type RobloxIdentity = {
  linked: boolean;
  unavailable?: boolean;
  retryAfter?: number;
  id?: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
};

export function RobloxAccountCard({
  callbackUrl = "/servers",
}: {
  callbackUrl?: string;
}) {
  const [identity, setIdentity] = useState<RobloxIdentity | null>(null);
  const [avatar, setAvatar] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [refreshState, setRefreshState] = useState<"idle" | "busy" | "done">(
    "idle",
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown > 0]);

  async function refresh(force = false) {
    const response = await fetch(
      `/api/account/roblox${force ? "?refresh=1" : ""}`,
      { cache: "no-store" },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        payload.detail || payload.message || "Could not load Roblox account",
      );
    const nextIdentity = payload.roblox || { linked: false };
    setIdentity(nextIdentity);
    if (nextIdentity.unavailable)
      setCooldown(Math.max(1, Number(nextIdentity.retryAfter || 60)));
  }

  useEffect(() => {
    refresh().catch((reason) => {
      setIdentity({ linked: false });
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load Roblox account",
      );
    });
  }, []);
  useEffect(() => {
    if (!identity?.linked || !identity.id) {
      setAvatar("");
      return;
    }
    fetch(`/api/roblox?id=${encodeURIComponent(identity.id)}`, {
      cache: "force-cache",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setAvatar(payload?.avatarUrl || ""))
      .catch(() => setAvatar(""));
  }, [identity?.id, identity?.linked]);

  /**
   * The verification flow, for a first link or a change of account. `start`
   * returns immediately when an account is already linked; `relink` always runs
   * the flow and lets the result replace the link (and says so when polling).
   */
  async function verify(mode: "start" | "relink" = "start") {
    if (mode === "relink") setRelinking(true);
    else setVerifying(true);
    setError("");
    try {
      const response = await fetch("/api/account/roblox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode }),
      });
      const session = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429)
          setCooldown(Math.max(1, Number(session.retryAfter || 60)));
        throw new Error(
          session.detail || session.message || "Could not start verification",
        );
      }
      /* Only a `start` comes back already verified (the account is linked, so
         it is shown). A `relink` always gets a window. */
      if (session.status === "verified") {
        setIdentity(session.roblox);
        return;
      }
      const popup = window.open(
        session.verifyUrl,
        "gator-roblox-verification",
        "popup=yes,width=560,height=760",
      );
      if (!popup) throw new Error("Allow popups to verify your Roblox account");
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const statusResponse = await fetch("/api/account/roblox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "status",
            sid: session.sid,
            relink: mode === "relink",
          }),
        });
        const status = await statusResponse.json().catch(() => ({}));
        if (statusResponse.status === 429) {
          setCooldown(Math.max(1, Number(status.retryAfter || 60)));
          throw new Error(
            status.detail ||
              "Roblox verification is cooling down. Please try again shortly.",
          );
        }
        if (status.status === "verified") {
          setIdentity(status.roblox);
          popup.close();
          return;
        }
        if (["expired", "failed", "cancelled"].includes(status.status))
          throw new Error(status.message || "Verification did not complete");
        if (popup.closed && attempt > 3) break;
      }
      throw new Error("Verification was not completed");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Verification failed",
      );
    } finally {
      setVerifying(false);
      setRelinking(false);
    }
  }

  if (identity === null)
    return (
      <div
        className="roblox-panel roblox-panel-loading"
        aria-label="Loading Roblox connection"
      >
        <IconLoader2 size={22} className="animate-spin" />
        <span>Checking your Roblox connection…</span>
      </div>
    );

  return (
    <section className="roblox-panel">
      <header className="roblox-panel-head">
        <span className="roblox-service-mark">
          <RobloxLogo size={22} />
        </span>
        <div>
          <span>Roblox</span>
          <strong>{identity.linked ? "Connected" : "Not connected"}</strong>
        </div>
        <span
          className="roblox-status"
          data-linked={identity.linked ? "true" : "false"}
        >
          {identity.linked ? <IconCheck size={13} /> : null}
          {identity.linked ? "Verified" : "Ready to link"}
        </span>
      </header>

      <div className="roblox-panel-body">
        {identity.linked ? (
          <>
            <div className="roblox-identity">
              {avatar ? (
                <img src={avatar} alt="" onError={() => setAvatar("")} />
              ) : (
                <span className="roblox-identity-fallback">
                  <RobloxLogo size={28} />
                </span>
              )}
              <div>
                <strong>{identity.displayName || identity.username}</strong>
                <span>
                  {identity.username
                    ? `@${identity.username}`
                    : "Roblox account"}
                  {identity.id ? ` · ${identity.id}` : ""}
                </span>
              </div>
            </div>
            <div className="roblox-actions">
              <RippleButton
                as="a"
                href={identity.profileUrl}
                target="_blank"
                rel="noreferrer"
                variant="outline"
                size="sm"
              >
                <IconExternalLink size={14} />
                Roblox profile
                <RippleButtonRipples />
              </RippleButton>
              <RippleButton
                disabled={refreshState === "busy"}
                onClick={async () => {
                  setRefreshState("busy");
                  try {
                    await refresh(true);
                    setRefreshState("done");
                    window.setTimeout(() => setRefreshState("idle"), 2000);
                  } catch {
                    setRefreshState("idle");
                  }
                }}
                variant="outline"
                size="sm"
                className={refreshState === "done" ? "owner-on" : undefined}
              >
                {refreshState === "busy" ? (
                  <IconLoader2 size={14} className="animate-spin" />
                ) : refreshState === "done" ? (
                  <IconCheck size={14} />
                ) : (
                  <IconRefresh size={14} />
                )}
                {refreshState === "busy"
                  ? "Refreshing…"
                  : refreshState === "done"
                    ? "Refreshed!"
                    : "Refresh"}
                <RippleButtonRipples />
              </RippleButton>
              {/* Switch to a different Roblox account through the same
                 verification window; the result replaces this one. */}
              <RippleButton
                onClick={() => verify("relink")}
                disabled={relinking || cooldown > 0}
                variant="outline"
                size="sm"
              >
                {relinking ? (
                  <IconLoader2 size={14} className="animate-spin" />
                ) : (
                  <IconUserCog size={14} />
                )}
                {relinking
                  ? "Waiting…"
                  : cooldown > 0
                    ? `Wait ${cooldown}s`
                    : "Change account"}
                <RippleButtonRipples />
              </RippleButton>
            </div>
          </>
        ) : (
          <div className="roblox-connect">
            <p className="roblox-connect-copy">
              Link the Roblox account you use with Bot.
            </p>
            <RippleButton
              onClick={() => verify("start")}
              disabled={verifying || cooldown > 0}
              size="lg"
              className="roblox-connect-button"
            >
              {verifying ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconLink size={16} />
              )}
              {verifying
                ? "Waiting for verification..."
                : cooldown > 0
                  ? `Try again in ${cooldown}s`
                  : "Connect Roblox"}
              <RippleButtonRipples />
            </RippleButton>
          </div>
        )}
        {error ? (
          <p className="roblox-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {identity.linked ? (
        <footer className="roblox-panel-foot">
          <RippleButton
            as="a"
            href={callbackUrl.startsWith("/") ? callbackUrl : "/servers"}
            size="sm"
          >
            Continue
            <IconArrowRight size={16} />
            <RippleButtonRipples />
          </RippleButton>
        </footer>
      ) : null}
    </section>
  );
}
