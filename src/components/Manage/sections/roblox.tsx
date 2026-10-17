"use client";

import React from "react";
import { IconBox, IconLock, IconShieldCheck } from "@tabler/icons-react";
import { FieldRow, Reveal, RolePicker, SettingsCard, TextField } from "../fields";
import { useManage } from "../manage-context";
import { SectionHeader } from "../section-header";
import { OptionTile } from "../schema-section";
import { VERIFICATION_FIELDS } from "../schema";

const [GRANT, REMOVE, RENAME, FORMAT] = VERIFICATION_FIELDS;
const ids = (raw: unknown): string[] => (Array.isArray(raw) ? raw.map(String) : []);

/**
 * Roblox group linking. Verification proves group ownership through the linked
 * Roblox account, so that step stays in Discord (/config → Integrations →
 * Roblox Groups); the dashboard shows the live state.
 */
export function RobloxSection() {
  const { value, stage, meta } = useManage();
  const renaming = Boolean(value(RENAME.path) ?? RENAME.defaultValue);
  const groups = value("groups");
  const entries: { id: string; name?: string }[] = [];
  if (groups && typeof groups === "object") {
    for (const [key, data] of Object.entries(groups as Record<string, any>)) {
      if (data && typeof data === "object") {
        entries.push({ id: String(data.id ?? key), name: data.name });
      } else {
        entries.push({ id: String(data ?? key) });
      }
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Roblox"
      />
      {/* What verifying a member does in Discord, above the group list. */}
      <SettingsCard
        title="When someone verifies"
        description="Roles to move and whether to rename them. All optional. Nothing happens until you set it."
      >
        {/* Drawn here rather than as schema rows (rows add their own inset,
           which inside an inset card would not line up with the heading). The
           rename format is shown only while renaming is on; the bot ignores it
           otherwise. */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[GRANT, REMOVE].map((field) => (
              <FieldRow key={field.path} label={field.label} description={field.description}>
                <RolePicker
                  roles={meta?.roles || []}
                  multi
                  value={ids(value(field.path))}
                  onChange={(next) => stage(field.path, next)}
                  placeholder="Select roles"
                />
              </FieldRow>
            ))}
          </div>
          <div>
            <OptionTile
              path={RENAME.path}
              label={RENAME.label}
              description={RENAME.description}
              defaultValue={RENAME.defaultValue}
              wide
            />
            <Reveal when={renaming}>
              <div className="pt-4">
                <FieldRow label={FORMAT.label} description={FORMAT.description}>
                  <TextField
                    value={String(value(FORMAT.path) ?? FORMAT.defaultValue ?? "")}
                    maxLength={32}
                    placeholder="{roblox}"
                    onChange={(next) => stage(FORMAT.path, next, FORMAT.defaultValue)}
                  />
                </FieldRow>
              </div>
            </Reveal>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Linked groups"
        description="Groups verified as owned by a linked Roblox account."
      >
        {entries.length === 0 ? (
          <p className="cool-text text-sm">No Roblox group linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-4 py-3"
              >
                <IconBox size={18} className="text-white/50" />
                <span className="text-sm font-semibold text-[#f5f2f2]">
                  {entry.name || `Group ${entry.id}`}
                </span>
                <span className="cool-text text-xs">ID {entry.id}</span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-xl bg-[var(--tone-ok-soft)] px-2 py-1 text-[11px] font-bold text-[var(--tone-ok)]">
                  <IconShieldCheck size={12} />
                  Verified
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <IconLock size={15} className="mt-1 shrink-0 text-[var(--accent-peach)]" />
          <p className="cool-text text-[13px] leading-relaxed">
            Linking a new group requires proving ownership through your linked
            Roblox account, so verification happens in Discord under the
            bot's Integrations settings. Once verified, the group shows up
            here automatically.
          </p>
        </div>
      </SettingsCard>
    </div>
  );
}
