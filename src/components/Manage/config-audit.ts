"use client";

/**
 * What is broken in this server's settings, across the whole config: the schema
 * says which fields are Discord ids, the config says what they point at, and
 * `meta` lists what Discord still has. Two kinds of finding, both facts:
 *
 * - gone: a setting points at a channel or role that no longer exists. That
 *   is broken, and is drawn in amber with a count ("to fix").
 * - unset: a module is on and the channel it posts to has not been picked
 *   yet. A module someone has just turned on is always like this, so it is
 *   the next step of setting it up rather than a fault, and is drawn as one
 *   (pink, "Set up", no warning).
 *
 * No suggestions: a list you are meant to act on stops working once it fills
 * with things you are not.
 */

import { CORE_SECTIONS, MODULE_SECTIONS, fieldAt, type FieldDef } from "./schema";
import { fieldProblem } from "./config-health";
import { isModuleEnabled } from "./module-status";
import type { GuildMeta } from "./types";

export interface AuditItem {
  /** Tab this lives on, for the jump. */
  section: string;
  sectionLabel: string;
  /** The field's own name. */
  label: string;
  /** Four or five words: "Deleted channel", "Nothing set". */
  tag: string;
  kind: "gone" | "unset";
}

/** Fields a module genuinely cannot run without: it has nowhere to send. */
function required(field: FieldDef): boolean {
  if (field.type !== "channel") return false;
  const name = field.label.toLowerCase();
  return (
    name.includes("channel") &&
    (name.includes("log") || name.includes("post") || name.includes("send"))
  );
}

/** The findings split by kind, per tab: what is broken and what is waiting
 *  to be set up. */
export function auditByTab(items: AuditItem[]) {
  const tabs: Record<string, { gone: number; unset: number }> = {};
  for (const item of items) {
    const tab = (tabs[item.section] ??= { gone: 0, unset: 0 });
    tab[item.kind] += 1;
  }
  return tabs;
}

export function auditConfig(
  value: (path: string) => any,
  meta: GuildMeta | null,
): AuditItem[] {
  // No lists, no answer. Flagging every field on every tab while the page is
  // still loading is worse than flagging none.
  if (!meta?.channels?.length && !meta?.roles?.length) return [];

  const found: AuditItem[] = [];
  for (const section of [...CORE_SECTIONS, ...MODULE_SECTIONS]) {
    if (section.moduleKey && !isModuleEnabled(value, section.moduleKey)) continue;
    for (const group of section.groups) {
      // A group behind a switch that is off is not running, so nothing in it
      // is broken yet.
      if (group.gatedBy && !value(group.gatedBy)) continue;
      // Likewise a group whose first switch turns the rest on, and a setting
      // under a switch that is off: not in use, so not broken.
      const on = (path: string) => Boolean(value(path) ?? fieldAt(path)?.defaultValue ?? false);
      const lead =
        group.lead === true && group.fields[0]?.type === "toggle" && group.fields.length > 1
          ? group.fields[0].path
          : null;
      for (const field of group.fields) {
        if (lead && field.path !== lead && !on(lead)) continue;
        if (field.requires && !on(field.requires)) continue;
        const current = value(field.path);
        const problem = fieldProblem(field.type, current, meta);
        if (problem) {
          found.push({
            section: section.id,
            sectionLabel: section.label,
            label: field.label,
            tag: problem.tag,
            kind: "gone",
          });
          continue;
        }
        if (required(field) && (current == null || current === "")) {
          found.push({
            section: section.id,
            sectionLabel: section.label,
            label: field.label,
            tag: "Pick a channel",
            kind: "unset",
          });
        }
      }
    }
  }
  return found;
}
