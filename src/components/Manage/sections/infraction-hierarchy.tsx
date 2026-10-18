"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconStairsDown,
} from "@tabler/icons-react";
import {
  ChannelPicker,
  FieldRow,
  OptionCard,
  Reveal,
  RolePicker,
  SelectField,
  SettingsCard,
} from "../fields";
import { configValuesEqual, useManage } from "../manage-context";
import { SkeletonRows } from "../empty-state";
import { PresenceList } from "@/components/motion";

/**
 * What issuing an infraction type does to the member's rank. `Infraction.types`
 * is a list of names; what each type does lived in a separate collection
 * previously only reachable through the bot's /config. The ladder is configured
 * on the Promotions tab; this shows which rung a type drops someone to.
 */

export interface Rank {
  id: string;
  name: string;
  /**
   * Index in the configured order, lowest rank first, not Discord's role
   * position (which changes when roles are reordered for unrelated reasons).
   * The demotion walks this order.
   */
  position: number;
}

export interface Department {
  id: string;
  name: string;
  ranks: Rank[];
}

export interface InfractionType {
  name: string;
  /** Discord roles handed out when this type is issued. */
  given_roles: string[];
  /** Discord roles taken away. */
  removed_roles: string[];
  /** Whether to move them in the linked Roblox group as well. */
  change_group_role: boolean;
  /** The group rank to move them to — an API path, chosen from a picker. */
  group_role: string;
  /** Take them off the staff database entirely. */
  staff_database_removal: boolean;
  /** Announce this type somewhere other than the module's channel. */
  channel: string;
  demote: boolean;
  demote_department: string;
  demote_skip_to: string;
}

interface Loaded {
  types: InfractionType[];
  departments: Department[];
  hierarchy: Rank[];
  group_roles: { value: string; label: string }[];
  system: string;
}

/** The ranks a type's demotion walks, given which department it names. */
export function ranksFor(loaded: Loaded, type: InfractionType): Rank[] {
  const named = String(type.demote_department || "").trim();
  if (!named) return loaded.hierarchy;
  const match = loaded.departments.find(
    (department) =>
      String(department.id) === named ||
      department.name.toLowerCase() === named.toLowerCase(),
  );
  return match?.ranks || [];
}

/** Everything this type does, as a sentence, or a note that it does nothing. */
export function typeSummary(loaded: Loaded, type: InfractionType): {
  text: string;
  problem: boolean;
} {
  const parts: string[] = [];
  if (type.given_roles.length) {
    parts.push(`gives ${type.given_roles.length} role${type.given_roles.length > 1 ? "s" : ""}`);
  }
  if (type.removed_roles.length) {
    parts.push(`takes ${type.removed_roles.length} role${type.removed_roles.length > 1 ? "s" : ""}`);
  }
  if (type.change_group_role) {
    const named = loaded.group_roles.find((role) => role.value === type.group_role);
    parts.push(named ? `sets their group rank to ${named.label}` : "changes their group rank");
  }
  if (type.staff_database_removal) parts.push("removes them from the staff database");
  if (type.channel) parts.push("posts to its own channel");

  const demotion = demotionSummary(loaded, type);
  if (type.demote) parts.push(demotion.text.replace(/\.$/, "").toLowerCase());

  if (!parts.length) return { text: "Records the infraction and nothing else.", problem: false };
  const sentence = parts.join(", ");
  return {
    text: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`,
    problem: demotion.problem,
  };
}

/**
 * The demotion half. Three saveable configurations do nothing (a skip target no
 * longer in the ladder, a department with no ranks, no hierarchy at all), and
 * this says so; that is why the ranks are fetched.
 */
export function demotionSummary(loaded: Loaded, type: InfractionType): {
  text: string;
  problem: boolean;
} {
  if (!type.demote) {
    return { text: "Leaves the member's rank alone.", problem: false };
  }
  const ranks = ranksFor(loaded, type);
  const named = String(type.demote_department || "").trim();
  if (named && !ranks.length) {
    return {
      text: "No ranks found for that department, so this won’t demote anyone.",
      problem: true,
    };
  }
  if (!ranks.length) {
    return {
      text: "No rank hierarchy is configured yet, so this will not demote anybody.",
      problem: true,
    };
  }
  const skip = String(type.demote_skip_to || "").trim();
  if (!skip) {
    return { text: "Moves the member one rank down this ladder.", problem: false };
  }
  const target = ranks.find((rank) => rank.id === skip);
  if (!target) {
    return {
      text: "The chosen rank isn’t in this ladder any more, so this won’t demote anyone.",
      problem: true,
    };
  }
  return { text: `Moves the member straight to ${target.name}.`, problem: false };
}

/** The ladder, lowest at the bottom, with the target marked. */
function Ladder({ ranks, targetId }: { ranks: Rank[]; targetId: string }) {
  if (!ranks.length) return null;
  return (
    <ol className="gw-ladder" aria-label="Rank hierarchy, highest first">
      {[...ranks].reverse().map((rank) => {
        const target = rank.id === targetId;
        return (
          <li key={rank.id} className="gw-ladder-rung" data-target={target ? "true" : undefined}>
            <span className="gw-ladder-step">{String(rank.position + 1).padStart(2, "0")}</span>
            <span className="gw-ladder-name">{rank.name}</span>
            {target ? <span className="gw-ladder-flag">Demote to</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The picker reads an empty value as nothing chosen, and "the server's own
 *  ladder" and "one rank down" are choices, stored as empty. */
const SERVER_LADDER = "__server";
const ONE_DOWN = "__one-down";

function TypeRow({
  type,
  loaded,
  onChange,
}: {
  type: InfractionType;
  loaded: Loaded;
  onChange: (next: InfractionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ranks = ranksFor(loaded, type);
  const summary = typeSummary(loaded, type);
  const { meta } = useManage();
  const roles = meta?.roles || [];
  const channels = (meta?.channels || []).filter(
    (channel) => channel.type === "text" || channel.type === "announcement",
  );

  return (
    /* A disclosure: the whole head is the button, and the settings roll out on
       the settings-group curve. */
    <div className="gw-disclose" data-open={open ? "true" : "false"}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="gw-disclose-head"
        aria-expanded={open}
      >
        <span className="gw-disclose-copy">
          <span className="gw-disclose-name">{type.name}</span>
          <span
            className="gw-disclose-say"
            data-problem={summary.problem ? "true" : undefined}
          >
            {summary.problem ? <IconAlertTriangle size={12} aria-hidden="true" /> : null}
            {summary.text}
          </span>
        </span>
        <IconChevronDown size={16} stroke={2} className="gw-disclose-chev" aria-hidden="true" />
      </button>

      <div className="gw-set-roll" data-open={open ? "true" : "false"}>
        <div className="gw-set-roll-clip" inert={!open}>
          <div className="gw-disclose-body">
            {/* Roles the bot adds and removes the moment the infraction is
               issued. */}
            <div className="gw-disclose-fields">
            <FieldRow
              label="Give these roles"
              description="Added to the member when this type is issued."
            >
              <RolePicker
                roles={roles}
                multi
                value={type.given_roles}
                onChange={(next) =>
                  onChange({ ...type, given_roles: Array.isArray(next) ? next : [] })
                }
                placeholder="No roles"
              />
            </FieldRow>
            <FieldRow
              label="Take these roles"
              description="Removed from the member when this type is issued."
            >
              <RolePicker
                roles={roles}
                multi
                value={type.removed_roles}
                onChange={(next) =>
                  onChange({ ...type, removed_roles: Array.isArray(next) ? next : [] })
                }
                placeholder="No roles"
              />
            </FieldRow>
            <FieldRow
              label="Announce in"
              description="Where this type is posted, if not the module’s own channel."
            >
              <ChannelPicker
                channels={channels}
                value={type.channel || null}
                onChange={(next) => onChange({ ...type, channel: next ? String(next) : "" })}
                placeholder="The infraction channel"
              />
            </FieldRow>
            </div>

            <div className="gw-disclose-options">
              <OptionCard
                label="Change their Roblox group rank"
                description="Moves them in the linked group as well as in Discord."
                checked={type.change_group_role}
                onChange={(next) => onChange({ ...type, change_group_role: next })}
              />
              <OptionCard
                label="Remove from the staff database"
                description="Takes them off the roster entirely. Usually only for terminations."
                checked={type.staff_database_removal}
                onChange={(next) => onChange({ ...type, staff_database_removal: next })}
              />
              <OptionCard
                label="Demote"
                description="Move them down the rank ladder."
                checked={type.demote}
                onChange={(next) => onChange({ ...type, demote: next })}
              />
            </div>

            {/* The Roblox group: a picker when the group is linked and readable,
               an explanation when not (an empty menu looks broken). */}
            <Reveal when={type.change_group_role}>
              <div className="gw-disclose-more">
              <FieldRow label="Group rank" description="Where they are moved to in the Roblox group.">
                {loaded.group_roles.length ? (
                  <SelectField
                    value={type.group_role || null}
                    placeholder="Pick a group rank…"
                    options={loaded.group_roles.map((role) => ({
                      value: String(role.value),
                      label: role.label,
                    }))}
                    onChange={(next) => onChange({ ...type, group_role: next || "" })}
                  />
                ) : (
                  <p className="gw-disclose-warn">
                    No group ranks to choose from. Link a Roblox group in this
                    server’s settings and connect your own Roblox account with{" "}
                    <code>/integrations link</code>. The ranks are read with your
                    access, not the bot’s.
                  </p>
                )}
              </FieldRow>
              </div>
            </Reveal>

            <Reveal when={type.demote}>
              <div className="gw-disclose-more gw-disclose-demote">
                {loaded.departments.length ? (
                  <FieldRow label="Ladder" description="Which ladder they are moved down.">
                    <SelectField
                      value={type.demote_department || SERVER_LADDER}
                      options={[
                        { value: SERVER_LADDER, label: "Server hierarchy" },
                        ...loaded.departments.map((department) => ({
                          value: String(department.id),
                          label: department.name,
                        })),
                      ]}
                      // The skip target belongs to the chosen ladder, so
                      // changing ladders clears it.
                      onChange={(next) =>
                        onChange({
                          ...type,
                          demote_department: !next || next === SERVER_LADDER ? "" : next,
                          demote_skip_to: "",
                        })
                      }
                    />
                  </FieldRow>
                ) : null}

                <FieldRow label="Demote to" description="How far down they go.">
                  <SelectField
                    value={type.demote_skip_to || ONE_DOWN}
                    options={[
                      { value: ONE_DOWN, label: "One rank down" },
                      ...[...ranks].reverse().map((rank) => ({ value: rank.id, label: rank.name })),
                    ]}
                    onChange={(next) =>
                      onChange({ ...type, demote_skip_to: !next || next === ONE_DOWN ? "" : next })
                    }
                  />
                </FieldRow>

                {ranks.length ? (
                  <div className="gw-disclose-ladder">
                    <Ladder ranks={ranks} targetId={type.demote_skip_to || ""} />
                    <p className="gw-disclose-note">
                      A member on the lowest rung loses it and comes out of the
                      hierarchy, because there is nothing below it to move them to.
                    </p>
                  </div>
                ) : (
                  <p className="gw-disclose-warn">
                    No ranks are linked to Discord roles here yet. Set the hierarchy up
                    on the Promotions tab first.
                  </p>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InfractionHierarchyCard() {
  const { guildId, registerExternalDraft, setExternalDraftDirty } = useManage();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<InfractionType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const draftRef = useRef<InfractionType[] | null>(null);
  draftRef.current = draft;
  const savedRef = useRef<InfractionType[] | null>(null);
  savedRef.current = loaded?.types ?? null;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/manage/${guildId}/infraction-types`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(json?.types)) {
        throw new Error(
          json?.detail || json?.message || "Couldn't load infraction automations.",
        );
      }
      const next: Loaded = {
        // Defaulted field by field: a bot not restarted since these fields were
        // added returns the older shape.
        types: (json.types as InfractionType[]).map((type) => ({
          given_roles: [],
          removed_roles: [],
          change_group_role: false,
          group_role: "",
          staff_database_removal: false,
          channel: "",
          demote: false,
          demote_department: "",
          demote_skip_to: "",
          ...type,
        })),
        departments: Array.isArray(json.departments) ? json.departments : [],
        hierarchy: Array.isArray(json.hierarchy) ? json.hierarchy : [],
        group_roles: Array.isArray(json.group_roles) ? json.group_roles : [],
        system: String(json.system || "single"),
      };
      setLoaded(next);
      setDraft(next.types);
    } catch (caught) {
      setLoadError(
        caught instanceof Error ? caught.message : "Couldn't load infraction automations.",
      );
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () =>
      Boolean(loaded && draft) && !configValuesEqual(loaded?.types, draft),
    [loaded, draft],
  );

  // Saved through the dashboard's save prompt like every other tab.
  useEffect(() => {
    return registerExternalDraft("infraction-hierarchy", {
      save: async () => {
        const current = draftRef.current;
        if (!current) return true;
        const res = await fetch(`/api/manage/${guildId}/infraction-types`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ types: current }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.detail || json.message || "Save failed");
        savedRef.current = current;
        setLoaded((previous) => (previous ? { ...previous, types: current } : previous));
        return true;
      },
      discard: () => setDraft(savedRef.current),
      hasChanges: () => !configValuesEqual(draftRef.current, savedRef.current),
      label: "the infraction types",
    });
  }, [guildId, registerExternalDraft]);

  useEffect(() => {
    setExternalDraftDirty("infraction-hierarchy", dirty);
  }, [dirty, setExternalDraftDirty]);

  if (loadError) {
    return (
      <SettingsCard title="Rank hierarchy" description="What each infraction type does to the member's rank.">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--tone-warn)]">
            <IconAlertTriangle size={15} />
            {loadError}
          </p>
          <button type="button" onClick={() => load()} className="gw-retry">
            Try again
          </button>
        </div>
      </SettingsCard>
    );
  }

  if (!loaded || !draft) {
    return (
      <SettingsCard title="Rank hierarchy" description="What each infraction type does to the member's rank.">
        <SkeletonRows rows={3} lead={false} label="Loading rank hierarchy…" />
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Rank hierarchy"
      description="Whether issuing a type demotes the member, and how far."
    >
      {draft.length ? (
        <PresenceList
          items={draft}
          keys={draft.map((type) => type.name)}
          className="gw-disclose-list"
          render={(type, index) => (
            <TypeRow
              type={type}
              loaded={loaded}
              onChange={(next) =>
                setDraft((current) =>
                  (current || []).map((entry, position) =>
                    position === index ? next : entry,
                  ),
                )
              }
            />
          )}
        />
      ) : (
        <p className="gw-disclose-empty">
          <IconStairsDown size={15} aria-hidden="true" />
          Add some infraction types above and they will show up here.
        </p>
      )}
    </SettingsCard>
  );
}
