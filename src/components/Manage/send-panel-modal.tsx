"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconSend, IconX } from "@tabler/icons-react";
import { useManage } from "./manage-context";

/**
 * Posts a ticket panel to a channel. The channel is chosen here, not stored on
 * the panel: sending is an action, and the same panel can be posted again or
 * elsewhere without editing.
 */
export function SendPanelModal({
  open,
  panelName,
  panelType = "single",
  onClose,
}: {
  open: boolean;
  panelName: string;
  panelType?: "single" | "multi";
  onClose: () => void;
}) {
  const { guildId, meta, setNotice } = useManage();
  const [channelId, setChannelId] = useState("");
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setChannelId("");
      setQuery("");
      setError(null);
    }
  }, [open]);

  const channels = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (meta?.channels || [])
      .filter((channel: any) => channel.type === "text" || channel.type === 0)
      .filter((channel: any) => !term || String(channel.name).toLowerCase().includes(term))
      .slice(0, 200);
  }, [meta?.channels, query]);

  async function send() {
    if (!channelId) {
      setError("Pick a channel first.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/manage/${guildId}/ticketpanelsend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: panelName, type: panelType, channel: channelId }),
      });
      const json = await res.json().catch(() => ({}));
      // The bot reports the real reason — a missing permission in that specific
      // channel is the common one, and "failed" would send someone hunting.
      if (!res.ok) throw new Error(json.detail || json.message || "Couldn't send the panel");
      setNotice?.({
        kind: "saved",
        text: `Panel sent to #${json.channel?.name || "channel"}.`,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't send the panel");
    } finally {
      setSending(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="gator-overlay fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--gator-border-strong)] bg-[var(--gator-surface)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-[var(--gator-text)]">
              Send panel
            </h3>
            <p className="cool-text mt-1 text-[13px] leading-relaxed">
              Posts <strong>{panelName}</strong> with its button. You can send it
              again later, or to another channel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="gator-press shrink-0 rounded-xl p-2 text-white/40 hover:text-white"
          >
            <IconX size={16} />
          </button>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search channels…"
          className="gw-field w-full"
        />

        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {channels.length === 0 ? (
            <p className="cool-text px-1 py-3 text-sm">No channels match.</p>
          ) : (
            channels.map((channel: any) => (
              <button
                key={channel.id}
                type="button"
                data-compact
                onClick={() => setChannelId(String(channel.id))}
                className={`gator-press flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold ${
                  channelId === String(channel.id)
                    ? "border-[color-mix(in_srgb,var(--gator-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--gator-accent)_12%,transparent)] text-[var(--gator-accent)]"
                    : "border-transparent text-[var(--gator-text)]/70 hover:bg-white/[0.04]"
                }`}
              >
                #{channel.name}
              </button>
            ))
          )}
        </div>

        {error ? (
          <p className="mt-3 text-xs font-semibold text-[var(--tone-bad)]">{error}</p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="gator-control gator-press rounded-xl px-3 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !channelId}
            className="btn-pop btn-peach gator-press inline-flex h-9 items-center gap-2 px-4 text-sm disabled:opacity-45"
          >
            <IconSend size={15} />
            {sending ? "Sending…" : "Send panel"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
