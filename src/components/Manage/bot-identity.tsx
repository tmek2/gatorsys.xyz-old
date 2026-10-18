"use client";

import React from "react";

/**
 * Who a preview says sent the message: the bot's nickname and avatar in this
 * server (from Customization), read once per server and shared by every
 * preview. Customization writes to it while editing, before saving, so every
 * preview updates as you type; leaving without saving restores the saved
 * profile.
 */

export interface BotIdentity {
  name: string;
  avatar: string;
}

const FALLBACK: BotIdentity = { name: "Bot", avatar: "/icon.svg" };

const RETRY_COOLDOWN_MS = 30_000;

type Entry = {
  saved: BotIdentity;
  live: BotIdentity | null;
  loading: boolean;
  loaded: boolean;
  retryAfter: number;
};
const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function entryFor(guildId: string): Entry {
  let entry = store.get(guildId);
  if (!entry) {
    entry = { saved: FALLBACK, live: null, loading: false, loaded: false, retryAfter: 0 };
    store.set(guildId, entry);
  }
  return entry;
}

/** The profile as the bot API returns it, reduced to what a message shows. */
export function identityFromProfile(profile: {
  display_name?: string | null;
  global_name?: string | null;
  avatar?: string | null;
} | null | undefined): BotIdentity {
  return {
    name: profile?.display_name || profile?.global_name || FALLBACK.name,
    avatar: profile?.avatar || FALLBACK.avatar,
  };
}

async function load(guildId: string, force = false) {
  const entry = entryFor(guildId);
  if (entry.loading || (!force && (entry.loaded || Date.now() < entry.retryAfter))) return;
  entry.loading = true;
  try {
    const response = await fetch(`/api/manage/${guildId}/botprofile`);
    if (!response.ok) throw new Error("Profile unavailable");
    const json = await response.json();
    if (!json?.profile || typeof json.profile !== "object" || Array.isArray(json.profile)) {
      throw new Error("Profile unavailable");
    }
    entry.saved = identityFromProfile(json.profile);
    entry.loaded = true;
    entry.retryAfter = 0;
    emit();
  } catch {
    // Refocusing or reopening a preview can retry without hammering an outage.
    entry.retryAfter = Date.now() + RETRY_COOLDOWN_MS;
  } finally {
    entry.loading = false;
  }
}

/** Explicit refresh after a profile changes outside the current editor. */
export function refreshBotIdentity(guildId: string) {
  return load(guildId, true);
}

/** Customization's draft, shown everywhere until it is saved or dropped. */
export function publishBotIdentity(guildId: string, live: BotIdentity | null) {
  const entry = entryFor(guildId);
  entry.live = live;
  emit();
}

/** The saved profile, after a save. */
export function settleBotIdentity(guildId: string, saved: BotIdentity) {
  const entry = entryFor(guildId);
  entry.saved = saved;
  entry.live = null;
  entry.loaded = true;
  entry.retryAfter = 0;
  emit();
}

export function useBotIdentity(guildId: string | undefined): BotIdentity {
  const subscribe = React.useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  const read = React.useCallback(() => {
    if (!guildId) return FALLBACK;
    const entry = entryFor(guildId);
    return entry.live ?? entry.saved;
  }, [guildId]);
  const identity = React.useSyncExternalStore(subscribe, read, () => FALLBACK);
  React.useEffect(() => {
    if (!guildId) return;
    const retry = () => { void load(guildId); };
    retry();
    window.addEventListener("focus", retry);
    return () => window.removeEventListener("focus", retry);
  }, [guildId]);
  return identity;
}
