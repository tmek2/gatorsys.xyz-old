type PendingDraft = Record<string, unknown>;

/** Keep removals separate: JSON drops object properties whose value is undefined. */
export function serializeDraft(pending: PendingDraft): string {
  const set: PendingDraft = Object.create(null);
  const unset: string[] = [];
  for (const [path, value] of Object.entries(pending)) {
    if (value === undefined) unset.push(path);
    else set[path] = value;
  }
  return JSON.stringify({ format: "settings-draft-v1", set, unset });
}

export function parseDraft(serialized: string): PendingDraft {
  const parsed: unknown = JSON.parse(serialized);
  if (!isRecord(parsed)) return {};
  // Drafts written before the versioned format are plain path/value objects.
  if (parsed.format !== "settings-draft-v1") return parsed;
  if (!isRecord(parsed.set) || !Array.isArray(parsed.unset)) return {};
  const entries: [string, unknown][] = Object.entries(parsed.set);
  for (const path of parsed.unset) {
    if (typeof path === "string") entries.push([path, undefined]);
  }
  return Object.fromEntries(entries);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
