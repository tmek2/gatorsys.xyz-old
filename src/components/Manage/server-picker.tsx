"use client";

/* Which server you are in, and how to change it.

   - The server is the window's tab at the leading edge of the chrome, joined to
     the pane below: switching servers is picking up a different tab.
   - Pressing it opens a panel hung off the tab, not a modal.
   - Fully keyboard-driven: it opens focused on the search field, typing
     filters, arrows walk the list, Enter goes, Escape leaves. The pointer
     highlights the row under it, so the highlight and Enter always agree. */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconLayoutGrid,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { useMounted, usePresence } from "@/components/motion";
import { useSafeOutsidePress } from "./safe-area";
import { getDiscordBotInviteUrl } from "@/utils/discord-links";
import { travel, wantsNewTab } from "@/utils/travel";
import { useCommunityNavigation } from "@/components/servers/community-navigation";

export interface PickableServer {
  id: string;
  name: string;
  icon: string | null;
  memberCount?: number | null;
}

/** Two letters off a name, for a server that has no art of its own. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "··";
}

export function ServerPicker({
  anchor,
  open,
  onClose,
  currentId,
}: {
  /** The tab the panel hangs off. */
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  currentId: string;
}) {
  const router = useRouter();
  const { choose } = useCommunityNavigation();
  const presence = usePresence(open, { duration: 200 });
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [servers, setServers] = useState<PickableServer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);
  const scrim = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  /* A press in the gap between the tab and the panel is not a press outside
     the panel. See safe-area.ts. */
  useSafeOutsidePress({ open, anchor, panel: sheet, onPress: onClose });

  /* One request at a time: the hover that warms the list and the press that
     opens it usually land a few hundred milliseconds apart. */
  const inflight = useRef(false);

  const load = useCallback(() => {
    if (inflight.current) return;
    inflight.current = true;
    setServers(null);
    setFailed(false);
    /* Time out, so a bot that is not answering says so instead of spinning on
       "Loading" until the tab is closed. */
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 12000);
    fetch("/api/mutual", { signal: stop.signal })
      .then((response) => {
        if (!response.ok) throw new Error("request failed");
        return response.json();
      })
      .then((json) => setServers(json.mutual || []))
      .catch(() => {
        setServers([]);
        setFailed(true);
      })
      .finally(() => {
        clearTimeout(timer);
        inflight.current = false;
      });
  }, []);

  useEffect(() => {
    if (!open || servers !== null) return;
    load();
  }, [open, servers, load]);

  /* Prefetches the server list on hover or focus of the tab, so it is usually
     ready when the panel opens (otherwise the panel would grow mid-animation). */
  useEffect(() => {
    const node = anchor.current;
    if (!node || servers !== null) return;
    const warm = () => load();
    node.addEventListener("pointerenter", warm, { once: true });
    node.addEventListener("focus", warm, { once: true });
    return () => {
      node.removeEventListener("pointerenter", warm);
      node.removeEventListener("focus", warm);
    };
  }, [anchor, servers, load]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const id = window.setTimeout(() => field.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  /* Measured before paint, so the panel never draws at the top-left first.
     Anchored to the tab but kept on screen: on a phone the panel slides back to
     the gutter where hanging from the tab would push it past the right edge. */
  const place = useCallback(() => {
    const node = anchor.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const gutter = 12;
    const width = sheet.current?.offsetWidth || Math.min(400, window.innerWidth - 24);
    const rightmost = Math.max(gutter, window.innerWidth - width - gutter);
    /* The blur covers everything under the bar (the rail, the page and the
       footer breadcrumbs, to the window's lower corners); only the bar stays
       sharp. On a phone, everything under the bar. */
    const win = window.matchMedia("(min-width: 761px)").matches
      ? document.querySelector<HTMLElement>(".manage-root .gw")
      : null;
    const bar = win?.querySelector<HTMLElement>(".gw-bar");
    const winBox = win?.getBoundingClientRect();
    const barBox = bar?.getBoundingClientRect();
    const pageBox =
      winBox && barBox
        ? { top: barBox.bottom, left: winBox.left, width: winBox.width, height: Math.max(0, winBox.bottom - barBox.bottom) }
        : null;
    /* Written to the element directly, not through state: the tab opens the
       layer on press before React renders, and the blur must be the right shape
       on that frame. */
    const veil = scrim.current;
    if (veil) {
      const r = pageBox
        ? pageBox
        : { top: rect.bottom, left: 0, width: window.innerWidth, height: Math.max(0, window.innerHeight - rect.bottom) };
      veil.style.top = `${r.top}px`;
      veil.style.left = `${r.left}px`;
      veil.style.width = `${r.width}px`;
      veil.style.height = `${r.height}px`;
      // What the pour grows to: the keyframes read it, so a resize while it
      // is open moves the end of the pour with the page.
      veil.style.setProperty("--gw-veil-h", `${r.height}px`);
      veil.style.setProperty(
        "--gw-veil-r",
        win ? getComputedStyle(win).borderBottomLeftRadius : "0px",
      );
    }
    const left = Math.min(Math.max(gutter, rect.left), rightmost);
    const top = rect.bottom + 6;
    setBox((current) => (current && current.left === left && current.top === top ? current : { left, top }));
  }, [anchor]);

  /* Placed once the page is up, again when the tab is about to be pressed (the
     shell dispatches `gw-pick-arm`), and kept placed while open. Not on every
     scroll while shut. */
  const showing = open || presence.mounted;
  const ready = useMounted();
  useLayoutEffect(() => {
    if (!ready) return;
    place();
    window.addEventListener("gw-pick-arm", place);
    if (!showing) return () => window.removeEventListener("gw-pick-arm", place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("gw-pick-arm", place);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [ready, showing, place]);

  /* The server you are in comes first, dimmed and labelled in words. */
  const found = useMemo(() => {
    const term = query.trim().toLowerCase();
    const all = servers || [];
    const matching = term
      ? all.filter((server) => server.name.toLowerCase().includes(term))
      : all;
    const here = matching.filter((server) => server.id === currentId);
    const rest = matching.filter((server) => server.id !== currentId);
    return [...here, ...rest];
  }, [servers, query, currentId]);

  /* The cursor starts below the row you are already on, because Enter has to
     go somewhere. It also cannot point past the end of a filtered list. */
  useEffect(() => {
    const first = found[0]?.id === currentId && found.length > 1 ? 1 : 0;
    setCursor(first);
  }, [open, query, found, currentId]);

  const go = useCallback(
    (server: PickableServer) => {
      onClose();
      if (server.id === currentId) return;
      /* The site's own movement between places (a view transition, see "to
         another server" in globals.css): the window stays put, its server's
         name changes in the tab, and the page draws back as the next one
         settles in. Its name and mark go ahead of it, so the new window has
         them before the bot answers. */
      choose({ id: server.id, name: server.name, icon: server.icon ?? null });
      travel(router, `/manage/${server.id}/overview`, "switch", () =>
        Boolean(document.querySelector(`.gw[data-guild="${server.id}"]`)),
      );
    },
    [choose, currentId, onClose, router],
  );

  function onKey(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!found.length) return;
      setCursor((current) => {
        const next =
          event.key === "ArrowDown"
            ? (current + 1) % found.length
            : (current - 1 + found.length) % found.length;
        list.current
          ?.querySelectorAll<HTMLElement>("[data-row]")
          [next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
      return;
    }
    if (event.key === "Enter" && found[cursor]) {
      event.preventDefault();
      go(found[cursor]);
    }
  }

  /* The blur layer is mounted and hidden from the first frame after load, so
     opening the picker only starts an animation on an existing layer. The panel
     itself is only drawn while showing. */
  if (!ready || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="gw-pick-layer"
      data-enter={presence.state}
      data-open={open ? "true" : showing ? "false" : "idle"}
    >
      {/* Under the bar, not over it: the server's name and the tab you
          pressed stay sharp while everything below them goes out of focus. */}
      <button
        type="button"
        className="gw-pick-scrim"
        aria-label="Close server picker"
        onClick={onClose}
        tabIndex={showing ? 0 : -1}
        ref={scrim}
      />
      {showing ? (
      <div
        ref={sheet}
        className="gw-pick"
        role="dialog"
        aria-label="Switch server"
        style={box ? { left: box.left, top: box.top } : { left: -9999, top: 0 }}
        onKeyDown={onKey}
      >
        <div className="gw-pick-find">
          <IconSearch size={15} aria-hidden="true" />
          <input
            ref={field}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder="Find a server"
            aria-label="Find a server"
            data-bare
          />
        </div>

        <div className="gw-pick-list" ref={list}>
          {servers === null ? (
            <p className="gw-pick-note-line">Reading your servers…</p>
          ) : failed ? (
            <p className="gw-pick-note-line">
              Couldn&apos;t reach the bot.{" "}
              <button type="button" className="gw-pick-act" onClick={load}>
                Try again
              </button>
            </p>
          ) : found.length === 0 ? (
            <p className="gw-pick-note-line">
              {query.trim() ? "No server by that name." : "No servers yet."}
            </p>
          ) : (
            found.map((server, index) => (
              <button
                key={server.id}
                type="button"
                data-row
                data-lit={index === cursor ? "true" : undefined}
                data-here={server.id === currentId ? "true" : undefined}
                className="gw-pick-row"
                onPointerEnter={() => setCursor(index)}
                onClick={() => go(server)}
              >
                {server.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="gw-pick-art" src={server.icon} alt="" />
                ) : (
                  <span className="gw-pick-art" aria-hidden="true">
                    {initials(server.name)}
                  </span>
                )}
                <span className="gw-pick-say">
                  <span className="gw-pick-name">{server.name}</span>
                  {server.memberCount ? (
                    <span className="gw-pick-note">
                      {server.memberCount.toLocaleString()} members
                    </span>
                  ) : null}
                </span>
                {server.id === currentId ? (
                  <span className="gw-pick-pill">Editing</span>
                ) : (
                  <IconArrowRight
                    className="gw-pick-go"
                    size={15}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))
          )}
        </div>

        <div className="gw-pick-foot">
          {/* "All servers" zooms out from this server to the grid (a view
             transition), rather than cutting to a blank page. */}
          <a
            className="gw-pick-act"
            href="/servers"
            onClick={(event) => {
              if (wantsNewTab(event)) return;
              event.preventDefault();
              onClose();
              travel(router, "/servers", "servers", () =>
                Boolean(document.querySelector(".servers-page")),
              );
            }}
          >
            <IconLayoutGrid size={14} aria-hidden="true" />
            All servers
          </a>
          {/* The same invite link /servers uses (Discord rejected the old one's
             unregistered `redirect_uri`), in a new tab so the dashboard stays
             open. */}
          <button
            type="button"
            className="gw-pick-act"
            onClick={() => {
              window.open(getDiscordBotInviteUrl(), "_blank", "noopener,noreferrer");
            }}
          >
            <IconPlus size={14} aria-hidden="true" />
            Add to a server
          </button>
          <span className="gw-pick-keys" aria-hidden="true">
            <kbd>↑↓</kbd>
            <kbd>⏎</kbd>
          </span>
        </div>
      </div>
      ) : null}
    </div>,
    document.body,
  );
}
