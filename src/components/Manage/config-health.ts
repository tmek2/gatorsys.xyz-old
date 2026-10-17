import type { ManagedChannel, ManagedRole } from "./types";

/**
 * A setting that points at something Discord no longer has (a deleted log
 * channel silently stops logging). The dashboard can tell: `meta.channels` and
 * `meta.roles` are the live lists, and a stored id missing from them cannot
 * resolve. Shown on the card holding the field rather than on a page of its
 * own.
 */

export interface ConfigProblem {
  /** Short enough to sit in a badge: "Deleted channel", "2 deleted roles". */
  tag: string;
  /** The full sentence, for a tooltip. */
  detail: string;
}

/** Ids that resolve, as a set, for a cheap lookup per field. */
export function idSet(items: { id: string }[] | undefined): Set<string> {
  return new Set((items || []).map((item) => String(item.id)));
}

function missing(value: unknown, known: Set<string>): string[] {
  const ids = (Array.isArray(value) ? value : [value])
    .filter((item) => item != null && item !== "")
    .map(String);
  return ids.filter((id) => /^\d+$/.test(id) && !known.has(id));
}

/**
 * What is wrong with this field's value, if anything. Only for field types
 * whose value is a Discord id, and only once the live lists have loaded (an
 * empty `meta` means still loading).
 */
export function fieldProblem(
  type: string,
  value: unknown,
  meta: { channels?: ManagedChannel[]; roles?: ManagedRole[] } | null | undefined,
): ConfigProblem | null {
  const channels = meta?.channels;
  const roles = meta?.roles;

  if ((type === "channel" || type === "channels") && channels?.length) {
    const gone = missing(value, idSet(channels));
    if (!gone.length) return null;
    const one = gone.length === 1;
    return {
      tag: one ? "Deleted channel" : `${gone.length} deleted channels`,
      detail: one
        ? `This points at a channel that no longer exists (${gone[0]}). Anything the bot would send here goes nowhere.`
        : `${gone.length} of the selected channels no longer exist. Anything the bot would send to them goes nowhere.`,
    };
  }

  if ((type === "role" || type === "roles" || type === "ladder") && roles?.length) {
    const gone = missing(value, idSet(roles));
    if (!gone.length) return null;
    const one = gone.length === 1;
    return {
      tag: one ? "Deleted role" : `${gone.length} deleted roles`,
      detail: one
        ? `This points at a role that no longer exists (${gone[0]}). Nobody can hold it, so any check against it always fails.`
        : `${gone.length} of the selected roles no longer exist. Nobody can hold them, so any check against them always fails.`,
    };
  }

  return null;
}
