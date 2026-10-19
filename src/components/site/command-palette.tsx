"use client";

/* The command palette: everything the site can take you to, from one shortcut.

   - The index is real: documentation rows mirror the docs deployment's route
     table with its own descriptions and keywords, and module rows use the
     dashboard's module list. Nothing links somewhere that does not exist.
   - Results are ranked: an exact title wins, then a title starting with the
     query, then one containing it, then a keyword hit, then a description hit.
   - Keyboard-first: Cmd/Ctrl+K opens it anywhere, arrows walk the list across
     sections, Enter follows, Escape closes. The pointer highlights the row
     under it, so the two never disagree about what Enter will do. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconBook2,
  IconCornerDownLeft,
  IconX,
  IconExternalLink,
  IconFileText,
  IconHome,
  IconLayoutDashboard,
  IconLifebuoy,
  IconPuzzle,
  IconSearch,
  IconShieldCheck,
  IconUserCircle,
} from "@tabler/icons-react";
import { usePresence } from "@/components/motion";
import { lockScroll } from "./scroll-lock";
import { DOCS_PAGES, MODULE_CATALOGUE, MODULE_DOCS, docsUrl } from "@/config/docs-index";
import { MODULES } from "./modules";
import { SUPPORT_URL } from "@/config/site";
import "./command-palette.css";

type Icon = typeof IconSearch;

export interface PaletteEntry {
  id: string;
  title: string;
  /** The line under the title. Always something real about the destination. */
  note: string;
  href: string;
  external: boolean;
  Icon: Icon;
  /** The row's own mark, drawn as it is, where the page has one already --
   *  the dashboard's tabs each have theirs in the rail. */
  icon?: ReactNode;
  /**
   * The section heading this row is filed under. A string, because a page can
   * supply its own rows (the dashboard does).
   */
  section: string;
  /** Extra words that should match it, beyond the title and the note. */
  terms: string;
  /** Shown at the right of the row: which docs tab, which module group. */
  tag?: string;
  /**
   * Run this instead of following `href`: dashboard tabs are panels in one
   * page, switched by the shell without a reload.
   */
  run?: () => void;
}

const GO = "Go to";
const DOCS = "Documentation";
const MODULES_SECTION = "Modules";

/* The app's own pages. Two of these only exist for somebody who is signed in,
   so the list is built from the viewer rather than declared flat. */
function pages(signedIn: boolean): PaletteEntry[] {
  const rows: PaletteEntry[] = [
    {
      id: "home",
      title: "Homepage",
      note: "What Bot does, and what it costs.",
      href: "/",
      external: false,
      Icon: IconHome,
      section: GO,
      terms: "landing home front start index",
    },
    {
      id: "servers",
      title: "Dashboard",
      note: "Pick a server and open its settings.",
      href: "/servers",
      external: false,
      Icon: IconLayoutDashboard,
      section: GO,
      terms: "servers manage guilds picker dashboard departments",
    },
  ];

  if (signedIn) {
    rows.push(
      {
        id: "account",
        title: "Account",
        note: "Your Discord login, and what it is linked to.",
        href: "/account",
        external: false,
        Icon: IconUserCircle,
        section: GO,
        terms: "profile settings login discord me",
      },
      {
        id: "roblox",
        title: "Roblox link",
        note: "Connect or disconnect the Roblox account on your profile.",
        href: "/account/roblox",
        external: false,
        Icon: IconUserCircle,
        section: GO,
        terms: "roblox verify link unlink connection",
      },
    );
  } else {
    rows.push({
      id: "signin",
      title: "Sign in with Discord",
      note: "The dashboard needs the servers your Discord account is in.",
      href: "/auth/discord",
      external: false,
      Icon: IconUserCircle,
      section: GO,
      terms: "log in login sign up authenticate oauth",
    });
  }

  rows.push(
    {
      id: "support",
      title: "Support",
      note: "Setup guidance and support information.",
      href: SUPPORT_URL,
      external: true,
      Icon: IconLifebuoy,
      section: GO,
      terms: "help discord contact invite community",
    },
    {
      id: "privacy",
      title: "Privacy",
      note: "What is stored, why, and for how long.",
      href: "/privacy",
      external: false,
      Icon: IconShieldCheck,
      section: GO,
      terms: "policy data gdpr retention legal",
    },
    {
      id: "terms",
      title: "Terms",
      note: "The terms of using Bot.",
      href: "/terms",
      external: false,
      Icon: IconFileText,
      section: GO,
      terms: "legal conditions agreement service",
    },
  );

  return rows;
}

const DOC_ROWS: PaletteEntry[] = DOCS_PAGES.map((page) => ({
  id: `docs${page.path}`,
  title: page.title,
  note: page.description,
  href: docsUrl(page.path),
  external: true,
  Icon: IconBook2,
  section: DOCS,
  terms: page.keywords,
  tag: page.product,
}));

const MODULE_ROWS: PaletteEntry[] = MODULES.map((module) => ({
  id: `module-${module.key}`,
  title: module.name,
  note: module.purpose,
  href: docsUrl(MODULE_DOCS[module.key] ?? MODULE_CATALOGUE),
  external: true,
  Icon: IconPuzzle,
  section: MODULES_SECTION,
  terms: `${module.group} module ${module.key}`,
  tag: module.group,
}));

/* Scoring: bigger is better, zero means not an answer. The bands are far apart
   so any title hit outranks every keyword hit; within a band, an earlier match
   in the title ranks higher. */
function score(entry: PaletteEntry, term: string): number {
  const title = entry.title.toLowerCase();
  if (title === term) return 1000;
  if (title.startsWith(term)) return 800 - title.length;
  const inTitle = title.indexOf(term);
  if (inTitle > 0) {
    // A hit at a word boundary is a real match; one mid-word is a coincidence.
    const boundary = title[inTitle - 1] === " " || title[inTitle - 1] === "-";
    return (boundary ? 600 : 400) - inTitle;
  }
  if (entry.terms.toLowerCase().includes(term)) return 300;
  if (entry.note.toLowerCase().includes(term)) return 200;
  if (entry.tag?.toLowerCase().includes(term)) return 100;
  return 0;
}

/** Every word in the query has to match something, in any order. */
function rank(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;
  const scored: { entry: PaletteEntry; total: number }[] = [];
  for (const entry of entries) {
    let total = 0;
    let all = true;
    for (const word of words) {
      const hit = score(entry, word);
      if (!hit) {
        all = false;
        break;
      }
      total += hit;
    }
    if (all) scored.push({ entry, total });
  }
  scored.sort((a, b) => b.total - a.total);
  return scored.map((row) => row.entry);
}

/** Dispatch on `window` to open the search from anywhere on the page. */
export const OPEN_SEARCH_EVENT = "gator:open-search";
/** Fired with `detail: boolean` whenever the search opens or closes. */
export const SEARCH_STATE_EVENT = "gator:search-state";

export function CommandPalette({
  signedIn,
  className,
  extra,
  extraSection,
}: {
  signedIn: boolean;
  className?: string;
  /**
   * Rows only this page can supply (on /manage, the open server's settings), so
   * there is one search for the whole product.
   */
  extra?: PaletteEntry[];
  /** The heading those rows file under. */
  extraSection?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [mac, setMac] = useState(false);
  /* Narrow screens get a shorter placeholder (the long one is clipped mid-word
     at 390pt). */
  const [narrow, setNarrow] = useState(false);
  const list = useRef<HTMLDivElement | null>(null);
  /* Focuses the input as soon as it attaches: the sheet mounts in a portal on
     its own schedule, so a timer could miss it. */
  const field = useCallback((node: HTMLInputElement | null) => {
    /* `preventScroll`: focusing would otherwise scroll into view, which forces
       a full-document layout on the frame of the press (about 11ms measured).
       The sheet is a fixed overlay, so there is nothing to scroll to. */
    node?.focus({ preventScroll: true });
  }, []);
  /* Held mounted through the exit so closing is an animation rather than a
     disappearance. */
  const { mounted, state } = usePresence(open, { duration: 200 });


  const all = useMemo(
    () => [...(extra ?? []), ...pages(signedIn), ...DOC_ROWS, ...MODULE_ROWS],
    [extra, signedIn],
  );

  const results = useMemo(() => {
    const term = query.trim();
    if (!term) {
      /* With nothing typed this is a menu: the app's pages and the
         documentation's front matter, without all 26 modules. */
      return [...(extra ?? []), ...pages(signedIn), ...DOC_ROWS.slice(0, 4)];
    }
    return rank(all, term).slice(0, 24);
  }, [all, extra, query, signedIn]);

  /* Grouped for display, with the cursor following the drawn order. Sections
     are ordered by their best row (so the top result is at the top), and cursor
     positions are reassigned after grouping so the arrow keys move down the
     sheet in order. */
  const laid = useMemo(() => {
    const buckets = new Map<string, PaletteEntry[]>();
    const best = new Map<string, number>();
    results.forEach((entry, index) => {
      const bucket = buckets.get(entry.section);
      if (bucket) bucket.push(entry);
      else {
        buckets.set(entry.section, [entry]);
        best.set(entry.section, index);
      }
    });
    let seat = 0;
    return [...buckets.entries()]
      .sort((a, b) => best.get(a[0])! - best.get(b[0])!)
      .map(([name, rows]) => ({
        name,
        rows: rows.map((entry) => ({ entry, seat: seat++ })),
      }));
  }, [results]);

  /** The rows in the order they are drawn, which is what Enter indexes into. */
  const ordered = useMemo(
    () => laid.flatMap((section) => section.rows.map((row) => row.entry)),
    [laid],
  );

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  /* Live, because the window can be resized with the palette open. Same
     breakpoint as the stylesheet. */
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const read = () => setNarrow(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  // Cmd/Ctrl K from anywhere. Escape closes even when the field has focus.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((was) => !was);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Opened from elsewhere: on a phone the dashboard's search button is in the
     dock, which asks for the palette by event. */
  useEffect(() => {
    const onAsk = () => setOpen(true);
    window.addEventListener(OPEN_SEARCH_EVENT, onAsk);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, onAsk);
  }, []);

  /* Said out loud, for what sits under the sheet: the dashboard's dock tucks
     itself away beneath it while it is open. */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SEARCH_STATE_EVENT, { detail: open }));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setCursor(0);
    /* Locks page scroll under the sheet (setting `overflow: hidden` on <body>
       does not stop the document scrolling, because the root element scrolls;
       see scroll-lock.ts). The numbers are this sheet's entrance and exit
       durations from command-palette.css plus a frame, so the lock's expensive
       style recalculation never lands mid-animation. */
    const release = lockScroll({ arriving: 270, leaving: 200 });
    return () => {
      release();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  // A new query is a new list, so the cursor resets.
  useEffect(() => setCursor(0), [query]);

  /* Keeps the highlighted row in view on the next frame, not this one: in the
     commit that inserted the sheet, `scrollIntoView` would force a
     full-document layout (about 19ms measured). A frame later it costs nothing. */
  useEffect(() => {
    const box = list.current;
    if (!box) return;
    const id = requestAnimationFrame(() => {
      box
        .querySelector<HTMLElement>('[data-cursor="true"]')
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [cursor, ordered]);

  const go = useCallback(
    (entry: PaletteEntry) => {
      setOpen(false);
      /* The sheet leaves first, then the page navigates, so a dashboard tab
         transition does not capture the half-faded sheet. */
      const after = (then: () => void) => window.setTimeout(then, 150);
      if (entry.run) after(entry.run);
      else if (entry.external) window.open(entry.href, "_blank", "noopener,noreferrer");
      else after(() => router.push(entry.href));
    },
    [router],
  );

  /* On the sheet rather than the input, so the arrows still work after a click
     moves focus onto a row. */
  const onKey = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((at) => (ordered.length ? (at + 1) % ordered.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((at) =>
          ordered.length ? (at - 1 + ordered.length) % ordered.length : 0,
        );
      } else if (event.key === "Home") {
        event.preventDefault();
        setCursor(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setCursor(Math.max(0, ordered.length - 1));
      } else if (event.key === "Enter") {
        if (!(event.target instanceof Element) || !event.target.closest('input, [role="option"]')) return;
        event.preventDefault();
        const hit = ordered[cursor];
        if (hit) go(hit);
      }
    },
    [cursor, go, ordered],
  );

  /* "⌘K" on a Mac, "Ctrl+K" elsewhere. */
  const hint = mac ? "⌘K" : "Ctrl+K";

  return (
    <>
      {/* A square icon button like its neighbours, not shaped like a text field
         (it opens a sheet with the real field). The shortcut is in the tooltip
         and accessible name. */}
      <button
        type="button"
        className={`g-find ${className ?? ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Search (${hint})`}
        title={`Search (${hint})`}
      >
        <IconSearch size={16} stroke={1.9} />
      </button>

      {mounted ? (
        <Sheet active={open} state={state} onClose={() => setOpen(false)} onKeyDown={onKey}>
          <div className="g-cmd-field">
            <IconSearch size={17} stroke={1.9} />
            <input
              ref={field}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                narrow
                  ? "Search Bot"
                  : extra?.length
                    ? `Search ${extraSection ?? "settings"}, pages and docs`
                    : "Search pages, documentation, and modules"
              }
              aria-label="Search"
              autoComplete="off"
              spellCheck={false}
            />
            {/* Two ways out: an "esc" hint for keyboards and a close button for
               touch (phones have no Escape key). */}
            <kbd className="g-cmd-esc">esc</kbd>
            <button
              className="g-cmd-close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close search"
            >
              <IconX size={18} stroke={2.1} />
            </button>
          </div>

          <div
            className="g-cmd-list"
            ref={list}
            role="listbox"
            aria-label="Results"
            /* The one thing inside the lock that is still allowed to move
               under a finger. */
            data-lock-scrollable="true"
          >
            {laid.length === 0 ? (
              <p className="g-cmd-empty">
                Nothing here matches <strong>{query.trim()}</strong>.
              </p>
            ) : (
              laid.map((section) => (
                <div className="g-cmd-section" key={section.name}>
                  <p className="g-cmd-heading">{section.name}</p>
                  {section.rows.map(({ entry, seat }) => (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      aria-selected={seat === cursor}
                      data-cursor={seat === cursor ? "true" : "false"}
                      className="g-cmd-row"
                      onPointerMove={() => setCursor(seat)}
                      onFocus={() => setCursor(seat)}
                      onClick={() => go(entry)}
                    >
                      <span className="g-cmd-icon" aria-hidden="true">
                        {entry.icon ?? <entry.Icon size={17} stroke={1.8} />}
                      </span>
                      <span className="g-cmd-text">
                        <span className="g-cmd-title">{entry.title}</span>
                        <span className="g-cmd-note">{entry.note}</span>
                      </span>
                      {entry.tag ? <span className="g-cmd-tag">{entry.tag}</span> : null}
                      <span className="g-cmd-go" aria-hidden="true">
                        {entry.external ? (
                          <IconExternalLink size={14} stroke={1.9} />
                        ) : (
                          <IconArrowRight size={14} stroke={1.9} />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="g-cmd-foot">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> move
            </span>
            <span>
              <kbd>
                <IconCornerDownLeft size={11} stroke={2.2} />
              </kbd>{" "}
              open
            </span>
            <span className="g-cmd-foot-count">
              {ordered.length} {ordered.length === 1 ? "result" : "results"}
            </span>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

/* The sheet in a portal: the header has its own stacking context, and a dialog
   inside it cannot reliably sit above the page. */
function Sheet({
  active,
  state,
  onClose,
  onKeyDown,
  children,
}: {
  active: boolean;
  state: "from" | "to";
  onClose: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>(
      'input:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    ) || []).filter((node) => !node.closest("[hidden], [inert]") &&
      getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden");
    const contain = (event: FocusEvent) => {
      if (!dialog.current?.contains(event.target as Node)) focusable()[0]?.focus();
    };
    const tab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("focusin", contain);
    document.addEventListener("keydown", tab, true);
    return () => {
      document.removeEventListener("focusin", contain);
      document.removeEventListener("keydown", tab, true);
    };
  }, [active]);
  /* Read directly rather than set after an effect, so the portal's contents
     exist on the frame the field takes focus. Nothing renders on the server:
     the sheet only exists once opened. */
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="g-cmd-scrim" data-state={state} onPointerDown={onClose}>
      <div
        ref={dialog}
        className="g-cmd"
        inert={!active}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKeyDown}
        // The scrim closes on a press; the sheet must not pass its own up.
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
