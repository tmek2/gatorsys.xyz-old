import { createPreviewState } from "./seed";
import type { PreviewState } from "./types";

const MAX_VISITORS = 100;
const MAX_AGE = 12 * 60 * 60 * 1000;
type Entry = { touched: number; state: PreviewState };
const shared = globalThis as typeof globalThis & { dashboardPreviewVisitors?: Map<string, Entry> };
const visitors = shared.dashboardPreviewVisitors ??= new Map<string, Entry>();

/** Every visitor owns a separate dataset. This demonstration uses memory only;
 * restarting the server or a twelve-hour idle session resets it. */
export function getPreviewState(visitorId: string): PreviewState {
  const now = Date.now();
  for (const [id, entry] of visitors) if (now - entry.touched > MAX_AGE) visitors.delete(id);
  const existing = visitors.get(visitorId);
  if (existing) {
    existing.touched = now;
    return existing.state;
  }
  if (visitors.size >= MAX_VISITORS) {
    const oldest = [...visitors].sort((a, b) => a[1].touched - b[1].touched)[0];
    if (oldest) visitors.delete(oldest[0]);
  }
  const state = createPreviewState();
  visitors.set(visitorId, { touched: now, state });
  return state;
}

export function resetPreviewState(visitorId: string) {
  visitors.delete(visitorId);
  return getPreviewState(visitorId);
}
