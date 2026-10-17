"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PresenceList } from "@/components/motion";
import { IconArrowRight, IconPlus, IconTrash } from "@tabler/icons-react";
import { FieldRow, RolePicker, SettingsCard } from "../fields";
import { useManage } from "../manage-context";
import { ModuleGate } from "../module-gate";
import { SectionHeader } from "../section-header";
import type { ConnectionRole } from "../types";
import { EmptyState, SkeletonRows } from "../empty-state";

/* "Go back" goes to the module list, not `history.back()` (which could return
   to this same gate). */
export function ConnectionRolesSection({ onNavigate }: { onNavigate?: (next: string) => void } = {}) {
  const { guildId, meta, setNotice } = useManage();
  const [connections, setConnections] = useState<ConnectionRole[] | null>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [child, setChild] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roleName = useCallback(
    (id: string) =>
      meta?.roles.find((role) => role.id === String(id))?.name || `Role ${id}`,
    [meta]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/manage/${guildId}/connectionroles`);
      const json = res.ok ? await res.json() : { connections: [] };
      setConnections(json.connections || []);
    } catch {
      setConnections([]);
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/${guildId}/connectionroles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setConnections(json.connections || []);
      setNotice({ kind: "saved", text: "Connection roles updated" });
      setParent(null);
      setChild(null);
    } catch {
      setNotice({ kind: "error", text: "Could not update connection roles" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleGate moduleKey="connectionroles" moduleLabel="Connection Roles" onGoBack={() => onNavigate?.("modules")}>
    <div className="space-y-5">
      <SectionHeader
        title="Connection Roles"
      />


      <SettingsCard
        title="Add a connection"
        description="Pick the role that triggers the connection, then the role that gets granted."
      >
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto_1fr_auto]">
          <FieldRow label="When a member gets">
            <RolePicker
              roles={meta?.roles || []}
              value={parent}
              onChange={(next) => setParent(next as string | null)}
            />
          </FieldRow>
          <IconArrowRight size={18} className="mx-auto mb-3 hidden text-white/35 sm:block" />
          <FieldRow label="Also give them">
            <RolePicker
              roles={meta?.roles || []}
              value={child}
              onChange={(next) => setChild(next as string | null)}
            />
          </FieldRow>
          <button
            type="button"
            disabled={busy || !parent || !child || parent === child}
            onClick={() => mutate({ action: "add", parent, child })}
            className="btn-pop btn-peach mb-1 inline-flex h-10 items-center gap-2 px-4 text-sm disabled:opacity-50"
          >
            <IconPlus size={15} />
            Add
          </button>
        </div>
      </SettingsCard>

      {connections === null ? (
        <SkeletonRows rows={3} label="Loading connections…" />
      ) : connections.length === 0 ? (
        <EmptyState
          title="No connection roles yet"
          hint="Pair two roles and the first grants the second."
        />
      ) : (
        <PresenceList
          items={connections}
          keys={connections.map((connection) => `${connection.child}:${connection.parent}`)}
          className="space-y-2"
          render={(connection) => (
            <div className="gw-item gw-link-row">
              <p className="gw-link-pair">
                {/* Stored swapped by the bot: `child` holds the trigger role. */}
                <span className="gw-link-role">{roleName(connection.child)}</span>
                <IconArrowRight size={14} className="gw-link-arrow" aria-hidden="true" />
                <span className="gw-link-role" data-granted="true">
                  {roleName(connection.parent)}
                </span>
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  mutate({
                    action: "remove",
                    parent: connection.child,
                    child: connection.parent,
                  })
                }
                className="gw-remove"
                aria-label="Remove connection"
              >
                <IconTrash size={15} />
              </button>
            </div>
          )}
        />
      )}
    </div>
    </ModuleGate>
  );
}
