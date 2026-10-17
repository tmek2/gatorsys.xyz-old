export function readPinned(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (id): id is string => typeof id === "string" && /^\d+$/.test(id),
            ),
          ),
        ].slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
export function togglePinned(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((item) => item !== id)
    : [...ids, id].slice(-50);
}
