"use client";

import { useCallback, useEffect, useState } from "react";
import { discordAvatarUrl } from "@/utils/discord-avatar";
import {
  IconHistory,
  IconLoader2,
  IconRotateClockwise,
  IconX,
} from "@tabler/icons-react";
import { ConfirmModal, type ConfirmState } from "@/components/confirm-modal";
import { SkeletonRows } from "./empty-state";

export interface ResourceVersion {
  id: string;
  title: string;
  savedBy: string | null;
  savedByName: string | null;
  savedByAvatar: string | null;
  savedAt: string | null;
  characters: number;
  rows: number;
}

/** "3 minutes ago" style, falling back to a date once it stops being useful. */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Save history for a document or spreadsheet, with restore. Saves overwrite the
 * resource record, so this is the way back. Restoring snapshots the current
 * state first, so a restore can be undone.
 */
export function VersionHistory({
  guildId,
  resourceId,
  kind,
  onRestored,
}: {
  guildId: string;
  resourceId: string;
  kind: "document" | "spreadsheet";
  /** Called with the restored resource so the editor can reload its content. */
  onRestored: (resource: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<ResourceVersion[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = useCallback(() => {
    setVersions(null);
    setError(null);
    fetch(
      `/api/manage/${guildId}/resourceversions?resource=${encodeURIComponent(resourceId)}`,
      { cache: "no-store" },
    )
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((json) => setVersions(json.versions || []))
      .catch(() => setVersions([]));
  }, [guildId, resourceId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function restore(version: ResourceVersion) {
    setRestoring(version.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/manage/${guildId}/resourceversionrestore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource: resourceId, version: version.id }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.detail || json.message || "Could not restore");
      }
      onRestored(json.resource || {});
      load(); // the pre-restore snapshot is now the newest entry
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restore");
    } finally {
      setRestoring(null);
    }
  }

  return (
    // Anchored dropdown: the editor's top bar is a tight flex row, so the panel
    // floats over the page rather than pushing the toolbar around.
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Version history"
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
          open
            ? "border-[color-mix(in_srgb,var(--accent-peach)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent-peach)_10%,transparent)] text-[var(--accent-peach)]"
            : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white"
        }`}
      >
        <IconHistory size={13} />
        History
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/[0.08] bg-[var(--gator-surface,#0d0b0c)] shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-white/55">
              Version history
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close version history"
              className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <IconX size={13} />
            </button>
          </div>

          {error ? (
            <p className="border-b border-white/[0.08] px-4 py-3 text-xs font-semibold text-[var(--tone-bad)]">
              {error}
            </p>
          ) : null}

          {versions === null ? (
            <div className="p-3">
              <SkeletonRows rows={3} lead={false} label="Loading versions…" />
            </div>
          ) : versions.length === 0 ? (
            <p className="cool-text px-4 py-4 text-sm">
              No earlier versions yet. One is kept every time the content
              changes, so history starts building from your next save.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-white/[0.05] overflow-y-auto">
              {versions.map((version, index) => (
                <li
                  key={version.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {version.savedByAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={discordAvatarUrl(version.savedByAvatar) || ""}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-white/45">
                      {(version.savedByName || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#f5f2f2]">
                      {relativeTime(version.savedAt)}
                      {index === 0 ? (
                        <span className="ml-2 rounded-lg bg-white/[0.08] px-2 py-1 text-[10px] font-bold uppercase text-white/50">
                          Previous
                        </span>
                      ) : null}
                    </p>
                    <p className="cool-text truncate text-[11px]">
                      {version.savedByName || "Unknown editor"}
                      {" · "}
                      {kind === "spreadsheet"
                        ? `${version.rows} row${version.rows === 1 ? "" : "s"}`
                        : `${version.characters.toLocaleString()} characters`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(restoring)}
                    onClick={() =>
                      setConfirm({
                        title: "Restore this version",
                        body: `The current content is saved to history first, so you can undo this. Sharing and permissions are not affected.`,
                        confirmLabel: "Restore",
                        onConfirm: () => restore(version),
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-[11px] font-bold text-white/65 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
                  >
                    {restoring === version.id ? (
                      <IconLoader2 size={12} className="animate-spin" />
                    ) : (
                      <IconRotateClockwise size={12} />
                    )}
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
