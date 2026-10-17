"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconHourglass,
  IconRefresh,
  IconServer,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { useManage } from "./manage-context";
import { StatusDot, type Tone } from "./indicator";

/**
 * The ER:LC connection as a panel, shown on both the Sessions and ER:LC tabs:
 * connection state, plus what ER:LC's `/server` endpoint returns (the
 * verification requirement, team balance, and the queue).
 */

export interface PrcServerInfo {
  linked: boolean;
  online?: boolean;
  server?: {
    name: string;
    joinCode: string;
    players?: number;
    maxPlayers?: number;
    ownerId?: string | null;
    coOwnerIds?: string[];
    verifiedReq?: string | null;
    teamBalance?: boolean;
    queue?: number | null;
  };
}

/** How ER:LC words its own account-verification setting. */
const VERIFIED_LABELS: Record<string, string> = {
  Disabled: "Anyone can join",
  Email: "Email verified only",
  "Phone/ID": "Phone or ID verified only",
};

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
      <p className="cool-text flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
        <span className="text-white/30">{icon}</span>
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-semibold ${
          tone === "warn" ? "text-[var(--tone-warn)]" : "text-[#f5f2f2]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function ErlcStatus({ compact = false }: { compact?: boolean }) {
  const { guildId } = useManage();
  const [info, setInfo] = useState<PrcServerInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/prcserver`);
      setInfo(res.ok ? await res.json() : null);
    } catch {
      /* An unreachable bot is already what "not connected" looks like. */
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const server = info?.online ? info.server : undefined;
  // Connected is the one live state, so it is the one dot that pulses; it uses
  // the tone tokens so it follows the theme.
  const state: { text: string; tone: Tone; live?: boolean } = server
    ? { text: "Connected", tone: "ok", live: true }
    : info?.linked
      ? { text: "Key set, server unreachable", tone: "warn" }
      : { text: "No ER:LC key", tone: "idle" };

  const copy = () => {
    if (!server?.joinCode) return;
    void navigator.clipboard?.writeText(server.joinCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 text-sm font-bold text-[#f5f2f2]">
          <StatusDot tone={state.tone} pulse={state.live} />
          {state.text}
        </span>
        {server ? (
          <span className="cool-text min-w-0 truncate text-[13px]">
            {server.name}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
          aria-label="Refresh ER:LC status"
        >
          <IconRefresh size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* The key is write-only, so this is the only way to see whether it works. */}
      {info && !info.linked ? (
        <p className="cool-text mt-3 text-[12px] leading-relaxed">
          Add your ER:LC server key below to link this server. It is stored on
          the bot and never shown here again.
        </p>
      ) : null}
      {info?.linked && !server ? (
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--tone-warn)]">
          A key is saved but ER:LC won’t answer for it. It has usually been
          rotated in the game&apos;s server settings, or the private server is
          offline. Re-enter it below.
        </p>
      ) : null}

      {server && !compact ? (
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={copy}
            className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-left transition-colors hover:border-[rgb(var(--accent-rgb)/0.3)]"
          >
            <p className="cool-text flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
              <span className="text-white/30">
                {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              </span>
              Join code
            </p>
            <p className="mt-1 truncate font-mono text-sm font-semibold text-[var(--accent-peach)]">
              {copied ? "Copied" : server.joinCode || "None"}
            </p>
          </button>
          <Stat
            icon={<IconUsers size={12} />}
            label="Players"
            value={
              server.players != null
                ? `${server.players} / ${server.maxPlayers ?? "?"}`
                : "Unknown"
            }
          />
          <Stat
            icon={<IconHourglass size={12} />}
            label="In queue"
            value={server.queue != null ? String(server.queue) : "Unknown"}
            tone={server.queue ? "warn" : undefined}
          />
          <Stat
            icon={<IconShieldCheck size={12} />}
            label="Verification"
            value={
              VERIFIED_LABELS[String(server.verifiedReq || "")] ||
              server.verifiedReq ||
              "Anyone can join"
            }
          />
          <Stat
            icon={<IconServer size={12} />}
            label="Team balance"
            value={server.teamBalance ? "On" : "Off"}
          />
          <Stat
            icon={<IconUsers size={12} />}
            label="Co-owners"
            value={String(server.coOwnerIds?.length ?? 0)}
          />
        </div>
      ) : null}
    </div>
  );
}
