"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconChevronRight,
  IconDoorExit,
  IconLink,
  IconRefresh,
  IconSearch,
  IconServer,
  IconShieldOff,
  IconShieldCheck,
  IconTerminal2,
} from "@tabler/icons-react";
import {
  RippleButton,
  RippleButtonRipples,
} from "@/components/site/ripple-button";
import { ConfirmModal, type ConfirmState } from "@/components/confirm-modal";
import { OwnerContext } from "@/components/owner-context";
import { Segments } from "@/components/Manage/segments";
import { copyToClipboard } from "@/utils/copy-to-clipboard";

interface OwnerServer {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number | null;
  ownerId: string | null;
  modules: string[];
  moduleCount: number;
  addedBy: string | null;
  addedByName: string | null;
  addedAt: string | null;
  blacklisted: boolean;
}

interface OwnerData {
  botName: string | null;
  guildCount: number;
  servers: OwnerServer[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function OwnerPanel() {
  const [data, setData] = useState<OwnerData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /* A set, so several servers can be open at once for comparison. */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [tab, setTab] = useState<"servers" | "context">("servers");

  async function load() {
    setStatus("loading");
    try {
      const res = await fetch("/api/owner", { cache: "no-store" });
      if (res.status === 403) {
        setStatus("forbidden");
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function runAction(action: string, server?: OwnerServer) {
    setBusyId(server?.id || action);
    setNotice(null);
    try {
      const res = await fetch("/api/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, guild_id: server?.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.detail || json?.message || "Action failed");
      if (action === "invite") {
        if (json.invite) {
          // The bot echoes which guild the invite was made for; if it is not
          // the clicked row, report the mismatch instead of copying another
          // server's invite.
          const madeFor = json.guildId ? String(json.guildId) : null;
          if (server && madeFor && madeFor !== server.id) {
            setNotice(
              `The bot returned an invite for ${json.guildName || madeFor}, not ${server.name}. Nothing was copied. Reload and try again.`,
            );
            return;
          }
          const copied = await copyToClipboard(json.invite);
          setNotice(
            copied
              ? `Invite for ${json.guildName || server?.name} copied: ${json.invite}`
              : `Invite for ${json.guildName || server?.name}: ${json.invite}. Your browser blocked the copy, so copy it from here.`,
          );
        }
      } else if (action === "sync") {
        setNotice(`Synced ${json.synced ?? 0} commands${server ? ` to ${server.name}` : " globally"}.`);
      } else if (action === "leave") {
        setNotice(`Left ${server?.name}.`);
        await load();
      } else {
        setNotice(
          action === "blacklist"
            ? `Blacklisted ${server?.name}'s owner.`
            : `Removed ${server?.name}'s owner from the blacklist.`
        );
        await load();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function act(action: string, server?: OwnerServer) {
    if (action === "leave" && server) {
      setConfirm({
        title: `Leave ${server.name}?`,
        body: `The bot will be removed from this server and stop responding there. You can add it back later with a fresh invite.`,
        confirmLabel: "Leave server",
        danger: true,
        onConfirm: () => runAction("leave", server),
      });
      return;
    }
    runAction(action, server);
  }

  const servers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.servers || []).filter(
      (server) =>
        !term ||
        server.name.toLowerCase().includes(term) ||
        server.id.includes(term) ||
        (server.ownerId || "").includes(term)
    );
  }, [data, query]);

  if (status === "forbidden") {
    return (
      <div className="owner-wrap">
        <div className="owner-gate">
          <IconShieldOff size={40} stroke={1.6} />
          <h1>Owners only</h1>
          <p>
            This panel is restricted to the bot owners configured in the
            environment.
          </p>
          <RippleButton as={Link} href="/servers">
            Back to dashboard
            <RippleButtonRipples />
          </RippleButton>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-wrap">
      <div className="owner-head">
        <div>
          <h1 className="owner-title">Manage Bot</h1>
          <p className="owner-say">
            {data
              ? `${data.botName || "The bot"} is in ${data.guildCount} server${data.guildCount === 1 ? "" : "s"}.`
              : "Owner control panel."}
          </p>
        </div>
        {/* On a phone these two sat in a fixed row and pushed past the edge of
            the screen. They share the width instead, at a real tap height. */}
        <div className="owner-head-actions">
          <RippleButton
            onClick={() => act("sync")}
            disabled={busyId === "sync"}
            variant="outline"
          >
            <IconTerminal2 size={15} />
            {busyId === "sync" ? "Syncing…" : "Sync commands"}
            <RippleButtonRipples />
          </RippleButton>
          <RippleButton onClick={load} variant="outline">
            <IconRefresh size={15} />
            Refresh
            <RippleButtonRipples />
          </RippleButton>
        </div>
      </div>

      {notice ? (
        <p className="owner-notice">{notice}</p>
      ) : null}

      {/* Two jobs, two tabs: the servers the bot is in, and what its AI should
          be telling all of them right now. */}
      <Segments<"servers" | "context">
        className="owner-segs"
        label="Owner views"
        value={tab}
        options={[
          { value: "servers", label: "Servers", count: data?.guildCount },
          { value: "context", label: "AI context" },
        ]}
        onChange={setTab}
      />

      {/* Keyed by view, so each one arrives from the side of its tab. */}
      <div key={tab} className="owner-view" data-from={tab === "context" ? "right" : "left"}>
      {tab === "context" ? <OwnerContext /> : null}

      <label className={tab === "servers" ? "owner-search" : "hidden"}>
        <IconSearch size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by server name, server ID, or owner ID"
          aria-label="Search servers"
        />
      </label>

      {tab !== "servers" ? null : status === "loading" ? (
        <div className="owner-list">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="owner-skeleton" />
          ))}
        </div>
      ) : status === "error" ? (
        <p className="owner-empty">Couldn&apos;t reach the bot.</p>
      ) : (
        <div className="owner-list">
          {servers.map((server) => {
            const open = expanded.has(server.id);
            return (
              <article className="owner-card" key={server.id} data-open={open ? "true" : undefined}>
                {/* The whole row is the control that opens the server. */}
                <button
                  type="button"
                  className="owner-row"
                  aria-expanded={open}
                  aria-controls={`owner-body-${server.id}`}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (!next.delete(server.id)) next.add(server.id);
                      return next;
                    })
                  }
                >
                  {server.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={server.icon} alt="" className="owner-icon" />
                  ) : (
                    <span className="owner-icon">
                      <IconServer size={18} />
                    </span>
                  )}
                  <span className="owner-row-text">
                    <span className="owner-name">
                      <span>{server.name}</span>
                      {server.blacklisted ? <span className="owner-flag">Blacklisted</span> : null}
                    </span>
                    <span className="owner-meta">
                      {server.memberCount?.toLocaleString() ?? "?"} members · {server.moduleCount}{" "}
                      {server.moduleCount === 1 ? "module" : "modules"} · added {formatDate(server.addedAt)}
                      {server.addedByName ? ` by ${server.addedByName}` : ""}
                    </span>
                  </span>
                  <IconChevronRight size={17} className="owner-caret" aria-hidden="true" />
                </button>

                {/* A grid row from 0fr to 1fr animates to an unmeasured height;
                   the card is in normal flow, so opening one pushes the ones
                   below down. */}
                {/* `inert` rather than `hidden`: the panel stays in layout for
                   the height animation, and a clipped but tabbable panel would
                   be an invisible keyboard trap. */}
                <div
                  className="owner-body"
                  id={`owner-body-${server.id}`}
                  role="region"
                  aria-label={server.name}
                  inert={!open}
                >
                  <div>
                    <div className="owner-body-inner">
                      <div className="owner-facts">
                        <div>
                          <p className="owner-fact-cap">Members</p>
                          <p className="owner-fact-val">
                            {server.memberCount?.toLocaleString() ?? "Unknown"}
                          </p>
                        </div>
                        <div>
                          <p className="owner-fact-cap">Added</p>
                          <p className="owner-fact-val">
                            {formatDate(server.addedAt)}
                            {server.addedByName ? ` by ${server.addedByName}` : ""}
                          </p>
                        </div>
                        <div>
                          <p className="owner-fact-cap">Server ID</p>
                          <p className="owner-fact-val owner-id">{server.id}</p>
                        </div>
                        <div>
                          <p className="owner-fact-cap">Owner ID</p>
                          <p className="owner-fact-val owner-id">{server.ownerId || "Unknown"}</p>
                        </div>
                        {server.addedBy ? (
                          <div>
                            <p className="owner-fact-cap">Added by ID</p>
                            <p className="owner-fact-val owner-id">{server.addedBy}</p>
                          </div>
                        ) : null}
                      </div>

                      <p className="owner-mods-cap">
                        {server.moduleCount} {server.moduleCount === 1 ? "module" : "modules"} enabled
                      </p>
                      {server.modules.length === 0 ? (
                        <p className="owner-mods-none">No modules enabled.</p>
                      ) : (
                        <div className="owner-mods">
                          {server.modules.map((module) => (
                            <span className="owner-mod" key={module}>
                              {module}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Four actions, in words. */}
                      <div className="owner-acts">
                        <RippleButton
                          disabled={busyId === server.id}
                          onClick={() => act("invite", server)}
                          variant="outline"
                          size="sm"
                        >
                          <IconLink size={15} />
                          Copy invite
                          <RippleButtonRipples />
                        </RippleButton>
                        <RippleButton
                          disabled={busyId === server.id}
                          onClick={() => act("sync", server)}
                          variant="outline"
                          size="sm"
                        >
                          <IconTerminal2 size={15} />
                          Sync commands
                          <RippleButtonRipples />
                        </RippleButton>
                        <RippleButton
                          disabled={busyId === server.id}
                          onClick={() => act(server.blacklisted ? "unblacklist" : "blacklist", server)}
                          aria-pressed={server.blacklisted}
                          variant="outline"
                          size="sm"
                          className={server.blacklisted ? "owner-on" : undefined}
                        >
                          {server.blacklisted ? <IconShieldCheck size={15} /> : <IconShieldOff size={15} />}
                          {server.blacklisted ? "Unblacklist owner" : "Blacklist owner"}
                          <RippleButtonRipples />
                        </RippleButton>
                        <RippleButton
                          disabled={busyId === server.id}
                          onClick={() => act("leave", server)}
                          variant="outline"
                          size="sm"
                          className="owner-bad"
                        >
                          <IconDoorExit size={15} />
                          Leave server
                          <RippleButtonRipples />
                        </RippleButton>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {servers.length === 0 ? (
            <p className="owner-empty">No servers match “{query}”.</p>
          ) : null}
        </div>
      )}
      </div>
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
