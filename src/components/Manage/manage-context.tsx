"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GuildConfig, GuildMeta } from "./types";
import { toast } from "sonner";
import { cachedJson, invalidateCache, isFresh } from "@/utils/client-cache";
import { fieldAt } from "./schema";
import { configValuesEqual, matchesSaved } from "./config-compare";

// Imported from here by every editor that keeps its own draft.
export { configValuesEqual };

function removeSavedPending(
  pending: Record<string, any>,
  config: GuildConfig | null,
) {
  return Object.fromEntries(
    Object.entries(pending).filter(
      ([path, staged]) => !matchesSaved(staged, getPath(config, path), fieldAt(path)),
    ),
  );
}

/** Read a dot-path (`"Infraction.Approval.channel"`) from a config document. */
export function getPath(source: GuildConfig | null, path: string): any {
  if (!source) return undefined;
  let node: any = source;
  for (const key of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[key];
  }
  return node;
}

/** The same document with one dot-path replaced, and nothing else touched.
 *  `undefined` removes the key, which is what a staged removal means. */
function withPath(source: GuildConfig | null, path: string, next: any): GuildConfig {
  const root: any = source ? { ...source } : {};
  const keys = path.split(".");
  let node = root;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const child = node[key];
    node[key] = child && typeof child === "object" && !Array.isArray(child) ? { ...child } : {};
    node = node[key];
  }
  const last = keys[keys.length - 1];
  if (next === undefined) delete node[last];
  else node[last] = next;
  return root;
}

/**
 * How long a dashboard load may take before it counts as failed. Generous,
 * since a cold read of a large config takes seconds; it only rules out waiting
 * forever.
 */
const LOAD_TIMEOUT_MS = 30000;

/**
 * Cooldown between meta refreshes: each calls the bot and Discord, and the
 * lists only change when someone creates a channel or role.
 */
const META_REFRESH_COOLDOWN_MS = 30000;

/** A toast, and optionally the one thing it lets you do about itself. */
export type ToastInput = {
  kind: "saved" | "error";
  text: string;
  /** "Undo", usually. A toast that reports a change you can reverse should
   *  let you reverse it from where it told you. */
  action?: { label: string; run: () => void };
  /** A toast with an id replaces the last one with the same id, rather than
   *  stacking another on it: ten presses of ⌘Z are one toast. */
  id?: string;
};

interface ManageContextValue {
  guildId: string;
  meta: GuildMeta | null;
  config: GuildConfig | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  /** Retry the initial load in place, without reloading the route. */
  reload: () => void;
  /** Re-read the server's channels, roles and members — the lists every picker
   *  draws from — without touching the page or the draft. */
  refreshMeta: () => Promise<void>;
  /** True while that refetch is in flight. */
  refreshingMeta: boolean;
  /** Seconds until `refreshMeta` will do anything again; 0 when it is ready. */
  metaCooldown: number;
  /** Staged (unsaved) dot-path edits layered over the saved config. */
  pending: Record<string, any>;
  /** Value at path including staged edits. */
  value: (path: string) => any;
  /** Stage an edit. Pass `undefined` to stage a field removal. */
  /** `shown`: what the page displays here when nothing is saved. */
  stage: (path: string, value: any, shown?: unknown) => void;
  /** Put one staged edit back to what is saved, leaving the rest. */
  revert: (path: string) => void;
  discard: () => void;
  dirty: boolean;
  saving: boolean;
  save: (module?: string) => Promise<boolean>;
  /**
   * Writes these paths now, on their own, and shows them as written before the
   * bot answers. Use this instead of `stage()` then `save()` in one handler:
   * `save` reads staged edits from the render it was created in, so it would
   * miss the value staged a line earlier. Other staged edits are left as they
   * are.
   */
  commit: (changes: Record<string, any>, module?: string) => Promise<boolean>;
  /** Refetch config from the bot (used by sections that write elsewhere). */
  refreshConfig: () => Promise<void>;
  setNotice: (notice: ToastInput | null) => void;
  /** Editors backed by their own endpoint join the same global save prompt. */
  registerExternalDraft: (key: string, handlers: ExternalDraft) => () => void;
  setExternalDraftDirty: (key: string, dirty: boolean) => void;
  /** Step the staged settings back, or forward again. Each returns the paths
   *  that changed, or null when there was nothing to step to. */
  undo: () => string[] | null;
  redo: () => string[] | null;
  unsavedCount: number;
  /** What each unsaved editor outside the settings is, as the save prompt's
      list names it: "the bot's profile", or a message design. */
  unsavedElsewhere: string[];
}

interface ExternalDraft {
  save: () => Promise<boolean>;
  discard: () => void;
  /** How the save prompt names it. Unnamed, it is a message design. */
  label?: string;
}

const ManageContext = createContext<ManageContextValue | null>(null);
const manageCache = new Map<string, { meta: GuildMeta; config: GuildConfig; savedAt: number }>();

export function useManage(): ManageContextValue {
  const context = useContext(ManageContext);
  if (!context) throw new Error("useManage must be used inside ManageProvider");
  return context;
}

/**
 * The same context, or null outside a provider, for components that can work
 * without it (the workflow editor renders on its own route; a picker can fall
 * back to a text input).
 */
export function useOptionalManage(): ManageContextValue | null {
  return useContext(ManageContext);
}

/**
 * Alternate API endpoints for a provider instance. The member portal points
 * these at department-scoped endpoints, so department managers can use the same
 * editors without Manage Server.
 */
export type ManageEndpoints = {
  meta: string;
  config: string;
  /** PATCH target for saves; defaults to `config`. */
  patch?: string;
};

export function ManageProvider({
  guildId,
  children,
  endpoints,
}: {
  guildId: string;
  children: React.ReactNode;
  endpoints?: ManageEndpoints;
}) {
  const metaUrl = endpoints?.meta || `/api/manage/${guildId}/meta`;
  const configUrl = endpoints?.config || `/api/manage/${guildId}/config`;
  const patchUrl = endpoints?.patch || configUrl;
  // Scoped providers (portal editors) must never share cached config or
  // drafts with the full manage dashboard for the same guild.
  const cacheKey = endpoints ? `${guildId}:${configUrl}` : guildId;
  const cached = manageCache.get(cacheKey);
  const [meta, setMeta] = useState<GuildMeta | null>(cached?.meta || null);
  const [config, setConfig] = useState<GuildConfig | null>(cached?.config || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  /**
   * Bumped to retry the load without reloading the page (a reload would re-read
   * the same cached failed response).
   */
  const [attempt, setAttempt] = useState(0);
  // Unsaved edits survive crashes and closed tabs via localStorage.
  const draftKey = `gator-draft-${cacheKey}`;
  const [pending, setPendingState] = useState<Record<string, any>>({});
  /** The staged settings as of the last update, for the undo history to copy
      without waiting for a render. */
  const pendingRef = useRef<Record<string, any>>({});
  const setPending = useCallback(
    (update: React.SetStateAction<Record<string, any>>) => {
      setPendingState((current) => {
        const next = typeof update === "function" ? update(current) : update;
        pendingRef.current = next;
        try {
          if (Object.keys(next).length) {
            localStorage.setItem(draftKey, JSON.stringify(next));
          } else {
            localStorage.removeItem(draftKey);
          }
        } catch {
          /* storage may be unavailable; drafts just won't persist */
        }
        return next;
      });
    },
    [draftKey],
  );
  /* Undo history for staged settings (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z). Each
     change copies the staged set onto the history first; repeated changes to
     the same path within a moment join one step, so typing is one step. Saving
     clears the history. Editors with their own drafts (a message design, the
     bot profile) are not included; their fields have the browser's undo. */
  const history = useRef<{
    past: Record<string, any>[];
    future: Record<string, any>[];
    last: { path: string; at: number } | null;
  }>({ past: [], future: [], last: null });
  const remember = useCallback((path: string | null) => {
    const steps = history.current;
    const now = Date.now();
    if (path && steps.last && steps.last.path === path && now - steps.last.at < 900) {
      steps.last.at = now;
      return;
    }
    steps.past.push(pendingRef.current);
    if (steps.past.length > 100) steps.past.shift();
    steps.future = [];
    steps.last = path ? { path, at: now } : null;
  }, []);
  const stepTo = useCallback(
    (from: "past" | "future") => {
      const steps = history.current;
      const target = steps[from].pop();
      if (!target) return null;
      const here = pendingRef.current;
      steps[from === "past" ? "future" : "past"].push(here);
      steps.last = null;
      setPending(target);
      const paths = new Set([...Object.keys(here), ...Object.keys(target)]);
      // Staged or not is a difference too: a switch staged off compares equal
      // to nothing staged at all.
      return [...paths].filter(
        (path) => path in here !== path in target || !configValuesEqual(here[path], target[path]),
      );
    },
    [setPending],
  );
  const undo = useCallback(() => stepTo("past"), [stepTo]);
  const redo = useCallback(() => stepTo("future"), [stepTo]);

  const [saving, setSaving] = useState(false);
  const externalHandlers = useRef(new Map<string, ExternalDraft>());
  const [externalDirty, setExternalDirty] = useState<Record<string, boolean>>({});

  const registerExternalDraft = useCallback(
    (key: string, handlers: ExternalDraft) => {
      externalHandlers.current.set(key, handlers);
      return () => {
        externalHandlers.current.delete(key);
        setExternalDirty((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      };
    },
    [],
  );

  const setExternalDraftDirty = useCallback((key: string, dirty: boolean) => {
    setExternalDirty((current) => {
      if (Boolean(current[key]) === dirty) return current;
      const next = { ...current };
      if (dirty) next[key] = true;
      else delete next[key];
      return next;
    });
  }, []);
  /* Toasts are Sonner's (interruptible stacking, fanning on hover, paused
     timers, swipe to dismiss). This keeps the one call every tab already makes. */
  const showNotice = useCallback((value: ToastInput | null) => {
    if (!value) {
      toast.dismiss();
      return;
    }
    const show = value.kind === "saved" ? toast.success : toast.error;
    show(value.text, {
      // A toast with an action stays longer, so there is time to press it.
      duration: value.action ? 7000 : 4200,
      id: value.id,
      action: value.action
        ? { label: value.action.label, onClick: () => value.action?.run() }
        : undefined,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!manageCache.has(cacheKey)) setLoading(true);
      setError(null);
      // A fresh cached copy means this visit needs no network.
      if (manageCache.has(cacheKey) && isFresh(metaUrl) && isFresh(configUrl)) {
        setLoading(false);
        return;
      }
      // Bounded, so a bot that accepts the connection and never answers becomes
      // an error with a retry instead of a skeleton forever. Generous, since
      // cold reads of large configs are slow. Raced rather than aborted:
      // requests go through a shared cache that may return a promise another
      // mount started, which an AbortController could not cancel.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const expired = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error("Timed out");
          error.name = "TimeoutError";
          reject(error);
        }, LOAD_TIMEOUT_MS);
      });
      try {
        // Both go through the shared cache, so two components mounting at once
        // share one round trip instead of racing the same request.
        const [metaJson, configJson] = await Promise.race([
          Promise.all([
            cachedJson<GuildMeta>(metaUrl, { force: attempt > 0 }),
            // A guild with no saved config is a legitimate empty answer, but
            // only when the server actually answered. Any other failure must
            // propagate: treating it as `{}` would render defaults, cache them,
            // restore the local draft as pending changes, and a save would then
            // send `$unset` for staged `undefined` values, deleting real
            // settings.
            cachedJson<{ config?: GuildConfig }>(configUrl, {
              force: attempt > 0,
            }),
          ]),
          expired,
        ]).catch((error) => {
          if ((error as { status?: number })?.status === 403) {
            if (!cancelled) setForbidden(true);
            return [null, null] as const;
          }
          throw error;
        });
        if (metaJson === null || configJson === null) return;
        if (!cancelled) {
          setMeta(metaJson);
          setConfig(configJson.config || {});
          manageCache.set(cacheKey, {
            meta: metaJson,
            config: configJson.config || {},
            savedAt: Date.now(),
          });
          try {
            const stored = localStorage.getItem(draftKey);
            if (stored) {
              const parsed = JSON.parse(stored);
              const restored = removeSavedPending(
                parsed || {},
                configJson.config || {},
              );
              if (Object.keys(restored).length) {
                pendingRef.current = restored;
                setPendingState(restored);
                showNotice({
                  kind: "saved",
                  text: "Restored your unsaved changes",
                });
              }
            }
          } catch {
            /* corrupt draft — start clean */
          }
        }
      } catch (caught) {
        if (!cancelled) {
          const timedOut =
            caught instanceof Error &&
            (caught.name === "AbortError" || caught.name === "TimeoutError");
          setError(
            timedOut
              ? "This server's configuration is taking too long to load. The bot may be busy or restarting."
              : "We couldn't load this server's configuration. The bot may be offline. Try again in a moment.",
          );
        }
      } finally {
        clearTimeout(timer);
        // The race's loser rejects after we have stopped looking at it, and an
        // unobserved rejection is an unhandled one.
        expired.catch(() => {});
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, metaUrl, configUrl, attempt]);

  /** Retry the load in place. Clears the error first so the retry is visible
   *  as a loading state rather than as nothing happening. */
  const reload = useCallback(() => {
    setError(null);
    setForbidden(false);
    setLoading(true);
    setAttempt((current) => current + 1);
  }, []);

  /* ── refreshing the pickers ──

     One refetch of `meta`, shared by every channel and role picker on the page.
     Not `reload`, which sets `loading`, drops the page back to a skeleton and
     loses unsaved edits; this only replaces `meta`. */
  const [refreshingMeta, setRefreshingMeta] = useState(false);
  const [metaReadyAt, setMetaReadyAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Only ticks while a cooldown is actually running, so an idle page is not
  // re-rendering once a second forever.
  useEffect(() => {
    if (metaReadyAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [metaReadyAt]);

  const metaCooldown = Math.max(0, Math.ceil((metaReadyAt - now) / 1000));

  const refreshMeta = useCallback(async () => {
    if (refreshingMeta || Date.now() < metaReadyAt) return;
    setRefreshingMeta(true);
    try {
      const response = await fetch(`${metaUrl}?refresh=1`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (response.ok && json && !json.error) {
        setMeta(json);
        // The page cache holds meta beside config; leaving the old lists there
        // would put them straight back on the next mount.
        const cachedConfig = manageCache.get(cacheKey)?.config;
        if (cachedConfig) {
          manageCache.set(cacheKey, {
            meta: json,
            config: cachedConfig,
            savedAt: Date.now(),
          });
        }
      }
    } catch {
      // Silent: the lists that are already on screen still work, and a failed
      // refresh is not worth interrupting an edit for.
    } finally {
      setRefreshingMeta(false);
      const until = Date.now() + META_REFRESH_COOLDOWN_MS;
      setMetaReadyAt(until);
      setNow(Date.now());
    }
  }, [cacheKey, metaReadyAt, metaUrl, refreshingMeta]);

  const value = useCallback(
    (path: string) => {
      if (path in pending) return pending[path];
      return getPath(config, path);
    },
    [pending, config],
  );

  const stage = useCallback(
    /* `shown` is what the screen displays at this path when nothing is saved,
       for hand-written tabs with no schema default: choosing that value again
       is not a change. */
    (path: string, nextValue: any, shown?: unknown) => {
      const staged = pendingRef.current;
      if (!(path in staged && configValuesEqual(staged[path], nextValue))) remember(path);
      setPending((current) => {
        const saved = getPath(config, path);
        const next = { ...current };
        const field = fieldAt(path);
        const spec = shown === undefined ? field : { ...(field || {}), defaultValue: shown };
        if (matchesSaved(nextValue, saved, spec)) {
          delete next[path];
        } else {
          next[path] = nextValue;
        }
        return next;
      });
    },
    [config, remember, setPending],
  );

  /* Which write is the newest. When writes overlap, only the newest one's
     answer is applied; older answers arriving late are ignored (otherwise a
     module card would flicker through every intermediate state). */
  const commitSeq = useRef(0);

  const commit = useCallback(
    async (changes: Record<string, any>, module?: string) => {
      if (config === null) {
        showNotice({
          kind: "error",
          text: "This server's settings never loaded, so there is nothing safe to write against. Reload the page first.",
        });
        return false;
      }
      const previous = config;
      const seq = ++commitSeq.current;
      // Shown written at once. The fill on a module card starts on the press,
      // not on the round trip, and if the bot says no it goes back.
      let optimistic = previous;
      for (const [path, next] of Object.entries(changes)) {
        optimistic = withPath(optimistic, path, next);
      }
      setConfig(optimistic);
      setPending((current) => {
        const next = { ...current };
        for (const path of Object.keys(changes)) delete next[path];
        return next;
      });
      const set: Record<string, any> = {};
      const unset: string[] = [];
      for (const [path, next] of Object.entries(changes)) {
        if (next === undefined) unset.push(path);
        else set[path] = next;
      }
      try {
        const res = await fetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ set, unset, module }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail || body?.message || "Save failed");
        }
        const json = await res.json().catch(() => ({}));
        // The bot's copy when it sends one; ours when it does not, which is
        // the same document it just accepted.
        const nextConfig = json?.config ?? optimistic;
        invalidateCache(`/api/manage/${guildId}`);
        if (seq !== commitSeq.current) return true;
        setConfig(nextConfig);
        if (meta) manageCache.set(cacheKey, { meta, config: nextConfig, savedAt: Date.now() });
        return true;
      } catch (caught) {
        // A newer write is already on screen, built on this one.
        if (seq === commitSeq.current) setConfig(previous);
        showNotice({
          kind: "error",
          text: caught instanceof Error ? caught.message : "Save failed",
        });
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, meta, patchUrl, cacheKey, guildId, showNotice],
  );

  const revert = useCallback(
    (path: string) => {
      if (path in pendingRef.current) remember(null);
      setPending((current) => {
        if (!(path in current)) return current;
        const next = { ...current };
        delete next[path];
        return next;
      });
    },
    [remember, setPending],
  );

  /* Discard with an undo toast for a few seconds rather than a confirmation.
     Restores the staged settings; editors with their own drafts have already
     restored theirs. */
  const discard = useCallback(() => {
    const thrown = pending;
    const count = Object.keys(thrown).length;
    if (count) remember(null);
    setPending({});
    for (const key of Object.keys(externalDirty)) {
      externalHandlers.current.get(key)?.discard();
    }
    setExternalDirty({});
    if (count) {
      showNotice({
        kind: "saved",
        text: `Discarded ${count} change${count === 1 ? "" : "s"}`,
        action: { label: "Undo", run: () => setPending((current) => ({ ...thrown, ...current })) },
      });
    }
  }, [externalDirty, pending, remember, setPending, showNotice]);

  const refreshConfig = useCallback(async () => {
    try {
      // force: this is the explicit "the data changed" path, so a fresh cache
      // entry must not be allowed to answer it.
      const json = await cachedJson<{ config?: GuildConfig }>(configUrl, {
        force: true,
      }).catch(() => null);
      if (json) {
        const nextConfig = json.config || {};
        setConfig(nextConfig);
        const cachedMeta = manageCache.get(cacheKey)?.meta || meta;
        if (cachedMeta) manageCache.set(cacheKey, { meta: cachedMeta, config: nextConfig, savedAt: Date.now() });
        setPending((current) => removeSavedPending(current, nextConfig));
      }
    } catch {
      /* keep the stale copy; the next save will refresh it */
    }
  }, [cacheKey, configUrl, meta, setPending]);

  const save = useCallback(
    async (module?: string) => {
      const entries = Object.entries(pending);
      const externalKeys = Object.keys(externalDirty);
      if (!entries.length && !externalKeys.length) return true;
      // Never save against a config that never loaded: every path would differ
      // from nothing, and staged `undefined` values go out as `$unset`,
      // deleting settings.
      if (config === null) {
        showNotice({
          kind: "error",
          text: "This server's settings never loaded, so there is nothing safe to compare your changes against. Reload the page before saving.",
        });
        return false;
      }
      setSaving(true);
      try {
        const set: Record<string, any> = {};
        const unset: string[] = [];
        for (const [path, staged] of entries) {
          if (staged === undefined) unset.push(path);
          else set[path] = staged;
        }
        if (entries.length) {
          const res = await fetch(patchUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ set, unset, module }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.detail || body?.message || "Save failed");
          }
          const json = await res.json();
          const nextConfig = json.config || {};
          setConfig(nextConfig);
          if (meta) manageCache.set(cacheKey, { meta, config: nextConfig, savedAt: Date.now() });
          // The write landed, so every cached read for this guild is dropped
          // (otherwise navigating away and back would show the old value).
          invalidateCache(`/api/manage/${guildId}`);
          // Only clears what this request saved, so edits staged during the
          // save survive.
          setPending((current) => {
            const next = { ...current };
            for (const [path, staged] of entries) {
              if (configValuesEqual(next[path], staged)) delete next[path];
            }
            return next;
          });
        }
        // External drafts are cleared one at a time as each saves, so one
        // failure does not leave the successful ones marked unsaved.
        for (const key of externalKeys) {
          const ok = await externalHandlers.current.get(key)?.save();
          if (ok === false) throw new Error("One editor could not be saved");
          setExternalDirty((current) => {
            if (!(key in current)) return current;
            const next = { ...current };
            delete next[key];
            return next;
          });
        }
        // No toast: the save prompt says so itself, where you pressed Save,
        // and a second "Saved" in the corner was the same news twice.
        void module;
        history.current = { past: [], future: [], last: null };
        return true;
      } catch (err) {
        showNotice({
          kind: "error",
          text: err instanceof Error ? err.message : "Save failed",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [cacheKey, config, externalDirty, meta, patchUrl, pending, setPending, showNotice],
  );

  const contextValue = useMemo<ManageContextValue>(
    () => ({
      guildId,
      meta,
      config,
      loading,
      error,
      forbidden,
      reload,
      refreshMeta,
      refreshingMeta,
      metaCooldown,
      pending,
      value,
      stage,
      revert,
      discard,
      dirty:
        Object.keys(pending).length > 0 || Object.keys(externalDirty).length > 0,
      saving,
      save,
      commit,
      refreshConfig,
      setNotice: showNotice,
      registerExternalDraft,
      setExternalDraftDirty,
      undo,
      redo,
      unsavedCount:
        Object.keys(pending).length + Object.keys(externalDirty).length,
      unsavedElsewhere: Object.keys(externalDirty).map(
        (key) => externalHandlers.current.get(key)?.label ?? "message design",
      ),
    }),
    [
      guildId,
      meta,
      config,
      loading,
      error,
      forbidden,
      reload,
      refreshMeta,
      refreshingMeta,
      metaCooldown,
      pending,
      value,
      stage,
      revert,
      discard,
      saving,
      save,
      commit,
      refreshConfig,
      showNotice,
      externalDirty,
      registerExternalDraft,
      setExternalDraftDirty,
      undo,
      redo,
    ],
  );

  return (
    <ManageContext.Provider value={contextValue}>
      {children}
    </ManageContext.Provider>
  );
}
