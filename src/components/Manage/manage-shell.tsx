"use client";

/* The dashboard shell.

   One window with one bar: the window's title bar holds the mark, the open
   server, and the site's own search, appearance and account controls
   (`CommandPalette`, `ThemeToggle`, the mark, the profile chip) at the Finder's
   measurements.

   The window fills the viewport and does not scroll; the rail and pane scroll
   inside it, so the chrome never moves. */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconChevronDown,
  IconSelector,
  IconLayoutSidebar,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react";
import { createPortal, flushSync } from "react-dom";
import { useSession } from "next-auth/react";
import { isLive } from "@/utils/viewer";
import { CoachMark, HoverTip, TitleTips } from "./hover-tip";
import { ManageProvider, useManage } from "./manage-context";
import { isModuleEnabled } from "./module-status";
import { SaveBar } from "./save-bar";
import { fieldAt, findSection, MODULE_TOGGLES } from "./schema";
import { SchemaSection } from "./schema-section";
import { OverviewSection } from "./sections/overview";
import { ModulesSection } from "./sections/modules";
import { AuditSection } from "./sections/audit";
import { CustomizationSection } from "./sections/customization";
import { AutoResponseSection } from "./sections/auto-response";
import { ConnectionRolesSection } from "./sections/connection-roles";
import { DailyQuestionsSection } from "./sections/daily-questions";
import { PermissionsSection } from "./sections/permissions";
import { RobloxSection } from "./sections/roblox";
import { NAV_GROUPS } from "./nav-groups";
import { travel, warmTrip } from "@/utils/travel";
import { burstFrom } from "@/components/site/burst";
import { usePresence } from "@/components/motion";
import { auditByTab as splitByTab, auditConfig, type AuditItem } from "./config-audit";
import { useSafeOutsidePress } from "./safe-area";
import { useDragDismiss } from "./drag-dismiss";
import { PhoneDock } from "./phone-dock";
import { SectionIdentityContext } from "./section-identity";
import { AppLogo } from "@/components/site/app-logo";
import {
  CommandPalette,
  type PaletteEntry,
} from "@/components/site/command-palette";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { resolveAutoTheme } from "@/components/site/theme";
import "./register-properties";
import { ServerPicker, initials } from "./server-picker";
import {
  useCommunityNavigation,
  communityTransition,
} from "@/components/servers/community-navigation";
/* The site's tokens and header styles, in that order. The palette (`--mac-*`,
   `--g-*`, both themes) is declared once in tokens.css. */
import "@/components/site/tokens.css";
import "@/components/site/landing.css";
// The manage palette, stated once over the layered duplicates in globals.css.
import "./manage-restyle.css";
// The elevate pass — editorial type, warmer hues, richer motion.
import "./manage-elevate.css";
// The window. Last, because it owns the frame and those two own the pane.
import "./manage-window.css";

/** What a tab looks like while its chunk is still downloading. */
/* A tab's loading state is shaped like the page it becomes (title, line,
   settings rows), so nothing moves when it loads. */
function SectionLoading() {
  return (
    <div className="gw-skel" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <span className="gw-skel-bar gw-skel-title" aria-hidden="true" />
      <span className="gw-skel-bar gw-skel-say" aria-hidden="true" />
      <div className="gw-skel-panel" aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <div className="gw-skel-row" key={row}>
            <span className="gw-skel-label">
              <span className="gw-skel-bar" />
              <span className="gw-skel-bar" />
            </span>
            <span className="gw-skel-bar gw-skel-control" />
          </div>
        ))}
      </div>
    </div>
  );
}

const GatorAiSection = dynamic(
  () => import("./sections/gator-ai").then((module) => module.GatorAiSection),
  { ssr: false, loading: () => <SectionLoading /> },
);
const TicketsSection = dynamic(
  () => import("./sections/tickets").then((module) => module.TicketsSection),
  { loading: () => <SectionLoading /> },
);
const WorkflowWorkspace = dynamic(
  () => import("./workflow/workflow-workspace").then(module => module.WorkflowWorkspace),
  { loading: () => <SectionLoading /> },
);
const ResourcesSection = dynamic(
  () => import("./sections/resources").then((module) => module.ResourcesSection),
  { loading: () => <SectionLoading /> },
);
const CustomCommandsSection = dynamic(
  () => import("./sections/custom-commands").then((module) => module.CustomCommandsSection),
  { loading: () => <SectionLoading /> },
);
const SessionsSection = dynamic(
  () => import("./sections/sessions").then((module) => module.SessionsSection),
  { loading: () => <SectionLoading /> },
);

const SECTION_LABELS: Record<string, string> = {};
const SECTION_GROUPS: Record<string, string> = {};
const SECTION_ICONS: Record<string, React.ReactNode> = {};
/** The rail, top to bottom: which way a tab change goes. */
const NAV_ORDER: string[] = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id));
for (const group of NAV_GROUPS) {
  for (const item of group.items) {
    SECTION_LABELS[item.id] = item.label;
    SECTION_GROUPS[item.id] = group.title ?? "Settings";
    SECTION_ICONS[item.id] = item.icon;
  }
}

/* Two content widths, chosen by tab. Settings tabs are a centred column; these
   tabs (tables, walls, editors) use a wider cap. By section name rather than
   `:has()` on the content, which loads late and would make the column jump. */
/** The blocked-navigation marker for the mark's trip home. */
const HOME = "__home";

const WIDE_TABS = new Set([
  "overview",
  "modules",
  "audit",
  "workflows",
  "automations",
  "resources",
  "prc",
]);

function measureOf(section: string): "wide" | "column" {
  return WIDE_TABS.has(section) ? "wide" : "column";
}

function SectionBody({
  section,
  onNavigate,
}: {
  section: string;
  onNavigate: (next: string) => void;
}) {
  switch (section) {
    case "overview":
      return <OverviewSection onNavigate={onNavigate} />;
    case "modules":
      return <ModulesSection onNavigate={onNavigate} />;
    case "audit":
      return <AuditSection />;
    case "customization":
      return <CustomizationSection />;
    case "workflows":
    case "automations":
      return <WorkflowWorkspace />;
    case "resources":
      return <ResourcesSection />;
    case "auto-response":
      return <AutoResponseSection onNavigate={onNavigate} />;
    case "connection-roles":
      return <ConnectionRolesSection onNavigate={onNavigate} />;
    case "daily-questions":
      return <DailyQuestionsSection onNavigate={onNavigate} />;
    case "tickets":
      return <TicketsSection onNavigate={onNavigate} />;
    case "ai":
      return <GatorAiSection onNavigate={onNavigate} />;
    case "custom-commands":
      return <CustomCommandsSection />;
    case "permissions":
      return <PermissionsSection />;
    case "roblox":
      return <RobloxSection />;
    case "sessions":
      return <SessionsSection onNavigate={onNavigate} />;
    default: {
      const schema = findSection(section);
      if (schema) return <SchemaSection section={schema} onNavigate={onNavigate} />;
      return <OverviewSection onNavigate={onNavigate} />;
    }
  }
}

/* ── the server tab ──

   The server drawn as the window's open document. Pressing it opens the picker
   (server-picker.tsx). */
function ServerTab() {
  const { meta, guildId } = useManage();
  const { community } = useCommunityNavigation();
  /* The card clicked on /servers, if still arriving from it: its name and art
     show before the bot answers. */
  const arriving = community?.id === guildId ? community : null;
  const identity = meta?.guild ?? arriving;
  const [open, setOpen] = useState(false);
  const tab = useRef<HTMLButtonElement | null>(null);
  /* Opens on pointer down, like a native menu; the click still toggles for the
     keyboard and is ignored after a press. */
  const pressed = useRef(false);

  return (
    <>
      {/* The switcher is new, and a tab that opens a panel does not look like
          one until you have pressed it once. */}
      <CoachMark
        id="server-switcher"
        tip="Switch server"
        side="bottom"
        align="start"
        suppress={open}
        className="gw-tab-coach"
      >
      <button
        ref={tab}
        type="button"
        className="gw-tab"
        data-open={open ? "true" : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pressed.current = true;
          // The blur layer is already on the page, hidden; the press starts it
          // directly so it moves on the next frame.
          if (!open) {
            // Shaped to the page first -- the rail may have moved it since
            // the picker last looked -- then shown, all on this frame.
            window.dispatchEvent(new Event("gw-pick-arm"));
            document.querySelector<HTMLElement>(".gw-pick-layer")?.setAttribute("data-open", "true");
          }
          // As a transition, so the browser paints that first frame before
          // React spends any time on the panel.
          React.startTransition(() => setOpen((current) => !current));
        }}
        onClick={() => {
          if (pressed.current) {
            pressed.current = false;
            return;
          }
          setOpen((current) => !current);
        }}
      >
        {identity?.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="gw-tab-art"
            src={identity.icon}
            alt=""
            style={{ viewTransitionName: communityTransition(guildId) }}
          />
        ) : (
          <span
            className="gw-tab-art"
            aria-hidden="true"
            style={{ viewTransitionName: communityTransition(guildId) }}
          >
            {identity?.name ? initials(identity.name) : "··"}
          </span>
        )}
        <span className="gw-tab-name">{identity?.name ?? "Loading"}</span>
        <IconChevronDown className="gw-tab-chev" size={14} stroke={2.2} />
      </button>
      </CoachMark>

      <ServerPicker
        anchor={tab}
        open={open}
        onClose={() => setOpen(false)}
        currentId={guildId}
      />
    </>
  );
}

/* ── what needs fixing ──

   Walks the whole config for settings pointing at deleted channels or roles.
   The count per tab is on that tab's rail row, the total is in the status
   strip, and the panel lists what. */
function HealthButton({
  items,
  onGo,
}: {
  items: AuditItem[];
  onGo: (section: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Held for its exit animation, like every panel in the window.
  const presence = usePresence(open, { duration: 160 });
  const chip = useRef<HTMLButtonElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  /* Not `!box.contains(target)`: the gap between the chip and the panel is
     outside both, and a press there is on the way to the panel. See
     safe-area.ts. */
  useSafeOutsidePress({
    open,
    anchor: chip,
    panel: box,
    onPress: () => setOpen(false),
  });

  if (!items.length) return null;
  /* Broken first. A chip with nothing broken in it is a to-do list, and says
     so in pink rather than amber. */
  const gone = items.filter((item) => item.kind === "gone");
  const ordered = [...gone, ...items.filter((item) => item.kind !== "gone")];
  const broken = gone.length > 0;

  return (
    <div className="gw-health">
      <HoverTip
        side="top"
        align="end"
        suppress={open}
        label={
          broken
            ? "Settings that point at a deleted channel or role"
            : "Modules waiting for a channel to post to"
        }
      >
        <button
          ref={chip}
          type="button"
          className="gw-health-chip"
          data-tone={broken ? undefined : "todo"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {broken ? <IconAlertTriangle size={12} stroke={2.2} /> : null}
          {broken ? `${gone.length} to fix` : `${items.length} to set up`}
        </button>
      </HoverTip>
      {presence.mounted ? (
        <div className="gw-health-panel" ref={box} data-enter={presence.state}>
          <div className="gw-health-list">
            {ordered.slice(0, 12).map((item, index) => (
              <button
                key={`${item.section}-${item.label}-${index}`}
                type="button"
                className="gw-health-row"
                onClick={() => {
                  setOpen(false);
                  onGo(item.section);
                }}
              >
                <span className="gw-health-say">
                  <span className="gw-health-label">{item.label}</span>
                  <span className="gw-health-where">{item.sectionLabel}</span>
                </span>
                <span className="gw-health-tag" data-kind={item.kind}>
                  {item.tag}
                </span>
                <IconArrowRight size={13} className="gw-health-go" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── the tab list on a phone ──

   No rail on a phone: the row under the title bar names the current tab, and
   pressing it opens the list as a bottom sheet (the landing's sheet metrics:
   36×5 grabber, 14 radius, 56px rows, 44px minimum targets). Pull down to
   dismiss. */
function TabSheet({
  open,
  onClose,
  section,
  onGo,
  enabled,
}: {
  open: boolean;
  onClose: () => void;
  section: string;
  onGo: (next: string) => void;
  enabled: (item: { moduleKey?: string; alwaysEnabled?: boolean }) => boolean;
}) {
  const presence = usePresence(open, { duration: 280 });
  const sheet = useRef<HTMLDivElement | null>(null);
  const pull = useDragDismiss<HTMLDivElement>({ onDismiss: onClose });

  /* Escape closes it, and focus goes inside when it opens — a sheet you can
     open from the keyboard and not leave is a trap. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    /* Scrolls to the open tab, not the first row (a comma selector list matches
       in document order, which was always Overview). */
    const id = window.setTimeout(() => {
      const here =
        sheet.current?.querySelector<HTMLElement>('[data-current="true"]') ??
        sheet.current?.querySelector<HTMLElement>("button");
      here?.focus({ preventScroll: true });
      here?.scrollIntoView({ block: "center" });
    }, 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  if (!presence.mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="gw-sheet-layer" data-enter={presence.state}>
      <button
        type="button"
        className="gw-sheet-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="gw-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        ref={(node) => {
          sheet.current = node;
          pull.target.current = node;
        }}
      >
        <div className="gw-sheet-pull" {...pull.handle}>
          <span className="gw-sheet-grab" aria-hidden="true" />
        </div>
        <div className="gw-sheet-list">
          {NAV_GROUPS.map((group) => (
            <div className="gw-sheet-group" key={group.title ?? "root"}>
              {group.title ? <p className="gw-caption">{group.title}</p> : null}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="gw-sheet-row"
                  data-current={section === item.id ? "true" : undefined}
                  data-off={enabled(item) ? undefined : "true"}
                  onClick={() => {
                    onClose();
                    onGo(item.id);
                  }}
                >
                  <span className="gw-row-icon">{item.icon}</span>
                  <span className="gw-row-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── the pun ──

   The mark in the corner of the status bar; it tells a joke when pressed. */
/**
 * One shake, via the Web Animations API rather than a class, so nothing is left
 * behind when it ends.
 */
function shakePane(node: HTMLElement | null) {
  if (!node || typeof node.animate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  node.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-9px)", offset: 0.15 },
      { transform: "translateX(8px)", offset: 0.3 },
      { transform: "translateX(-6px)", offset: 0.45 },
      { transform: "translateX(5px)", offset: 0.6 },
      { transform: "translateX(-3px)", offset: 0.75 },
      { transform: "translateX(0)" },
    ],
    { duration: 500, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
  );
}

/* ↑ ↑ ↓ ↓ ← → ← → B A, anywhere on the dashboard that is not a field. */



/** Whether a window has been shown in this visit yet (see the rail). */
let shellShown = false;

/** The rail as it was left: open or closed by choice, else open on a wide
 *  screen. */
function railWanted() {
  try {
    const stored = localStorage.getItem("gator-sidebar");
    return stored === "open" || (stored !== "closed" && window.matchMedia("(min-width: 1024px)").matches);
  } catch {
    return false;
  }
}

function ShellInner({
  sectionPath,
  onNavigate,
}: {
  sectionPath: string;
  onNavigate: (next: string) => void;
}) {
  const {
    meta,
    loading,
    error,
    forbidden,
    reload,
    value,
    dirty,
    saving,
    save,
    setNotice,
    refreshMeta,
    refreshingMeta,
    metaCooldown,
    undo,
    redo,
  } = useManage();
  const { data: sessionData } = useSession();
  const router = useRouter();
  const viewer = isLive(sessionData) ? sessionData?.user : undefined;
  /* Closed on the first, server-drawn render (the server cannot read the
     saved choice), then restored. A window drawn later in the same visit, as
     when switching server, starts with it, so the page it settles into is
     the one that stays. */
  const [rail, setRail] = useState(() => (shellShown ? railWanted() : false));
  // Bumped each time a navigation is blocked by unsaved changes; tells the save
  // prompt to flash.
  const [shakeSignal, setShakeSignal] = useState(0);
  const placeRef = useRef<HTMLDivElement | null>(null);
  /* Which server this window shows, on the window itself: switching server
     waits for it before the page settles in (server-picker.tsx). */
  const { guildId: shownGuild } = useManage();
  /** The tab a blocked navigation was aiming at, so asking twice gets through. */
  const blockedTargetRef = useRef<string | null>(null);
  const navBox = useRef<HTMLElement | null>(null);
  const pane = useRef<HTMLElement | null>(null);
  const [section] = sectionPath.split("/");
  /* Keeps the open tab's row in view when the tab changes (an inline ref
     callback would force layout on every render). */
  useEffect(() => {
    navBox.current
      ?.querySelector<HTMLElement>('.gw-row[data-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [section]);

  /* Blocks a tab change while there are unsaved edits, once: the first attempt
     shakes, a second attempt at the same tab goes and keeps the edits staged. */
  const guardedNavigate = useCallback(
    (next: string) => {
      if (dirty && next.split("/")[0] !== section) {
        if (blockedTargetRef.current !== next) {
          blockedTargetRef.current = next;
          setShakeSignal((current) => current + 1);
          shakePane(placeRef.current);
          setNotice({
            kind: "error",
            text: "Unsaved changes. Save, discard, or pick the tab again to leave.",
          });
          return;
        }
      }
      blockedTargetRef.current = null;
      onNavigate(next);
      if (
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width: 1024px)").matches
      ) {
        setRail(false);
      }
    },
    [dirty, onNavigate, section, setNotice],
  );

  /* Home as a view transition: the dashboard window shrinks into the window
     parked at the foot of the landing hero and the mark flies to the landing's
     logo, while the rest cross-fades. The pairing names exist only during the
     trip. Guarded like a tab change when there are unsaved edits. */
  const leaveHome = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (dirty && blockedTargetRef.current !== HOME) {
        event.preventDefault();
        blockedTargetRef.current = HOME;
        setShakeSignal((current) => current + 1);
        shakePane(placeRef.current);
        setNotice({
          kind: "error",
          text: "Unsaved changes. Save, discard, or press it again to leave.",
        });
        return;
      }
      blockedTargetRef.current = null;
      event.preventDefault();
      travel(router, "/", "home", () => Boolean(document.querySelector(".g-mac")));
    },
    [dirty, router, setNotice],
  );

  /* The two places the dashboard travels to, fetched while it is idle so the
     trip's animation does not wait on the network. */
  useEffect(() => {
    const warm = () => {
      warmTrip(router, "/");
      warmTrip(router, "/servers");
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(warm);
    else window.setTimeout(warm, 1500);
  }, [router]);

  // The pane is the scrolling box, so a tab change returns it to the top --
  // and on a phone, where the page itself scrolls, the page.
  useEffect(() => {
    pane.current?.scrollTo({ top: 0 });
    if (window.matchMedia("(max-width: 760px)").matches) window.scrollTo({ top: 0 });
  }, [sectionPath]);

  useEffect(() => {
    shellShown = true;
    setRail(railWanted());

  }, []);

  /* Cmd/Ctrl+S saves (instead of the browser's "save page as"). */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (dirty && !saving) void save(SECTION_LABELS[section] || "Overview");
      // A habit, pressed with nothing to save: say so rather than do nothing.
      else if (!dirty && !saving) setNotice({ kind: "saved", text: "Already saved.", id: "already-saved" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save, saving, section, setNotice]);

  /* The browser tab says when something here is unsaved, the way an editor's
     does: a dot before the title, gone once it is saved or discarded. */
  useEffect(() => {
    const base = document.title.replace(/^• /, "");
    document.title = dirty ? `• ${base}` : base;
  }, [dirty, section]);

  /* While a file is dragged anywhere over the window, every picture slot and
     upload tile shows it can take it, the one under the pointer most. A file
     dropped anywhere else is caught, so the browser does not open it in place
     of the dashboard (losing unsaved changes). */
  useEffect(() => {
    const root = document.documentElement;
    let depth = 0;
    const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types || []).includes("Files");
    const stop = () => {
      depth = 0;
      root.removeAttribute("data-file-drag");
    };
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth += 1;
      root.setAttribute("data-file-drag", "true");
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) root.removeAttribute("data-file-drag");
    };
    const over = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault();
      stop();
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    window.addEventListener("dragend", stop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
      window.removeEventListener("dragend", stop);
      stop();
    };
  }, []);

  /* Cmd/Ctrl+Z undoes the last settings change; Shift+Cmd/Ctrl+Z or Ctrl+Y
     redoes. Not while typing in a field (its own undo applies). One toast says
     what changed, since it may be on another tab. */
  useEffect(() => {
    function typing(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
      if (el.tagName !== "INPUT") return false;
      return !["checkbox", "radio", "button", "submit", "range", "color"].includes((el as HTMLInputElement).type);
    }
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const back = key === "z" && !event.shiftKey;
      const again = (key === "z" && event.shiftKey) || (key === "y" && !event.metaKey);
      if (!back && !again) return;
      if (typing(event.target)) return;
      event.preventDefault();
      const moved = back ? undo() : redo();
      if (!moved) {
        // Said, quietly, so a press is never met with nothing at all.
        setNotice({ kind: "saved", id: "gw-undo", text: back ? "Nothing to undo" : "Nothing to redo" });
        return;
      }
      const name = moved.length === 1 ? fieldAt(moved[0])?.label : undefined;
      setNotice({
        kind: "saved",
        id: "gw-undo",
        text: `${back ? "Undid" : "Redid"} ${name ? name : moved.length === 1 ? "a change" : `${moved.length} changes`}`,
        action: { label: back ? "Redo" : "Undo", run: () => (back ? redo() : undo()) },
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, setNotice]);

  function toggleRail() {
    setRail((current) => {
      try {
        localStorage.setItem("gator-sidebar", current ? "closed" : "open");
      } catch {}
      return !current;
    });
  }

  const activeLabel = SECTION_LABELS[section] || "Overview";
  const [sheet, setSheet] = useState(false);

  /* Walked once, read three ways: the strip says how many, the rail says which
     tabs, and the panel says what. */
  const audit = useMemo(() => auditConfig(value, meta), [value, meta]);
  const auditByTab = useMemo(() => splitByTab(audit), [audit]);
  const moduleOn = useCallback(
    (item: { moduleKey?: string; alwaysEnabled?: boolean }) =>
      item.moduleKey && !item.alwaysEnabled
        ? isModuleEnabled(value, item.moduleKey)
        : true,
    [value],
  );

  /* The rail's travelling highlight, measured against the scrolling list so it
     moves with it. */
  const [lit, setLit] = useState(false);
  useLayoutEffect(() => {
    const box = navBox.current;
    if (!box) return;
    const put = () => {
      const target = box.querySelector<HTMLElement>('[data-current="true"]');
      if (!target) {
        setLit(false);
        return;
      }
      box.style.setProperty("--blob-y", `${target.offsetTop}px`);
      box.style.setProperty("--blob-h", `${target.offsetHeight}px`);
      setLit(true);
    };
    put();
    const watch = new ResizeObserver(put);
    watch.observe(box);
    return () => watch.disconnect();
    /* Depends on the tab only, not the settings (which change on every edit);
       the rows do not move when a setting changes. */
  }, [section]);

  /* Every settings tab, in the one search. Two fields side by side, each
     covering half the product, is worse than one covering all of it. */
  const paletteRows: PaletteEntry[] = useMemo(
    () =>
      Object.keys(SECTION_LABELS).map((id) => ({
        id: `tab-${id}`,
        title: SECTION_LABELS[id],
        note: `${meta?.guild.name ?? "This server"} · ${SECTION_GROUPS[id]}`,
        href: "#",
        external: false,
        Icon: IconSettings,
        // Each tab's own icon, as in the rail and dock; no tag.
        icon: SECTION_ICONS[id],
        section: "This server",
        terms: `${id} settings tab ${SECTION_GROUPS[id]}`,
        run: () => guardedNavigate(id),
      })),
    [guardedNavigate, meta],
  );

  const modulesOn = useMemo(
    () => MODULE_TOGGLES.filter((module) => isModuleEnabled(value, module.key)).length,
    [value],
  );
  /* Turning on the last module is worth a moment: confetti from what was
     pressed (where the eyes are), and the counter in the strip pops to "All
     on". Only when it happens here: a server that arrives with everything on
     was not just finished. */
  const countRef = useRef<HTMLSpanElement | null>(null);
  const countSeen = useRef<number | null>(null);
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (loading) return;
    const before = countSeen.current;
    countSeen.current = modulesOn;
    if (before === null || before >= MODULE_TOGGLES.length || modulesOn !== MODULE_TOGGLES.length) return;
    const pressed = document.activeElement;
    const from = pressed instanceof HTMLElement && pressed !== document.body ? pressed : countRef.current;
    void burstFrom(from, { big: true });
    setCheer(true);
    const id = window.setTimeout(() => setCheer(false), 1400);
    return () => window.clearTimeout(id);
  }, [loading, modulesOn]);

  const chrome = (
    <div className="gw-bar">
      <div className="gw-zone">
        <HoverTip label="Bot" side="bottom" align="start">
          <Link
            className="gw-mark"
            href="/"
            aria-label="Bot"
            onClick={leaveHome}
            onPointerEnter={() => warmTrip(router, "/")}
            onFocus={() => warmTrip(router, "/")}
          >
            <AppLogo size={22} />
          </Link>
        </HoverTip>
        <ServerTab />
      </div>

      <div className="gw-zone" data-grow="true" />

      <div className="gw-zone">
        <CommandPalette
          signedIn={Boolean(viewer?.id)}
          extra={paletteRows}
          extraSection="this server"
          className="gw-find"
        />
        <HoverTip
          label={metaCooldown ? `Again in ${metaCooldown}s` : "Reload channels and roles"}
          side="bottom"
          align="end"
        >
          <button
            type="button"
            className="gw-icon"
            aria-label="Reload channels and roles"
            disabled={refreshingMeta || metaCooldown > 0}
            onClick={() => {
              void refreshMeta();
            }}
          >
            <IconRefresh size={15} className={refreshingMeta ? "gw-spin" : undefined} />
          </button>
        </HoverTip>
        <ThemeToggle />
        <HoverTip label={rail ? "Hide tabs" : "Show tabs"} side="bottom" align="end">
          <button
            type="button"
            className="gw-icon gw-rail-toggle"
            data-on={rail ? "true" : undefined}
            aria-label={rail ? "Hide tabs" : "Show tabs"}
            onClick={toggleRail}
          >
            <IconLayoutSidebar size={16} />
          </button>
        </HoverTip>
        <span className="gw-sep" aria-hidden="true" />
        <HoverTip label={viewer?.name ?? "Account"} side="bottom" align="end">
          <Link className="gw-face" href="/account" aria-label="Account">
            {viewer?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.image} alt="" />
            ) : (
              <span>{(viewer?.name ?? "A").slice(0, 1).toUpperCase()}</span>
            )}
          </Link>
        </HoverTip>
      </div>
    </div>
  );

  if (forbidden || error) {
    return (
      <div className="manage-root">
        <div className="gw" data-rail="false" data-guild={shownGuild}>
          {chrome}
          <div className="gw-stop">
            <Image src="/icon.svg" alt="" width={46} height={50} className="opacity-40" />
            <h2>{forbidden ? "No access to this server" : "Can't reach the bot"}</h2>
            <p>
              {forbidden
                ? "You need Manage Server or Administrator in this Discord server."
                : error}
            </p>
            <div className="gw-stop-acts">
              {forbidden ? null : (
                <button type="button" onClick={reload} className="btn-pop btn-peach h-9 px-4 text-sm">
                  Try again
                </button>
              )}
              <Link
                href="/servers"
                className={
                  forbidden
                    ? "btn-pop btn-peach h-9 px-4 text-sm leading-9"
                    : "gw-pick-act h-9 px-4 text-sm"
                }
              >
                All servers
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-root">
      <TitleTips />
      <div className="gw" data-rail={rail ? "true" : "false"} data-guild={shownGuild}>
        {chrome}

        <div className="gw-body">
          <aside className="gw-side" aria-label="Settings">
            <nav
              ref={navBox}
              className="gw-nav"
              data-lit={lit ? "true" : "false"}
              /* The rail is one tab stop: Tab reaches it, arrows walk it, Home
                 and End jump to its ends. */
              onKeyDown={(event) => {
                const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
                if (!keys.includes(event.key)) return;
                const rows = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(".gw-row"),
                );
                if (!rows.length) return;
                event.preventDefault();
                const at = rows.indexOf(document.activeElement as HTMLButtonElement);
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? rows.length - 1
                      : event.key === "ArrowDown"
                        ? (at + 1) % rows.length
                        : (at - 1 + rows.length) % rows.length;
                rows[next]?.focus();
              }}
            >
              <span className="gw-blob" aria-hidden="true" />
              {NAV_GROUPS.map((group) => (
                <div className="gw-group" key={group.title ?? "root"}>
                  {group.title ? <p className="gw-caption">{group.title}</p> : null}
                  {group.items.map((item) => {
                    const current = section === item.id;
                    /* `isModuleEnabled`, not `!== false`: a config with no
                       Modules key at all means every module is off. */
                    const on = moduleOn(item);
                    const broken = auditByTab[item.id]?.gone ?? 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="gw-row"
                        // Which tab, so its mark can move in its own way when
                        // it becomes the open one.
                        data-tab={item.id}
                        data-current={current ? "true" : undefined}
                        data-off={on ? undefined : "true"}
                        /* Only the open tab is in the tab order; the arrows
                           reach the rest. */
                        tabIndex={current ? 0 : -1}
                        onClick={() => guardedNavigate(item.id)}
                      >
                        <span className="gw-row-icon">{item.icon}</span>
                        <span className="gw-row-label">{item.label}</span>
                        {broken ? (
                          <span
                            className="gw-row-badge"
                            data-warn="true"
                            aria-label={`${broken} to fix`}
                          >
                            {broken}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>

          <main className="gw-pane manage-content" ref={pane}>
            {/* Keyed on the section so switching tabs re-runs the entrance. */}
            {/* Keyed on the section only; the blocked-navigation shake is played
               on this node as an event, not via the key or a lasting class
               (which remounted the tab and kept shaking). */}
            <div
              key={sectionPath}
              ref={placeRef}
              className="gw-place"
              data-measure={measureOf(section)}
              data-still={arrivedByTransition === sectionPath ? "true" : undefined}
            >
              {loading ? (
                <SectionLoading />
              ) : (
                <SectionIdentityContext.Provider
                  value={{ icon: SECTION_ICONS[section], group: SECTION_GROUPS[section] }}
                >
                  <SectionBody section={section} onNavigate={guardedNavigate} />
                </SectionIdentityContext.Provider>
              )}
            </div>
          </main>
        </div>

        <div className="gw-foot">
          {/* The breadcrumb, which also opens the tab list. Gone on a phone,
              where the row at the top does both. */}
          <button
            type="button"
            className="gw-path"
            onClick={() => setSheet(true)}
            aria-haspopup="dialog"
            aria-expanded={sheet}
          >
            <span className="gw-path-server">{meta?.guild.name ?? "Bot"}</span>
            <span className="gw-path-sep" aria-hidden="true" />
            <span className="gw-path-here">{activeLabel}</span>
            <IconSelector className="gw-path-chev" size={13} stroke={2.2} />
          </button>
          <span className="gw-foot-end">
            <HealthButton items={audit} onGo={guardedNavigate} />
            <span
              ref={countRef}
              className="gw-count"
              data-all={modulesOn === MODULE_TOGGLES.length ? "true" : undefined}
              data-cheer={cheer ? "true" : undefined}
            >
              {/* Every module on is a server using all of it, and gets said so. */}
              {modulesOn === MODULE_TOGGLES.length ? "All on" : `${modulesOn}/${MODULE_TOGGLES.length} on`}
            </span>
          </span>
        </div>
      </div>

      {/* A phone's navigation. Hidden wherever the rail is on screen. */}
      <PhoneDock
        section={section}
        onGo={guardedNavigate}
        audit={audit}
        enabled={moduleOn}
      />

      <TabSheet
        open={sheet}
        onClose={() => setSheet(false)}
        section={section}
        onGo={guardedNavigate}
        enabled={moduleOn}
      />

      <SaveBar
        module={activeLabel}
        flashSignal={shakeSignal}
        hidden={section === "resources"}
      />
    </div>
  );
}

/* The tab a view transition brought in, so its page skips its own entrance (the
   transition was the entrance). Module-level because the navigation that sets
   it and the render that reads it are in different components within one
   synchronous flush. */
let arrivedByTransition = "";

export function ManageShell({
  guildId,
  viewerId,
  initialPath,
}: {
  guildId: string;
  viewerId: string;
  initialPath: string;
}) {
  const [sectionPath, setSectionPath] = useState(initialPath || "overview");
  // Auto theme must be written down here, because the older dashboard styles
  // cannot read a media query. See THEME_SCRIPT.
  useEffect(() => resolveAutoTheme(), []);

  function navigate(next: string) {
    /* A tab change moves only the page: the old one lifts away and the new one
       comes in from the direction you moved in the rail, while the bar, rail
       and dock stay still. A view transition where supported, the plain
       entrance otherwise. */
    const from = sectionPath.split("/")[0];
    const to = next.split("/")[0];
    const turn =
      typeof document !== "undefined" &&
      typeof document.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      to !== from;
    // Back to the top inside the change, so the new tab is captured where it
    // will be seen rather than at the old one's scroll and then jumped.
    const top = () => {
      document.querySelector<HTMLElement>(".manage-root .gw-pane")?.scrollTo({ top: 0 });
      if (window.matchMedia("(max-width: 760px)").matches) window.scrollTo({ top: 0 });
    };
    if (turn) {
      const root = document.documentElement;
      root.setAttribute("data-nav", "tab");
      root.setAttribute(
        "data-nav-dir",
        NAV_ORDER.indexOf(to) >= NAV_ORDER.indexOf(from) ? "down" : "up",
      );
      const transition = document.startViewTransition(() => {
        arrivedByTransition = next;
        flushSync(() => setSectionPath(next));
        top();
      });
      const done = () => {
        root.removeAttribute("data-nav");
        root.removeAttribute("data-nav-dir");
      };
      transition.finished.then(done, done);
    } else {
      setSectionPath(next);
    }
    if (typeof window !== "undefined") {
      window.history.pushState(
        window.history.state,
        "",
        `/manage/${guildId}/${next}`,
      );
    }
  }

  useEffect(() => {
    const syncFromHistory = () => {
      const next =
        window.location.pathname.split("/").filter(Boolean).slice(2).join("/") ||
        "overview";
      setSectionPath(next);
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  return (
    <ManageProvider guildId={guildId} viewerId={viewerId}>
      <ShellInner sectionPath={sectionPath} onNavigate={navigate} />
    </ManageProvider>
  );
}
