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

const FALLBACK: BotIdentity = { name: "Gator", avatar: "/gator-logo.png" };

type Entry = { saved: BotIdentity; live: BotIdentity | null; loading: boolean };
const store = new Map<string, Entry>();
const loaded = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function entryFor(guildId: string): Entry {
  let entry = store.get(guildId);
  if (!entry) {
    entry = { saved: FALLBACK, live: null, loading: false };
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

function load(guildId: string) {
  const entry = entryFor(guildId);
  if (entry.loading || loaded.has(guildId)) return;
  entry.loading = true;
  fetch(`/api/manage/${guildId}/botprofile`)
    .then((response) => (response.ok ? response.json() : null))
    .then((json) => {
      if (json?.profile) {
        entry.saved = identityFromProfile(json.profile);
        emit();
      }
    })
    .catch(() => {})
    .finally(() => {
      entry.loading = false;
      loaded.add(guildId);
    });
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
    if (guildId) load(guildId);
  }, [guildId]);
  return identity;
}
