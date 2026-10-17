"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconHome,
  IconLayoutGrid,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";
import { OPEN_SEARCH_EVENT, SEARCH_STATE_EVENT } from "@/components/site/command-palette";
import { NAV_GROUPS } from "./nav-groups";
import type { AuditItem } from "./config-audit";
import { useDragDismiss } from "./drag-dismiss";
import { useManage } from "./manage-context";

type Panel = "tabs" | "fix";

/**
 * A phone's navigation: a dock of four marks at the foot of the screen.
 * Overview goes home; Browse and To fix grow the dock upward into the list of
 * every tab or the list of what needs fixing, with the pressed mark stretched
 * into a labelled pill; Search (at the trailing end, within thumb reach) opens
 * the site search. Press again, pull down or press elsewhere to settle it back.
 * The account stays in the bar's corner. The height is measured so it animates
 * up, down and between the two lists.
 */
export function PhoneDock({
  section,
  onGo,
  audit,
  enabled,
}: {
  section: string;
  onGo: (next: string) => void;
  audit: AuditItem[];
  enabled: (item: { moduleKey?: string; alwaysEnabled?: boolean }) => boolean;
}) {
  const [open, setOpen] = useState<Panel | null>(null);
  /* Hidden while there are unsaved changes: the save prompt takes its place at
     the foot of the screen (leaving the tab is blocked anyway). */
  const { dirty } = useManage();
  /* Slides off while a text field has focus (the keyboard would put it on top
     of what is being typed). Checked a frame after focus leaves, so moving
     between fields does not bounce it. */
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (node: EventTarget | null) => {
      if (!(node instanceof HTMLElement)) return false;
      // The search's own field is not typing into the page: the dock tucks
      // under the search instead (below).
      if (node.closest(".g-cmd")) return false;
      if (node.isContentEditable || node.tagName === "TEXTAREA") return true;
      if (node.tagName !== "INPUT") return false;
      const type = (node as HTMLInputElement).type;
      return !["checkbox", "radio", "range", "color", "file", "button", "submit"].includes(type);
    };
    let frame = 0;
    const recheck = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setTyping(isField(document.activeElement)));
    };
    const onIn = (event: FocusEvent) => {
      if (isField(event.target)) setTyping(true);
    };
    /* Also re-checked on every press: on iOS a focused field removed from the
       page (a closing sheet, a deleted row) never fires `focusout`. */
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", recheck);
    document.addEventListener("pointerdown", recheck, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", recheck);
      document.removeEventListener("pointerdown", recheck, true);
    };
  }, []);
  useEffect(() => {
    setTyping(false);
  }, [section]);

  /* While search is open, the dock sinks a little and waits under the dimmed
     page. */
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    const onState = (event: Event) => setTucked(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(SEARCH_STATE_EVENT, onState);
    return () => window.removeEventListener(SEARCH_STATE_EVENT, onState);
  }, []);
  /* What the panel shows, which outlives `open` by the length of the close so
     the list does not vanish from a panel that is still shrinking. */
  const [shown, setShown] = useState<Panel | null>(null);
  const [height, setHeight] = useState(0);
  const content = useRef<HTMLDivElement | null>(null);
  const dock = useRef<HTMLDivElement | null>(null);
  const pull = useDragDismiss<HTMLDivElement>({ onDismiss: () => setOpen(null) });

  useEffect(() => {
    if (open) setShown(open);
  }, [open]);

  // The panel's height follows its list, whichever list it is.
  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => setHeight(open ? node.scrollHeight : 0);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, [open, shown]);

  // Closed from anywhere else, and from the keyboard.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (dock.current && !dock.current.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The open tab, in view, when the list opens on it.
  useEffect(() => {
    if (open !== "tabs") return;
    const id = window.setTimeout(() => {
      content.current
        ?.querySelector<HTMLElement>('[data-current="true"]')
        ?.scrollIntoView({ block: "center" });
    }, 40);
    return () => window.clearTimeout(id);
  }, [open]);

  const go = React.useCallback(
    (next: string) => {
      setOpen(null);
      onGo(next);
    },
    [onGo],
  );

  const toggle = (panel: Panel) => setOpen((current) => (current === panel ? null : panel));
  /** The mark that is lit: the panel that is open, or else where you are. */
  const lit: string = open ?? (section === "overview" ? "overview" : "tabs");

  const items: {
    id: string;
    label: string;
    icon: React.ReactNode;
    count?: number;
    run: () => void;
    panel?: Panel;
  }[] = [
    { id: "overview", label: "Overview", icon: <IconHome size={19} />, run: () => go("overview") },
    // "Browse": the place that lists everything.
    { id: "tabs", label: "Browse", icon: <IconLayoutGrid size={19} />, run: () => toggle("tabs"), panel: "tabs" },
    {
      id: "fix",
      // Broken things first; with nothing broken it is the setup list.
      label: audit.some((item) => item.kind === "gone") ? "To fix" : "Set up",
      icon: <IconAlertTriangle size={19} />,
      count: audit.filter((item) => item.kind === "gone").length || audit.length,
      run: () => toggle("fix"),
      panel: "fix",
    },
    {
      id: "search",
      label: "Search",
      icon: <IconSearch size={19} />,
      run: () => {
        setOpen(null);
        window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
      },
    },
  ];

  return (
    <>
      <div className="gw-dock-scrim" data-on={open ? "true" : undefined} aria-hidden="true" />
      <div
        ref={(node) => {
          dock.current = node;
          pull.target.current = node;
        }}
        className="gw-dock"
        data-open={open ? "true" : undefined}
        // Never while it is open: its own search field is typed into.
        data-away={(typing || dirty) && !open && !tucked ? "true" : undefined}
        data-tucked={tucked ? "true" : undefined}
        role="navigation"
        aria-label="Dashboard"
      >
        <div
          className="gw-dock-panel"
          style={{ height }}
          inert={!open}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && !open) setShown(null);
          }}
        >
          <div ref={content} className="gw-dock-content">
            <div className="gw-dock-pull" {...pull.handle}>
              <span className="gw-sheet-grab" aria-hidden="true" />
            </div>
            {/* Both lists are built once and kept, so opening the dock does not
               create dozens of rows on the frame of the press. */}
            <div className="gw-dock-list" hidden={shown !== "tabs"} data-list="tabs">
              <DockTabs section={section} enabled={enabled} go={go} />
            </div>
            <div className="gw-dock-list" hidden={shown !== "fix"} data-list="fix">
              {audit.length ? (
                <div className="gw-dock-group">
                    {[...audit].sort((a, b) => Number(b.kind === "gone") - Number(a.kind === "gone")).map((item, index) => (
                      <button
                        key={`${item.section}-${item.label}-${index}`}
                        type="button"
                        className="gw-dock-row"
                        onClick={() => go(item.section)}
                      >
                        <span className="gw-dock-tile" data-tone={item.kind === "gone" ? "warn" : "accent"} aria-hidden="true">
                          {item.kind === "gone" ? <IconAlertTriangle size={16} /> : <IconSettings size={16} />}
                        </span>
                        <span className="gw-dock-copy">
                          <span className="gw-dock-name">{item.label}</span>
                          <span className="gw-dock-say">{item.sectionLabel}</span>
                        </span>
                        <span className="gw-dock-meta" data-tone={item.kind === "gone" ? "warn" : "accent"}>
                          {item.tag}
                        </span>
                        <IconArrowRight size={14} className="gw-dock-go" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="gw-dock-empty">Nothing to fix. Every channel and role still exists.</p>
                )}
            </div>
          </div>
        </div>

        <div className="gw-dock-bar">
          {items.map((item) => {
            const on = lit === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="gw-dock-item"
                data-on={on ? "true" : undefined}
                aria-expanded={item.panel ? open === item.panel : undefined}
                aria-current={!item.panel && on ? "page" : undefined}
                aria-label={item.count ? `${item.label}, ${item.count}` : item.label}
                onClick={item.run}
              >
                <span className="gw-dock-icon">
                  {item.icon}
                  {item.count ? <span className="gw-dock-dot">{item.count > 9 ? "9+" : item.count}</span> : null}
                </span>
                <span className="gw-dock-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* Every tab, grouped as the rail groups them. Memoised: it only changes when
   the tab or a module's state changes. */
const DockTabs = React.memo(function DockTabs({
  section,
  enabled,
  go,
}: {
  section: string;
  enabled: (item: { moduleKey?: string; alwaysEnabled?: boolean }) => boolean;
  go: (next: string) => void;
}) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div className="gw-dock-group" key={group.title ?? "root"}>
          {group.title ? <p className="gw-dock-caption">{group.title}</p> : null}
          {group.items.map((item) => {
            const off = !enabled(item);
            return (
              <button
                key={item.id}
                type="button"
                className="gw-dock-row"
                data-current={section === item.id ? "true" : undefined}
                data-off={off ? "true" : undefined}
                onClick={() => go(item.id)}
              >
                <span className="gw-dock-tile" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="gw-dock-name">{item.label}</span>
                {off ? (
                  <span className="gw-dock-meta">Off</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
});
