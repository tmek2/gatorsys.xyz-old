"use client";

/* The landing's Finder window: the About page as a window parked at the bottom
   of the landing, rising into view as you scroll while the hero stays
   underneath.

   The window is laid out at its open geometry and pushed down with one
   transform, so nothing reflows between states. Where scroll timelines exist
   the scroll drives that transform with no JavaScript; elsewhere an
   IntersectionObserver flips between the same two states.

   That observer also drives interactivity: a parked window must not be
   tabbable, take the wheel, or be announced as on screen. CSS handles the
   visual state, React the interactive state, from the same signal.

   On a phone the frame stays (it rises like an iOS full-height modal), but the
   content is `IosFiles`, a separate component (see files.tsx). The toolbar
   glyphs are SF Symbols drawn in sf.tsx. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DOCS_URL, SUPPORT_URL } from "@/config/site";
import {
  FOLDERS,
  MODULE_BY_KEY,
  MODULE_COUNT,
  REST,
  type Folder,
} from "../modules";
import { GatorLogo } from "../gator-logo";
import { useTabDrag } from "./tab-drag";
import { ModuleWallGrid } from "./wall-grid";
import { ModuleGlyph } from "./module-glyphs";
import {
  IconDots,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconBook,
  IconBuildingBank,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconLayoutGrid,
  IconLifebuoy,
  IconList,
  IconMaximize,
  IconMinimize,
  IconMinus,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { Notepad } from "./notepad";
import { IosFiles } from "./files";
import { ModuleSheet } from "./module-sheet";
import { GATOR_FILE, LEGAL_FILES, type TextFile } from "./content";

type Pane = "gator" | "modules" | "legal";

/* One list, one caption: five rows do not need group headings. */
const SIDEBAR: {
  key: Pane | "docs" | "support";
  label: string;
  Icon: typeof IconFolder;
  href?: string;
}[] = [
  { key: "gator", label: "Gator", Icon: IconFolder },
  { key: "modules", label: "Modules", Icon: IconFolder },
  { key: "docs", label: "Documentation", Icon: IconBook, href: DOCS_URL },
  { key: "support", label: "Support", Icon: IconLifebuoy, href: SUPPORT_URL },
  { key: "legal", label: "Legal", Icon: IconBuildingBank },
];

/* Where you are in the window and how you got there. Back and forward walk a
   history (back to the last place shown, forward to the place left by pressing
   back), each disabled when empty. A place is the pane, folder sheet and note
   shown; selecting a folder on the wall is not a place (it is the click before
   opening). The phone's navigation stack has no forward and does not share
   this. */
interface Place {
  pane: Pane;
  sheet: string | null;
  picked: string | null;
  note: TextFile | null;
}

interface Trail {
  past: Place[];
  here: Place;
  future: Place[];
  /* Which way the last step went, for the pane's slide (from the right =
     deeper, from the left = back). Part of the trail, not a ref, so it commits
     in the same render as the place it describes. */
  dir: "in" | "out";
}

const HOME: Place = { pane: "modules", sheet: null, picked: null, note: null };

const START: Trail = {
  past: [],
  here: HOME,
  future: [],
  dir: "in",
};

/* Tabs. Each tab carries its own history (past, present, future); switching
   tabs is not a step in any history, so back and forward always walk the active
   tab only. Six at most: beyond that the labels get elided. */
const MAX_TABS = 6;

interface Tab extends Trail {
  id: number;
}

/** What a tab is called, and which glyph it carries. */
function nameOf(place: Place): { label: string; moduleKey: string | null } {
  if (place.note) return { label: place.note.name, moduleKey: null };
  if (place.sheet) {
    const folder = FOLDERS.find((f) => f.key === place.sheet);
    return { label: folder?.label ?? "Folder", moduleKey: place.sheet };
  }
  if (place.pane === "gator") return { label: "Gator", moduleKey: null };
  if (place.pane === "legal") return { label: "Legal", moduleKey: null };
  return { label: "Modules", moduleKey: null };
}

/** Going where you already are is not a place worth recording. */
function same(a: Place, b: Place): boolean {
  return (
    a.pane === b.pane &&
    a.sheet === b.sheet &&
    a.picked === b.picked &&
    a.note?.name === b.note?.name
  );
}

/** A file icon on the desk, opened the way a file is opened: twice. */
function FileTile({
  file,
  onOpen,
}: {
  file: TextFile;
  onOpen: (file: TextFile) => void;
}) {
  return (
    <button
      type="button"
      className="g-file"
      onClick={() => onOpen(file)}
      aria-label={`Open ${file.name}`}
    >
      <span className="g-file-art" aria-hidden="true">
        <span className="g-file-page" />
        <span className="g-file-fold" />
        <span className="g-file-rules" />
      </span>
      <span className="g-file-name">{file.name}</span>
    </button>
  );
}

export function Finder({
  onRequestClose,
  onRequestOpen,
  registerOpen,
}: {
  /** Put the window away. The scroll owns this, so the page does it. */
  onRequestClose: () => void;
  /** Bring it up. Same owner, other direction. */
  onRequestOpen?: () => void;
  /** Hands the page a way to say "this is open now". */
  registerOpen?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, ...START }]);
  const [active, setActive] = useState(1);
  /* The active tab, falling back to the first if the id is ever missing
     (closing the active tab picks a replacement in the same commit, so it
     should not be). */
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const { past, here, future, dir } = current;
  const { pane, sheet, picked, note } = here;

  /* Rewrites the active tab's trail only. Every caller must list this as a
     dependency: the closure captures which tab is active, and a stale one would
     write navigation into the wrong tab. */
  const setTrail = useCallback(
    (step: (trail: Trail) => Trail) => {
      setTabs((list) =>
        list.map((tab) => (tab.id === active ? { ...tab, ...step(tab) } : tab)),
      );
    },
    [active],
  );

  /* Tabs can be dragged along the strip, which is the one thing a strip of
     tabs is expected to do that this one could not. */
  const reorder = useCallback((from: number, to: number) => {
    setTabs((list) => {
      const next = [...list];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  }, []);
  const drag = useTabDrag(
    useMemo(() => tabs.map((tab) => tab.id), [tabs]),
    reorder,
  );
  const nextTab = useRef(2);
  const [query, setQuery] = useState("");
  const [grid, setGrid] = useState(true);
  const [tools, setTools] = useState(false);
  const trip = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  /* The sidebar highlight: one shape travelling to the current row, like the
     dashboard rail. */
  const sideRef = useRef<HTMLElement | null>(null);

  /* Going somewhere: records where you were and clears the forward stack. */
  const go = useCallback((step: Partial<Place>) => {
    setTrail((trail) => {
      const next = { ...trail.here, ...step };
      if (same(next, trail.here)) return trail;
      return {
        past: [...trail.past, trail.here],
        here: next,
        future: [],
        dir: "in",
      };
    });
    paneRef.current?.scrollTo({ top: 0 });
  }, [setTrail]);

  const back = useCallback(() => {
    setTrail((trail) => {
      const previous = trail.past.at(-1);
      if (!previous) return trail;
      return {
        past: trail.past.slice(0, -1),
        here: previous,
        future: [trail.here, ...trail.future],
        dir: "out",
      };
    });
    paneRef.current?.scrollTo({ top: 0 });
  }, [setTrail]);

  const forward = useCallback(() => {
    setTrail((trail) => {
      const [next, ...rest] = trail.future;
      if (!next) return trail;
      return {
        past: [...trail.past, trail.here],
        here: next,
        future: rest,
        dir: "in",
      };
    });
    paneRef.current?.scrollTo({ top: 0 });
  }, [setTrail]);

  /* Switching tabs only shows that tab where you left it, with its own arrows. */
  const goTab = useCallback(
    (id: number) => {
      if (id === active) return;
      setActive(id);
      paneRef.current?.scrollTo({ top: 0 });
    },
    [active],
  );

  const newTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) return;
    const id = nextTab.current++;
    setTabs((list) => [...list, { id, ...START }]);
    setActive(id);
    paneRef.current?.scrollTo({ top: 0 });
  }, [tabs.length]);

  const closeTab = useCallback(
    (id: number) => {
      if (tabs.length <= 1) return;
      const index = tabs.findIndex((t) => t.id === id);
      const rest = tabs.filter((t) => t.id !== id);
      setTabs(rest);
      if (id !== active) return;
      /* The replacement for a closed tab is the one to its right, or its left
         when it was last. */
      setActive(rest[Math.min(index, rest.length - 1)].id);
      paneRef.current?.scrollTo({ top: 0 });
    },
    [tabs, active],
  );

  /* Selecting a folder on the wall is not going anywhere — it is the click
     before the one that opens it — so it does not belong in the trail. */
  const pick = useCallback((key: string | null) => {
    setTrail((trail) => ({ ...trail, here: { ...trail.here, picked: key } }));
  }, [setTrail]);

  /* Openness without reading the scroll position: a sentinel one viewport down
     the runway, observed against a band at the top of the screen. It triggers
     at 85%, the same point the rise ends (`animation-range: 0% 85%` in
     mac.css), so the window becomes interactive exactly when it finishes
     arriving. */
  useEffect(() => {
    const node = trip.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setOpen(entry.isIntersecting);
        registerOpen?.(entry.isIntersecting);
      },
      { rootMargin: "0px 0px -85% 0px", threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [registerOpen]);

  /* No entrance animation on the wall: the folders are simply there. */

  /* Scrolling away keeps where you were: `open` follows the scroll and flips on
     any small scroll up, so the trail and search survive. Only full screen is
     dropped, because the parked geometry is measured against the normal insets. */
  useEffect(() => {
    if (open) return;
    setFull(false);
  }, [open]);

  const index = sheet ? FOLDERS.findIndex((f) => f.key === sheet) : -1;
  const folder: Folder | null = index >= 0 ? FOLDERS[index] : null;

  const step = useCallback(
    (by: number) => {
      if (index < 0) return;
      const next = (index + by + FOLDERS.length) % FOLDERS.length;
      go({ sheet: FOLDERS[next].key, note: null });
    },
    [index, go],
  );

  // Left and right walk the presentations, the way they walk a slide deck.
  useEffect(() => {
    if (!open || !folder || note) return;
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "Escape") go({ sheet: null, note: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, folder, note, step, go]);

  /* Cmd/Ctrl+F focuses the search field, as in Finder. */
  const field = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "f" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      field.current?.focus();
      field.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* Search covers all modules, on the wall and in the drawer. */
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const match = (...parts: (string | undefined)[]) =>
      parts.some((p) => (p ?? "").toLowerCase().includes(q));
    return {
      folders: FOLDERS.filter((f) => {
        const m = MODULE_BY_KEY.get(f.key);
        return match(f.label, m?.name, m?.purpose, m?.group);
      }),
      rest: REST.filter((m) => match(m.name, m.purpose)),
    };
  }, [query]);

  const title = useMemo(() => {
    if (folder) return folder.label;
    if (pane === "gator") return "Gator";
    if (pane === "legal") return "Legal";
    return "Modules";
  }, [folder, pane]);

  // The highlight follows the row you are on; with a search open, no row is.
  useLayoutEffect(() => {
    const nav = sideRef.current;
    if (!nav) return;
    const place = () => {
      const row = nav.querySelector<HTMLElement>('.g-side-row[data-current="true"]');
      if (!row) {
        nav.dataset.lit = "false";
        return;
      }
      nav.style.setProperty("--blob-y", `${row.offsetTop}px`);
      nav.style.setProperty("--blob-h", `${row.offsetHeight}px`);
      nav.dataset.lit = "true";
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(nav);
    return () => watch.disconnect();
  }, [pane, query]);

  const goPane = (next: Pane) =>
    go({ pane: next, sheet: null, note: null, picked: null });

  return (
    <>
      {/* The sentinel. Not a control and not content: it is the mark on the
          runway that says the window has arrived. */}
      <div className="g-mac-trip" ref={trip} aria-hidden="true" />

      {/* The parked window as a control: everything inside is `inert` until it
         is up, so this button in the window's shape (outside the inert part,
         following it up) scrolls the page to where the window is open. */}
      <button
        className="g-mac-grip"
        type="button"
        data-open={open ? "true" : "false"}
        onClick={onRequestOpen}
        disabled={open || !onRequestOpen}
        aria-label="Open Explore Gator"
        tabIndex={-1}
      />

      <section
        className="g-mac"
        data-open={open ? "true" : "false"}
        data-full={full ? "true" : "false"}
        aria-label="Explore Gator"
        /* Parked, the window is off the page in every sense: nothing in it
           takes focus and nothing in it is announced. */
        inert={!open}
      >
        {/* Dims the parked window, as operating systems dim inactive windows,
           and clears as it rises. The shape and chrome stay legible so it still
           looks pressable. One flat layer, so nothing behind it re-rasterises. */}
        <div className="g-mac-shade" aria-hidden="true" />
        {/* ------------------------------------------------------- the Mac */}
        <div className="g-mac-desktop">
          {/* The title bar: one band in zones (history, tabs, tools, window
             controls), every control the same height. */}
          <header className="g-win-bar g-mac-bar">
            {/* The mark over the sidebar, where the dashboard keeps it. */}
            <span className="g-mac-brand" aria-hidden="true">
              <GatorLogo size={22} />
            </span>
            {/* Back and forward: two plain glyphs, each disabled when there is
               nothing on that side. */}
            <span
              className="g-bar-zone g-mac-steps"
              hidden={past.length === 0 && future.length === 0}
              role="group"
              aria-label="History"
            >
              <button
                type="button"
                onClick={back}
                aria-label="Back"
                disabled={past.length === 0}
              >
                <IconChevronLeft size={18} stroke={2} />
              </button>
              <button
                type="button"
                onClick={forward}
                aria-label="Forward"
                disabled={future.length === 0}
              >
                <IconChevronRight size={18} stroke={2} />
              </button>
            </span>

            <div
              ref={drag.stripRef as React.Ref<HTMLDivElement>}
              className="g-bar-zone g-tab-strip"
              data-dragging={drag.dragging === null ? "false" : "true"}
              role="tablist"
              aria-label="Open tabs"
            >
              {tabs.map((tab) => {
                const { label, moduleKey } = nameOf(tab.here);
                const on = tab.id === active;
                return (
                  <span
                    className="g-tab"
                    data-tab={tab.id}
                    data-on={on ? "true" : "false"}
                    data-drag={drag.dragging === tab.id ? "true" : "false"}
                    style={{ transform: `translateX(${drag.shift(tab.id)}px)` }}
                    key={tab.id}
                  >
                    <button
                      className="g-tab-hit"
                      type="button"
                      role="tab"
                      aria-selected={on}
                      {...drag.handleProps(tab.id)}
                      onClick={() => {
                        /* A dragged tab was not clicked, though the browser
                           fires a click on pointerup over the same tab. */
                        if (drag.dragged()) return;
                        goTab(tab.id);
                      }}
                    >
                      {moduleKey ? (
                        <ModuleGlyph
                          className="g-tab-glyph"
                          moduleKey={moduleKey}
                          size={15}
                          weight={2}
                        />
                      ) : (
                        <GatorLogo size={14} />
                      )}
                      <span className="g-tab-label">{label}</span>
                    </button>
                    {tabs.length > 1 ? (
                      <button
                        className="g-tab-x"
                        type="button"
                        onClick={() => closeTab(tab.id)}
                        aria-label={`Close ${label}`}
                      >
                        <IconX size={13} stroke={2.2} />
                      </button>
                    ) : null}
                  </span>
                );
              })}
              {/* The add-tab button sits at the end of the strip, as in every
                 browser, and disappears at six tabs. */}
              {tabs.length < MAX_TABS ? (
                <button
                  className="g-tab-new"
                  type="button"
                  onClick={newTab}
                  aria-label="New tab"
                >
                  <IconPlus size={15} stroke={2.2} />
                </button>
              ) : null}
            </div>

            {/* How the wall is drawn, and the field that searches it. */}
            <span className="g-bar-zone g-mac-tools">
              <button
                type="button"
                className="g-window-options"
                aria-label="Window options"
                aria-pressed={tools}
                onClick={() => setTools((v) => !v)}
              >
                <IconDots size={18} />
              </button>
              {tools && !folder && pane === "modules" ? (
                <span
                  className="g-mac-seg"
                  data-at={grid ? "0" : "1"}
                  role="group"
                  aria-label="View"
                >
                  <button
                    type="button"
                    onClick={() => setGrid(true)}
                    aria-pressed={grid}
                    aria-label="Icon view"
                    data-on={grid ? "true" : "false"}
                  >
                    <IconLayoutGrid size={17} stroke={1.9} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrid(false)}
                    aria-pressed={!grid}
                    aria-label="List view"
                    data-on={grid ? "false" : "true"}
                  >
                    <IconList size={17} stroke={1.9} />
                  </button>
                </span>
              ) : null}

              <span className="g-mac-search">
                <IconSearch size={15} stroke={2} />
                <input
                  ref={field}
                  type="search"
                  value={query}
                  placeholder="Search"
                  aria-label="Search modules"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (event.target.value) goPane("modules");
                  }}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <IconX size={14} stroke={2.2} />
                  </button>
                ) : null}
              </span>
            </span>

            {/* Window controls as quiet glyphs that get a squircle on hover;
               close takes the danger colour. */}
            <span className="g-bar-zone g-win-acts">
              <button
                className="g-win-act"
                type="button"
                onClick={onRequestClose}
                aria-label="Minimise"
                hidden={!tools}
              >
                <IconMinus size={16} stroke={2} />
              </button>
              <button
                className="g-win-act"
                type="button"
                onClick={() => setFull((v) => !v)}
                aria-label={full ? "Exit full screen" : "Fill the screen"}
                aria-pressed={full}
              >
                {full ? (
                  <IconMinimize size={15} stroke={2} />
                ) : (
                  <IconMaximize size={15} stroke={2} />
                )}
              </button>
              <button
                className="g-win-act g-win-act-close"
                type="button"
                onClick={onRequestClose}
                aria-label="Close"
              >
                <IconX size={16} stroke={2} />
              </button>
            </span>
          </header>

          <div className="g-mac-body">
            <nav className="g-mac-side" aria-label="Sections" ref={sideRef}>
              <span className="g-side-blob" aria-hidden="true" />
              <h2>Gator</h2>
              {SIDEBAR.map(({ key, label, Icon, href }) =>
                href ? (
                  <a
                    className="g-side-row"
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon size={18} stroke={1.8} />
                    <span className="g-side-label">{label}</span>
                    <IconArrowUpRight
                      size={14}
                      stroke={2}
                      className="g-side-out"
                    />
                  </a>
                ) : (
                  <button
                    className="g-side-row"
                    key={key}
                    type="button"
                    data-current={pane === key && !query ? "true" : "false"}
                    onClick={() => {
                      setQuery("");
                      goPane(key as Pane);
                    }}
                  >
                    <Icon size={18} stroke={1.8} />
                    <span className="g-side-label">{label}</span>
                  </button>
                ),
              )}
            </nav>

            {/* The pane's contents slide in from the side they came from (right
               going in, left coming back). The `key` on the place makes this
               work for folder-to-folder steps too, which otherwise keep
               `ModuleSheet` mounted with new props and would not animate. */}
            <div className="g-mac-pane" ref={paneRef}>
              <div
                className="g-pane-place"
                key={`${pane}:${sheet ?? ""}:${query ? "q" : ""}`}
                data-dir={dir}
              >
              {hits ? (
                <SearchResults
                  hits={hits}
                  query={query}
                  onOpen={(key) => {
                    setQuery("");
                    go({ sheet: key, note: null });
                  }}
                />
              ) : folder ? (
                <ModuleSheet
                  folder={folder}
                  onOpen={(key) => go({ sheet: key, note: null })}
                />
              ) : pane === "modules" ? (
                <ModuleWall
                  grid={grid}
                  picked={picked}
                  onPick={pick}
                  onOpen={(key) => go({ sheet: key, note: null })}
                />
              ) : pane === "gator" ? (
                <Desk
                  lede="The story behind Gator."
                  files={[GATOR_FILE]}
                  onOpen={(file) => go({ note: file })}
                />
              ) : (
                <Desk
                  lede="The full documents are pages on this site."
                  files={LEGAL_FILES}
                  onOpen={(file) => go({ note: file })}
                />
              )}
              </div>
            </div>
          </div>

          <footer className="g-mac-foot">
            {folder ? (
              <>
                <button
                  className="g-foot-step"
                  type="button"
                  onClick={() => step(-1)}
                >
                  <IconArrowLeft size={16} stroke={2} />
                  {FOLDERS[(index - 1 + FOLDERS.length) % FOLDERS.length].label}
                </button>
                <span className="g-mac-path">
                  {index + 1} of {FOLDERS.length}
                </span>
                <button
                  className="g-foot-step"
                  type="button"
                  onClick={() => step(1)}
                >
                  {FOLDERS[(index + 1) % FOLDERS.length].label}
                  <IconArrowRight size={16} stroke={2} />
                </button>
              </>
            ) : (
              <>
                <span className="g-mac-path">
                  Gator › {hits ? "Search" : title}
                </span>
                <span className="g-mac-path">
                  {hits
                    ? `${hits.folders.length + hits.rest.length} results`
                    : pane === "modules"
                      ? picked
                        ? `1 of ${FOLDERS.length} selected`
                        : `${FOLDERS.length} folders, ${REST.length} more inside`
                      : pane === "legal"
                        ? `${LEGAL_FILES.length} items`
                        : "1 item"}
                </span>
              </>
            )}
          </footer>

          {note ? <Notepad file={note} onClose={back} /> : null}
        </div>

        {/* ----------------------------------------------------- the phone */}
        {/* A separate component for the phone. Only one of the two is displayed,
           so the hidden one is not reachable by keyboard or screen reader. */}
        <IosFiles open={open} onRequestClose={onRequestClose} />
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ panes */

function Desk({
  lede,
  files,
  onOpen,
}: {
  lede: string;
  files: TextFile[];
  onOpen: (file: TextFile) => void;
}) {
  return (
    <div className="g-desk">
      <p className="g-pane-lede">{lede}</p>
      <div className="g-desk-items">
        {files.map((f) => (
          <FileTile file={f} key={f.key} onOpen={onOpen} />
        ))}
      </div>
      <p className="g-desk-hint">Click to open.</p>
    </div>
  );
}

function ModuleWall({
  grid,
  picked,
  onPick,
  onOpen,
}: {
  grid: boolean;
  picked: string | null;
  onPick: (key: string) => void;
  onOpen: (key: string) => void;
}) {
  return (
    <div className="g-wall">
      <p className="g-pane-lede">Inspired by the pros. Made for you.</p>

      {grid ? (
        <ModuleWallGrid picked={picked} onPick={onPick} onOpen={onOpen} />
      ) : (
        /* List view: columns with a header, one row per folder, in the wall's
           order. */
        <div className="g-list" role="table">
          <div className="g-list-head" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Group</span>
            <span role="columnheader">What it covers</span>
          </div>
          {FOLDERS.map((f) => {
            const m = MODULE_BY_KEY.get(f.key);
            return (
              <button
                className="g-list-row"
                key={f.key}
                type="button"
                role="row"
                style={{ ["--hue" as string]: f.hue }}
                data-selected={picked === f.key ? "true" : "false"}
                onClick={() => onPick(f.key)}
                onDoubleClick={() => onOpen(f.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(f.key);
                  }
                }}
              >
                <span className="g-list-name" role="cell">
                  <ModuleGlyph moduleKey={f.key} size={17} weight={2} />
                  {m?.name ?? f.label}
                </span>
                <span className="g-list-cell" role="cell">
                  {m?.group}
                </span>
                <span className="g-list-cell" role="cell">
                  {m?.purpose}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* The gesture hint sits under the wall. */}
      <p className="g-wall-foot">
        <span>Click a card to explore.</span>
        <span>Hold to rearrange, or use Alt + arrow keys.</span>
      </p>

      {/* The sixteen modules not on the wall, as smaller tiles in the wall's
         style, without hue or ghost mark. */}
      <details className="g-drawer">
        <summary>
          <span className="g-drawer-word">
            And {REST.length} more, there when you want them
          </span>
        </summary>
        <ul className="g-drawer-grid">
          {REST.map((m) => (
            <li className="g-drawer-tile" key={m.key}>
              <ModuleGlyph
                className="g-drawer-glyph"
                moduleKey={m.key}
                size={16}
                weight={1.9}
              />
              <span className="g-drawer-name">{m.name}</span>
              <span className="g-drawer-purpose">{m.purpose}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/* Search results as a list, as Finder shows them, whatever view was active. */
function SearchResults({
  hits,
  query,
  onOpen,
}: {
  hits: { folders: typeof FOLDERS; rest: typeof REST };
  query: string;
  onOpen: (key: string) => void;
}) {
  const none = hits.folders.length === 0 && hits.rest.length === 0;
  if (none) {
    return (
      <div className="g-nothing">
        <p className="g-nothing-title">No Results</p>
        <p className="g-nothing-say">
          Nothing here matches “{query.trim()}”. All {MODULE_COUNT} modules are
          on in every server, so it may be under another name.
        </p>
      </div>
    );
  }

  return (
    <div className="g-wall">
      <p className="g-pane-lede">
        {hits.folders.length + hits.rest.length} of {MODULE_COUNT} modules match
        “{query.trim()}”.
      </p>

      <div className="g-list">
        <div className="g-list-head">
          <span>Name</span>
          <span>Group</span>
          <span>What it covers</span>
        </div>
        {hits.folders.map((f) => {
          const m = MODULE_BY_KEY.get(f.key);
          return (
            <button
              className="g-list-row"
              key={f.key}
              type="button"
              style={{ ["--hue" as string]: f.hue }}
              onClick={() => onOpen(f.key)}
            >
              <span className="g-list-name">
                <ModuleGlyph moduleKey={f.key} size={17} weight={2} />
                {m?.name ?? f.label}
              </span>
              <span className="g-list-cell">{m?.group}</span>
              <span className="g-list-cell">{m?.purpose}</span>
            </button>
          );
        })}
        {hits.rest.map((m) => (
          <div className="g-list-row g-list-row-flat" key={m.key}>
            <span className="g-list-name">
              <ModuleGlyph moduleKey={m.key} size={17} weight={2} />
              {m.name}
            </span>
            <span className="g-list-cell">{m.group}</span>
            <span className="g-list-cell">{m.purpose}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
