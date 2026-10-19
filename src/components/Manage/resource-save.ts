type Resource = Record<string, any>;

// These fields describe a server save, rather than a change made in the editor.
const SAVE_METADATA = new Set([
  "created_at", "createdAt", "updated_at", "updatedAt", "saved_at", "savedAt",
  "saved_by", "savedBy", "saved_by_name", "savedByName", "updated_by", "updatedBy",
  "presence", "presences", "collaborators",
]);

export function resourceDraftFingerprint(resource: Resource): string {
  return JSON.stringify(Object.fromEntries(
    Object.keys(resource).filter((key) => !SAVE_METADATA.has(key)).sort().map((key) => [key, resource[key]]),
  ));
}

/** Apply an acknowledgement only to fields that have not changed since send. */
export function mergeSavedResource<T extends Resource>(current: T | null, submitted: Resource, saved: Resource): T | null {
  if (!current || String(current.id) !== String(submitted.id) || String(saved.id) !== String(submitted.id)) return current;
  const next: Resource = { ...current };
  for (const [key, value] of Object.entries(saved)) {
    if (JSON.stringify(current[key]) === JSON.stringify(submitted[key])) next[key] = value;
  }
  return next as T;
}
