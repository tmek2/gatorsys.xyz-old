"use client";

/* Files, as iOS draws it: the landing window's content on a phone.

   A separate component rather than the Finder restyled, because the two
   platforms differ in structure, not just size: - The Finder has a history
   (back and forward across any panes); a phone has a navigation stack (push and
   pop, no forward). - iOS slides a pushed screen in from the trailing edge
   while the one underneath moves a quarter out and dims, which shows what Back
   will do. - An iOS navigation bar has a large title that lives in the scroller
   and collapses into a small title in the bar. - iOS presents a document as a
   sheet from the bottom edge with a grabber, not a second window.

   Both components are mounted and the stylesheet shows one, so there is no
   frame of the wrong platform on first paint and no shared state.

   Metrics from Apple's Human Interface Guidelines: 44pt navigation bar, 34pt
   bold large title, 17pt semibold inline title, 36pt search field, 32pt
   segmented control, 44pt minimum rows, 49pt tab bar with 25pt glyphs and 10pt
   labels, 16pt margins, nothing touchable under 44pt. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOCS_URL, SUPPORT_URL } from "@/config/site";
import { FOLDERS, MODULE_BY_KEY, MODULE_COUNT, REST } from "../modules";
import { GATOR_FILE, LEGAL_FILES, type TextFile } from "./content";
import { ModuleSheet } from "./module-sheet";
import {
  ArrowUpForward,
  BookClosed,
  ChevronLeft,
  ChevronRight,
  DocTextFill,
  EllipsisCircle,
  FolderFill,
  Lifepreserver,
  ListBullet,
  MagnifyingGlass,
  BuildingColumnsFill,
  SquareGrid2x2,
  SquareGridDashboard,
  XmarkCircleFill,
} from "./sf";
import { ModuleGlyph } from "./module-glyphs";

type Tab = "gator" | "modules" | "legal";

const TABS: { key: Tab; label: string; Icon: typeof FolderFill }[] = [
  { key: "gator", label: "Overview", Icon: DocTextFill },
  { key: "modules", label: "Browse", Icon: FolderFill },
  { key: "legal", label: "Legal", Icon: BuildingColumnsFill },
];

/* What the ten folders are, said once. Both views print it as their section's
   footnote, which is where iOS explains a list. */
const WALL_SAYS = `Explore ten modules below, or browse the full set of ${MODULE_COUNT}.`;

const TAB_TITLE: Record<Tab, string> = {
  gator: "Overview",
  modules: "Browse",
  legal: "Legal",
};

/* The two destinations that leave the app, behind the bar's ellipsis and at the
   bottom of the About tab. */
const ELSEWHERE = [
  {
    label: "Documentation",
    detail: "Setup and reference guides",
    href: DOCS_URL,
    Icon: BookClosed,
  },
  {
    label: "Support",
    detail: "Help and contact information",
    href: SUPPORT_URL,
    Icon: Lifepreserver,
  },
  {
    label: "Dashboard",
    detail: "Where the settings live",
    href: "/servers",
    Icon: SquareGridDashboard,
  },
];

export function IosFiles({
  open,
  onRequestClose,
}: {
  /** Whether the screen has arrived. Drives what is allowed to be focused. */
  open: boolean;
  onRequestClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("modules");
  /* The navigation stack: empty is the tab's root, one entry is a pushed
     folder. No forward. */
  const [stack, setStack] = useState<string[]>([]);
  const [note, setNote] = useState<TextFile | null>(null);
  const [query, setQuery] = useState("");
  const [grid, setGrid] = useState(true);
  const [menu, setMenu] = useState(false);
  /* Whether the large title has scrolled up under the bar. */
  const [collapsed, setCollapsed] = useState(false);

  const scroller = useRef<HTMLDivElement | null>(null);
  const topMark = useRef<HTMLDivElement | null>(null);

  const pushed = stack.length > 0;
  const folder = pushed
    ? (FOLDERS.find((f) => f.key === stack[0]) ?? null)
    : null;

  /* The large title collapses into the bar, driven by a sentinel at the top of
     the scroller (an observer, not a scroll handler: no scroll position is read
     in JavaScript). */
  useEffect(() => {
    const mark = topMark.current;
    const box = scroller.current;
    if (!mark || !box) return;
    const io = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { root: box, threshold: 1 },
    );
    io.observe(mark);
    return () => io.disconnect();
  }, [tab, pushed]);

  // A new screen starts at the top, the way a pushed screen does.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setCollapsed(false);
  }, [tab, stack]);

  /* Scrolling the page away keeps the tab, pushed folder, open document and
     search (`open` follows the page scroll and flips on any small scroll up).
     Only the bar's menu closes. */
  useEffect(() => {
    if (open) return;
    setMenu(false);
  }, [open]);

  const push = useCallback((key: string) => setStack([key]), []);
  const pop = useCallback(() => setStack([]), []);

  /* Escape pops one level (this screen is also reachable in a narrow desktop
     window). */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (note) setNote(null);
      else if (menu) setMenu(false);
      else if (pushed) pop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, note, menu, pushed, pop]);

  /* Search covers all modules, on the wall and in the drawer. */
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const folders = FOLDERS.filter((f) => {
      const m = MODULE_BY_KEY.get(f.key);
      return (
        f.label.toLowerCase().includes(q) ||
        (m?.name ?? "").toLowerCase().includes(q) ||
        (m?.purpose ?? "").toLowerCase().includes(q)
      );
    });
    const rest = REST.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.purpose.toLowerCase().includes(q),
    );
    return { folders, rest };
  }, [query]);

  const title = folder
    ? (MODULE_BY_KEY.get(folder.key)?.name ?? folder.label)
    : TAB_TITLE[tab];

  return (
    <div className="g-ios" data-pushed={pushed ? "true" : "false"}>
      {/* ----------------------------------------------------- navigation bar */}
      {/* The 44pt bar with three slots. The leading slot is the back chevron
         with the name of the screen underneath, as on iOS. */}
      <header
        className="g-ios-nav"
        data-collapsed={collapsed ? "true" : "false"}
      >
        <div className="g-ios-bar">
          <div className="g-ios-bar-lead">
            {pushed ? (
              <button className="g-ios-back" type="button" onClick={pop}>
                <ChevronLeft size={20} weight={2.6} />
                <span>{TAB_TITLE[tab]}</span>
              </button>
            ) : null}
          </div>

          {/* The inline title is always present and only shown once the large
             title passes under the bar, so the crossfade is a property change. */}
          <h2 className="g-ios-inline-title">{title}</h2>

          <div className="g-ios-bar-trail">
            <button
              className="g-ios-glyph-button"
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label="More"
              aria-expanded={menu}
            >
              <EllipsisCircle size={23} weight={1.9} />
            </button>
            <button
              className="g-ios-done"
              type="button"
              onClick={onRequestClose}
            >
              Done
            </button>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- the stack */}
      <div className="g-ios-stack">
        {/* The tab's root screen stays mounted under a pushed screen and slides
           a quarter of the way out. */}
        <div className="g-ios-screen g-ios-root" aria-hidden={pushed}>
          <div className="g-ios-scroll" ref={scroller} inert={pushed}>
            <div className="g-ios-top-mark" ref={topMark} aria-hidden="true" />

            <h1 className="g-ios-large-title">{TAB_TITLE[tab]}</h1>

            {/* The search field: 36pt, 10pt radius, iOS's in-content glass fill,
               and a clear button once there is text. */}
            {tab === "modules" ? (
              <div className="g-ios-search">
                <MagnifyingGlass size={16} weight={2.2} />
                <input
                  type="search"
                  value={query}
                  placeholder="Search modules"
                  aria-label="Search modules"
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                  <button
                    type="button"
                    className="g-ios-clear"
                    /* Opts out of the site's 44px tap floor (the button is 28pt
                       inside a 36pt field) and gets its target from a
                       pseudo-element; see ios.css. */
                    data-tap="inline"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <XmarkCircleFill size={17} />
                  </button>
                ) : null}
              </div>
            ) : null}

            {tab === "modules" ? (
              <BrowseRoot
                grid={grid}
                onGrid={setGrid}
                hits={hits}
                onOpen={push}
              />
            ) : tab === "gator" ? (
              <AboutRoot onOpen={setNote} />
            ) : (
              <LegalRoot onOpen={setNote} />
            )}
          </div>
        </div>

        {/* The pushed screen stays mounted so the slide has something to move,
           and is inert while off screen. */}
        <div className="g-ios-screen g-ios-detail" aria-hidden={!pushed}>
          <div className="g-ios-scroll" inert={!pushed}>
            {folder ? (
              <>
                <h1 className="g-ios-large-title g-ios-title-hidden">
                  {title}
                </h1>
                <ModuleSheet folder={folder} onOpen={push} />
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------- the tab bar */}
      <nav className="g-ios-tabs" aria-label="Sections">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className="g-ios-tab"
            data-current={tab === key ? "true" : "false"}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => {
              setTab(key);
              setStack([]);
            }}
          >
            <Icon size={25} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* ----------------------------------------------------------- the menu */}
      {menu ? <IosMenu onClose={() => setMenu(false)} /> : null}

      {/* ---------------------------------------------------------- the sheet */}
      {note ? <IosSheet file={note} onClose={() => setNote(null)} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- browse */

function BrowseRoot({
  grid,
  onGrid,
  hits,
  onOpen,
}: {
  grid: boolean;
  onGrid: (v: boolean) => void;
  hits: { folders: typeof FOLDERS; rest: typeof REST } | null;
  onOpen: (key: string) => void;
}) {
  if (hits) {
    const none = hits.folders.length === 0 && hits.rest.length === 0;
    return (
      <div className="g-ios-body">
        {none ? (
          /* iOS's empty result is a centred title and one line under it, in
             the secondary label colour, and nothing else on the screen. */
          <div className="g-ios-empty">
            <p className="g-ios-empty-title">No Results</p>
            <p className="g-ios-empty-say">
              Nothing here matches that. All {MODULE_COUNT} modules are on in
              every server, so it may be under another name.
            </p>
          </div>
        ) : (
          <>
            {hits.folders.length ? (
              <IosGroup caption="Modules">
                {hits.folders.map((f) => (
                  <ModuleRow key={f.key} folderKey={f.key} onOpen={onOpen} />
                ))}
              </IosGroup>
            ) : null}
            {hits.rest.length ? (
              <IosGroup
                caption="Also on"
                footnote="Enable the modules your community needs."
              >
                {hits.rest.map((m) => (
                  <div className="g-ios-row" key={m.key}>
                    <span className="g-ios-row-glyph g-ios-row-quiet">
                      <ModuleGlyph moduleKey={m.key} size={22} weight={1.9} />
                    </span>
                    <span className="g-ios-row-text">
                      <span className="g-ios-row-title">{m.name}</span>
                      <span className="g-ios-row-sub">{m.purpose}</span>
                    </span>
                  </div>
                ))}
              </IosGroup>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="g-ios-body">
      {/* The view switcher directly under the search field, as iOS orders
         controls before content: a real segmented control (32pt, tertiary-fill
         track, a raised pill that slides). The explanatory paragraph is the
         footnote under the grid. */}
      <div
        className="g-ios-seg"
        data-at={grid ? "0" : "1"}
        role="group"
        aria-label="View"
      >
        <span className="g-ios-seg-pill" aria-hidden="true" />
        <button
          type="button"
          data-tap="inline"
          data-on={grid ? "true" : "false"}
          aria-pressed={grid}
          onClick={() => onGrid(true)}
        >
          <SquareGrid2x2 size={17} weight={2} />
          Icons
        </button>
        <button
          type="button"
          data-tap="inline"
          data-on={grid ? "false" : "true"}
          aria-pressed={!grid}
          onClick={() => onGrid(false)}
        >
          <ListBullet size={17} weight={2} />
          List
        </button>
      </div>

      {grid ? (
        /* Files' icon grid: three across, glyph over name over group, centred.
           A tap opens. */
        <section className="g-ios-group">
          <h3 className="g-ios-cap">Modules</h3>
          <div className="g-ios-grid">
            {FOLDERS.map((f) => {
              const m = MODULE_BY_KEY.get(f.key);
              return (
                <button
                  className="g-ios-cell"
                  key={f.key}
                  type="button"
                  style={{ ["--hue" as string]: f.hue }}
                  onClick={() => onOpen(f.key)}
                >
                  <ModuleGlyph
                    className="g-ios-cell-ghost"
                    moduleKey={f.key}
                    size={68}
                    weight={1.3}
                  />
                  <ModuleGlyph
                    className="g-ios-cell-glyph"
                    moduleKey={f.key}
                    size={19}
                    weight={1.9}
                  />
                  <span className="g-ios-cell-name">{f.label}</span>
                  <span className="g-ios-cell-say">{m?.purpose}</span>
                </button>
              );
            })}
          </div>
          <p className="g-ios-foot">{WALL_SAYS}</p>
        </section>
      ) : (
        <IosGroup caption="Modules" footnote={WALL_SAYS}>
          {FOLDERS.map((f) => (
            <ModuleRow key={f.key} folderKey={f.key} onOpen={onOpen} />
          ))}
        </IosGroup>
      )}

      <IosGroup
        caption={`${REST.length} more`}
        footnote="Enable the modules your community needs."
      >
        {REST.map((m) => (
          <div className="g-ios-row" key={m.key}>
            <span className="g-ios-row-glyph g-ios-row-quiet">
              <ModuleGlyph moduleKey={m.key} size={22} weight={1.9} />
            </span>
            <span className="g-ios-row-text">
              <span className="g-ios-row-title">{m.name}</span>
              <span className="g-ios-row-sub">{m.purpose}</span>
            </span>
          </div>
        ))}
      </IosGroup>
    </div>
  );
}

function ModuleRow({
  folderKey,
  onOpen,
}: {
  folderKey: string;
  onOpen: (key: string) => void;
}) {
  const f = FOLDERS.find((x) => x.key === folderKey);
  const m = MODULE_BY_KEY.get(folderKey);
  if (!f) return null;
  return (
    <button
      className="g-ios-row g-ios-row-tap"
      type="button"
      style={{ ["--hue" as string]: f.hue }}
      onClick={() => onOpen(f.key)}
    >
      {/* Naked, in the folder's own colour — the same mark the card on the
          grid carries, at the size a row has room for. */}
      <span className="g-ios-row-glyph">
        <ModuleGlyph moduleKey={f.key} size={21} weight={1.9} />
      </span>
      <span className="g-ios-row-text">
        <span className="g-ios-row-title">{m?.name ?? f.label}</span>
        <span className="g-ios-row-sub">{m?.group}</span>
      </span>
      <ChevronRight size={15} weight={2.5} className="g-ios-row-chev" />
    </button>
  );
}

/* ------------------------------------------------------------------ about */

function AboutRoot({ onOpen }: { onOpen: (file: TextFile) => void }) {
  return (
    <div className="g-ios-body">
      <IosGroup footnote="How the dashboard works.">
        <FileRow file={GATOR_FILE} onOpen={onOpen} />
      </IosGroup>

      <IosGroup caption="Elsewhere">
        {ELSEWHERE.map(({ label, detail, href, Icon }) => (
          <a
            className="g-ios-row g-ios-row-tap"
            key={label}
            href={href}
            target={href.startsWith("/") ? undefined : "_blank"}
            rel={href.startsWith("/") ? undefined : "noreferrer"}
          >
            <span className="g-ios-row-glyph g-ios-row-tint">
              <Icon size={24} />
            </span>
            <span className="g-ios-row-text">
              <span className="g-ios-row-title">{label}</span>
              <span className="g-ios-row-sub">{detail}</span>
            </span>
            {href.startsWith("/") ? (
              <ChevronRight size={15} weight={2.5} className="g-ios-row-chev" />
            ) : (
              <ArrowUpForward
                size={15}
                weight={2.3}
                className="g-ios-row-chev"
              />
            )}
          </a>
        ))}
      </IosGroup>
    </div>
  );
}

function LegalRoot({ onOpen }: { onOpen: (file: TextFile) => void }) {
  return (
    <div className="g-ios-body">
      <IosGroup footnote="The full documents are pages on this site.">
        {LEGAL_FILES.map((f) => (
          <FileRow key={f.key} file={f} onOpen={onOpen} />
        ))}
      </IosGroup>
    </div>
  );
}

function FileRow({
  file,
  onOpen,
}: {
  file: TextFile;
  onOpen: (file: TextFile) => void;
}) {
  const bytes = file.lines.reduce((n, line) => n + line.length + 1, 0);
  return (
    <button
      className="g-ios-row g-ios-row-tap"
      type="button"
      onClick={() => onOpen(file)}
    >
      <span className="g-ios-row-glyph g-ios-row-doc">
        <DocTextFill size={28} />
      </span>
      <span className="g-ios-row-text">
        <span className="g-ios-row-title">{file.name}</span>
        <span className="g-ios-row-sub">
          Plain Text · {(bytes / 1024).toFixed(1)} KB
        </span>
      </span>
      <ChevronRight size={15} weight={2.5} className="g-ios-row-chev" />
    </button>
  );
}

/* ------------------------------------------------------------- primitives */

/* A grouped list: a caption, a rounded container and a grey footnote. */
function IosGroup({
  caption,
  footnote,
  children,
}: {
  caption?: string;
  footnote?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="g-ios-group">
      {caption ? <h3 className="g-ios-cap">{caption}</h3> : null}
      <div className="g-ios-box">{children}</div>
      {footnote ? <p className="g-ios-foot">{footnote}</p> : null}
    </section>
  );
}

/* The ellipsis menu: since iOS 14 a plain rounded card under the button with
   44pt rows and hairlines (label leading, symbol trailing), over a scrim that
   takes the next tap. */
function IosMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="g-ios-menu-layer">
      <button
        className="g-ios-menu-scrim"
        type="button"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className="g-ios-menu" role="menu">
        {ELSEWHERE.map(({ label, href, Icon }) => (
          <a
            className="g-ios-menu-row"
            key={label}
            role="menuitem"
            href={href}
            target={href.startsWith("/") ? undefined : "_blank"}
            rel={href.startsWith("/") ? undefined : "noreferrer"}
            onClick={onClose}
          >
            <span>{label}</span>
            <Icon size={20} />
          </a>
        ))}
      </div>
    </div>
  );
}

/* Reflows a hard-wrapped text file for a phone. The files wrap at about 64
   characters, which on a phone would soft-wrap again into long lines followed
   by orphans. A line joins the one above only if that line was full (at least
   50 characters): a short line ended because the author ended it (a heading or
   a paragraph end). Every heading in both files is under 22 characters and
   every wrapped line over 54, so the threshold is safe. Blank lines stay, and
   indented lines (the numbered items) are kept as written. The Mac window shows
   the hard wrap as is. */
const FULL_LINE = 50;

function reflow(lines: string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length) out.push(run.join(" "));
    run = [];
  };
  for (const line of lines) {
    if (line.trim() === "" || /^\s/.test(line)) {
      flush();
      out.push(line);
      continue;
    }
    // Only a line that ran out of room was wrapped; a short one ended.
    if (run.length && (run.at(-1) as string).length < FULL_LINE) flush();
    run.push(line.trim());
  }
  flush();
  return out;
}

/* The document sheet: up from the bottom edge, short of the top, dimming what
   is behind, with a grabber. Closes on the scrim, on Done and on Escape. */
function IosSheet({ file, onClose }: { file: TextFile; onClose: () => void }) {
  const frame = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    frame.current?.focus();
  }, []);

  return (
    <div className="g-ios-sheet-layer">
      <div className="g-ios-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="g-ios-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={file.name}
        tabIndex={-1}
        ref={frame}
      >
        <span className="g-ios-grabber" aria-hidden="true" />
        <header className="g-ios-sheet-bar">
          <span className="g-ios-sheet-title">{file.name}</span>
          <button className="g-ios-done" type="button" onClick={onClose}>
            Done
          </button>
        </header>
        <div className="g-ios-sheet-body">
          <pre>{reflow(file.lines).join("\n")}</pre>
          {file.source ? (
            <a className="g-ios-sheet-link" href={file.source.href}>
              {file.source.label}
              <ChevronRight size={14} weight={2.5} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
