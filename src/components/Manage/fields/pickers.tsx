"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { exitGhost } from "../exit-ghost";
import { useDragDismiss } from "../drag-dismiss";
import {
  IconCheck,
  IconChevronDown,
  IconHash,
  IconSpeakerphone,
  IconMessages,
  IconMicrophone2,
  IconRefresh,
  IconSearch,
  IconVolume,
  IconX,
} from "@tabler/icons-react";
import { useOptionalManage } from "../manage-context";
import type { ChannelKind, ManagedChannel, ManagedRole } from "../types";

/* Menus that open from a field (PortalMenu, and on a phone a sheet) and the pickers built on them: channels, roles, single and multiple choice. */

/* ------------------------------------------------------------------ */
/* Generic dropdown picker                                             */
/* ------------------------------------------------------------------ */

interface PickerOption {
  id: string;
  label: string;
  hint?: string;
  /** The heading the option is listed under -- a channel's category. */
  group?: string;
  color?: string | null;
  icon?: React.ReactNode;
}

/** A name with the part that matches the search picked out. */
function Matched({ text, query }: { text: string; query: string }) {
  const term = query.trim().toLowerCase();
  const at = term ? text.toLowerCase().indexOf(term) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="gw-menu-match">{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}

/** Past this many options a dropdown shows its keys and its count. */
const FOOT_FROM = 8;

export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref, menuRef };
}

/**
 * A phone: narrow and touch. The one case where a dropdown is a bottom sheet (a
 * narrow desktop window has a mouse, and a touchscreen laptop is wide).
 */
export function usePhoneSheet() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px) and (pointer: coarse)");
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return phone;
}

/**
 * How much of the layout viewport the on-screen keyboard covers. iOS does not
 * shrink the layout viewport for the keyboard, but the visual viewport shrinks;
 * the difference is the keyboard.
 */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !viewport) return;
    const update = () =>
      setInset(
        Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)),
      );
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);
  return inset;
}

/**
 * Renders the dropdown in a document-level portal, so it is never painted under
 * sibling glass panels (backdrop-filter creates stacking contexts).
 *
 * On a phone, when the caller asks for it, the menu is a bottom sheet instead:
 * a menu under its field could not be scrolled on an iPhone once the search
 * took focus and the keyboard covered it. The sheet opens without the keyboard,
 * rides above it when it appears, and is dismissed by pulling down.
 */
export function PortalMenu({
  anchorRef,
  menuRef,
  children,
  repositionOnScroll = true,
  sheet = false,
  onClose,
  minWidth = 280,
}: {
  anchorRef: React.RefObject<HTMLDivElement>;
  menuRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
  repositionOnScroll?: boolean;
  /** The narrowest it draws, for a menu hung off a small button rather than
   *  a field: it then slides left to stay on the screen. */
  minWidth?: number;
  /** Draw it as a bottom sheet. Only honoured with `onClose`, since the
   *  sheet's scrim and pull have to be able to shut it. */
  sheet?: boolean;
  onClose?: () => void;
}) {
  const asSheet = sheet && Boolean(onClose);
  const [rect, setRect] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);
  // The open direction is decided once when the menu opens and kept while
  // scrolling, so the menu does not flip between above and below the field.
  const directionRef = useRef<"up" | "down" | null>(null);
  const keyboard = useKeyboardInset(asSheet);
  /** How far the sheet had been pulled when it was let go, for its exit. */
  const pulled = useRef(0);
  const pull = useDragDismiss<HTMLDivElement>({
    disabled: !asSheet,
    onDismiss: (distance) => {
      pulled.current = distance;
      onClose?.();
    },
  });
  /* Leaves the way it arrived. Callers mount this as `{open ? <PortalMenu/> :
     null}`, so on close the layout effect's cleanup (which runs while the node
     is still in the document) leaves an inert copy that animates back toward
     the field and removes itself. Callers need no changes. */
  useLayoutEffect(() => {
    return () => {
      const node = menuRef.current;
      if (node?.dataset.sheet === "true") {
        // The scrim fades and the sheet carries on down from wherever the
        // finger left it.
        const ghost = exitGhost(
          node,
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 240, easing: "ease" },
          document.body,
        );
        ghost
          ?.querySelector<HTMLElement>(".gw-menu-sheet-body")
          ?.animate(
            [
              { transform: `translate3d(0, ${pulled.current}px, 0)` },
              { transform: "translate3d(0, 105%, 0)" },
            ],
            { duration: 240, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
          );
        return;
      }
      const up = node?.dataset.dir === "up";
      exitGhost(
        node,
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: `translateY(${up ? 4 : -4}px) scale(0.98)` },
        ],
        { duration: 140 },
        document.body,
      );
    };
  }, [menuRef]);
  useEffect(() => {
    if (asSheet) return;
    function measure(event?: Event) {
      // Scrolling inside the list is not the field moving, so it does not
      // re-measure the menu.
      if (event && menuRef.current?.contains(event.target as Node)) return;
      const anchor = anchorRef.current;
      if (!anchor) return;
      const box = anchor.getBoundingClientRect();
      const horizontalGutter = 12;
      // The field's width (at least `minWidth`), lined up with it.
      const desiredWidth = Math.min(
        Math.max(box.width, minWidth),
        window.innerWidth - horizontalGutter * 2
      );
      const menuHeight = Math.min(
        menuRef.current?.offsetHeight || 320,
        320
      );
      if (directionRef.current === null) {
        directionRef.current =
          box.bottom + menuHeight + 8 > window.innerHeight && box.top > menuHeight
            ? "up"
            : "down";
      }
      const openUp = directionRef.current === "up";
      // When flipping upward, pin the menu's bottom edge just above the
      // field so short menus hug it instead of floating mid-screen.
      setRect({
        // A little off the field: a panel of its own, not the field growing.
        top: openUp ? undefined : box.bottom + 8,
        bottom: openUp ? window.innerHeight - box.top + 8 : undefined,
        left: Math.max(
          horizontalGutter,
          Math.min(box.left, window.innerWidth - desiredWidth - horizontalGutter)
        ),
        width: desiredWidth,
      });
    }
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    if (repositionOnScroll) window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", onResize);
      if (repositionOnScroll) window.removeEventListener("scroll", measure, true);
    };
  }, [anchorRef, menuRef, repositionOnScroll, asSheet, minWidth]);
  if (typeof document === "undefined") return null;
  if (asSheet) {
    return createPortal(
      <div
        ref={menuRef}
        className="gw-menu-sheet"
        data-sheet="true"
        style={{ ["--kb" as string]: `${keyboard}px` }}
      >
        <button
          type="button"
          className="gw-menu-scrim"
          aria-label="Close"
          tabIndex={-1}
          onClick={onClose}
        />
        <div className="gw-menu-sheet-body" ref={pull.target}>
          <div className="gw-sheet-pull" {...pull.handle}>
            <span className="gw-sheet-grab" aria-hidden="true" />
          </div>
          {children}
        </div>
      </div>,
      document.body,
    );
  }
  if (!rect) return null;
  return createPortal(
    <div
      ref={menuRef}
      className="gw-menu"
      data-dir={directionRef.current ?? "down"}
      style={{
        position: "fixed",
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        // Above every modal and overlay layer, so pickers opened inside dialogs
        // are never painted behind their own backdrop.
        zIndex: 220,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/**
 * Re-reads the server's channels and roles from inside any picker, so a channel
 * or role created in Discord after the page loaded can be picked without a
 * reload (which would lose unsaved edits). Refreshes the shared `meta`, so
 * every dropdown updates; on a cooldown because each press calls the bot and
 * Discord. Renders nothing outside a manage provider.
 */
function PickerRefresh() {
  const manage = useOptionalManage();
  if (!manage?.refreshMeta) return null;
  const { refreshMeta, refreshingMeta, metaCooldown } = manage;
  const waiting = metaCooldown > 0;
  return (
    <span
      role="button"
      tabIndex={refreshingMeta || waiting ? -1 : 0}
      onClick={(event) => {
        // Inside the search row's label, so without this it focuses the field.
        event.preventDefault();
        event.stopPropagation();
        if (!refreshingMeta && !waiting) void refreshMeta();
      }}
      aria-disabled={refreshingMeta || waiting}
      onKeyDown={event=>{if((event.key==="Enter"||event.key===" ")&&!refreshingMeta&&!waiting){event.preventDefault();event.stopPropagation();void refreshMeta();}}}
      aria-label="Refresh channels and roles"
      title={
        waiting
          ? `Just refreshed. Ready again in ${metaCooldown}s`
          : "Re-read this server's channels and roles"
      }
      className="gw-picker-refresh"
    >
      <IconRefresh
        size={14}
        className={refreshingMeta ? "animate-spin" : undefined}
      />
    </span>
  );
}

function PickerShell({
  options,
  selected,
  onToggle,
  onClear,
  placeholder,
  multi,
  searchPlaceholder,
  searchPosition = "top",
  repositionOnScroll = true,
  refreshable = false,
  noun = "option",
}: {
  options: PickerOption[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear?: () => void;
  placeholder: string;
  multi: boolean;
  searchPlaceholder: string;
  searchPosition?: "top" | "bottom";
  repositionOnScroll?: boolean;
  /** Whether this picker's options come from the server's channels or roles.
   *  A picker over a fixed list — colours, styles — has nothing to refresh. */
  refreshable?: boolean;
  /** What one option is called, for the count in the foot. */
  noun?: string;
}) {
  const { open, setOpen, ref, menuRef } = usePopover();
  const phone = usePhoneSheet();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(q)
    );
  }, [options, query]);
  /* Options grouped under their category heading once, as Discord lists them. */
  const runs = useMemo(() => {
    const out: { group?: string; items: { option: PickerOption; index: number }[] }[] = [];
    filtered.forEach((option, index) => {
      const last = out[out.length - 1];
      if (last && last.group === option.group) last.items.push({ option, index });
      else out.push({ group: option.group, items: [{ option, index }] });
    });
    return out;
  }, [filtered]);
  /* One highlighted row, moved by the keyboard or the pointer, whichever moved
     last. Starts on the current value, so opening and pressing Enter changes
     nothing. */
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement | null>(null);
  /* The list as state as well, because it mounts a frame after the menu
     opens (the menu waits to be measured) and the highlight below has to
     know when it is there. */
  const [listNode, setListNode] = useState<HTMLDivElement | null>(null);
  /* One highlight that glides to whichever row is lit, like the rail's,
     rather than each row lighting itself. Measured from the list's own top
     so it scrolls with the rows. It lands without gliding the first time. */
  const lit = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const mark = lit.current;
    if (!open || !listNode || !mark) return;
    const row = listNode.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!row) {
      mark.style.opacity = "0";
      return;
    }
    const top =
      row.getBoundingClientRect().top - listNode.getBoundingClientRect().top + listNode.scrollTop;
    const first = mark.dataset.placed !== "true";
    if (first) mark.style.transition = "none";
    mark.style.opacity = "1";
    mark.style.transform = `translate3d(0, ${top}px, 0)`;
    mark.style.height = `${row.offsetHeight}px`;
    mark.dataset.selected = row.dataset.selected === "true" ? "true" : "false";
    if (first) {
      void mark.offsetHeight;
      mark.style.transition = "";
      mark.dataset.placed = "true";
    }
  }, [active, open, listNode, filtered, selected]);
  /* Whether the highlighted row should be scrolled into view: on open, on
     search and on arrow keys, but not on pointer hover. Options are compared by
     content rather than by array identity, because callers rebuild the array
     every render and a reset would jump the list back to the top. */
  const follow = useRef(true);
  const optionsKey = useMemo(() => options.map((option) => option.id).join("\n"), [options]);
  useEffect(() => {
    if (!open) return;
    const chosen = filtered.findIndex((option) => selected.includes(option.id));
    follow.current = true;
    setActive(query.trim() || chosen < 0 ? 0 : chosen);
    // Only when the list itself changes, not on every selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, optionsKey]);
  useEffect(() => {
    if (!open || !follow.current) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  function pick(option: PickerOption) {
    onToggle(option.id);
    if (!multi) setOpen(false);
  }
  function onFindKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!filtered.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      follow.current = true;
      setActive((current) => (current + step + filtered.length) % filtered.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option) pick(option);
    }
  }
  /**
   * What is selected, including ids the option list does not know (a saved
   * channel filtered out by type, or created after the page loaded). Shown as
   * selected and clearable rather than as an empty placeholder.
   */
  const selectedOptions = useMemo<PickerOption[]>(() => {
    const byId = new Map(options.map((option) => [option.id, option]));
    return selected.map(
      (id) =>
        byId.get(id) ?? {
          id,
          label: `Unknown · ${id}`,
          hint: "Not in this server, or not a kind this field accepts.",
        },
    );
  }, [options, selected]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="gw-picker-trigger w-full"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {selectedOptions.length === 0 ? (
            <span className="gw-picker-placeholder">{placeholder}</span>
          ) : !multi ? (
            <span className="gw-picker-value">
              {selectedOptions[0].color ? (
                <span className="gw-menu-swatch" style={{ backgroundColor: selectedOptions[0].color }} />
              ) : selectedOptions[0].icon ? (
                <span className="gw-menu-glyph">{selectedOptions[0].icon}</span>
              ) : null}
              <span className="truncate">{selectedOptions[0].label}</span>
            </span>
          ) : (
            selectedOptions.map((option) => (
              <span key={option.id} className="gw-picker-chip">
                {option.color ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                ) : (
                  option.icon
                )}
                <span className="truncate">{option.label}</span>
                {multi ? (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${option.label}`}
                    // Inside a chip, so it keeps the chip's size; the site's
                    // touch floor would make every chip 44px tall.
                    data-tap="inline"
                    className="gw-chip-x cursor-pointer text-white/40 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(option.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggle(option.id);
                      }
                    }}
                  >
                    <IconX size={12} stroke={2.5} />
                  </span>
                ) : null}
              </span>
            ))
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {!multi && selectedOptions.length > 0 && onClear ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              className="gw-picker-clear cursor-pointer rounded p-1 text-white/40 hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onClear();
                }
              }}
            >
              <IconX size={14} />
            </span>
          ) : null}
          <IconChevronDown size={16} className="gw-picker-chev" aria-hidden="true" />
        </span>
      </button>
      {open ? (
        <PortalMenu
          anchorRef={ref}
          menuRef={menuRef}
          repositionOnScroll={repositionOnScroll}
          sheet={phone}
          onClose={() => setOpen(false)}
        >
        <div className="gw-menu-panel" data-search={searchPosition}>
          {searchPosition === "top" ? (
            <label className="gw-menu-find" data-edge="top">
              <IconSearch size={15} aria-hidden="true" />
              <input
                // Not on a phone: the keyboard would come up over the list.
                autoFocus={!phone}
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onFindKey}
                data-bare
              />
              {query.trim() ? (
                <span className="gw-menu-found" aria-live="polite">
                  {filtered.length}
                </span>
              ) : null}
              {refreshable ? <PickerRefresh /> : null}
            </label>
          ) : null}
          <div
            className="gw-menu-list"
            ref={(node) => {
              list.current = node;
              setListNode(node);
            }}
            role="listbox"
            aria-multiselectable={multi || undefined}
          >
            <span className="gw-menu-lit" ref={lit} aria-hidden="true" />
            {filtered.length === 0 ? (
              <p className="gw-menu-empty">
                {query.trim() ? "Nothing called that." : "Nothing to choose from yet."}
              </p>
            ) : (
              runs.map((run, runIndex) => (
                <div
                  className="gw-menu-run"
                  key={`${run.group ?? ""}-${runIndex}`}
                  data-grouped={run.group ? "true" : undefined}
                >
                  {run.group ? (
                    <div className="gw-menu-group" aria-hidden="true">
                      <span className="gw-menu-group-name">{run.group}</span>
                      <span className="gw-menu-group-rule" />
                      <span className="gw-menu-group-count">{run.items.length}</span>
                    </div>
                  ) : null}
                  {run.items.map(({ option, index }) => {
                    const isSelected = selected.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        data-index={index}
                        onClick={() => pick(option)}
                        onPointerMove={() => {
                          if (active === index) return;
                          follow.current = false;
                          setActive(index);
                        }}
                        className="gw-menu-row"
                        data-active={index === active ? "true" : undefined}
                        data-selected={isSelected ? "true" : undefined}
                        // Its place in the cascade the rows arrive in.
                        style={{ ["--i" as string]: Math.min(index, 12) }}
                      >
                        {option.color ? (
                          <span
                            className="gw-menu-swatch"
                            style={{ backgroundColor: option.color, ["--dot" as string]: option.color }}
                          />
                        ) : option.icon ? (
                          <span className="gw-menu-glyph">{option.icon}</span>
                        ) : null}
                        <span className="gw-menu-label">
                          <Matched text={option.label} query={query} />
                        </span>
                        {option.hint ? (
                          <span className="gw-menu-hint">{option.hint}</span>
                        ) : null}
                        <span className="gw-menu-check" aria-hidden="true">
                          <IconCheck size={14} stroke={2.6} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          {searchPosition === "bottom" ? (
            <label className="gw-menu-find" data-edge="bottom">
              <IconSearch size={15} aria-hidden="true" />
              <input
                autoFocus={!phone}
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onFindKey}
                data-bare
              />
              {query.trim() ? (
                <span className="gw-menu-found" aria-live="polite">
                  {filtered.length}
                </span>
              ) : null}
              {refreshable ? <PickerRefresh /> : null}
            </label>
          ) : null}
          {!phone && options.length >= FOOT_FROM ? (
            <div className="gw-menu-foot" aria-hidden="true">
              <span className="gw-menu-keys">
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> move
                </span>
                <span>
                  <kbd>⏎</kbd> {multi ? "choose" : "pick"}
                </span>
                <span>
                  <kbd>esc</kbd> close
                </span>
              </span>
              <span className="gw-menu-total">
                {multi && selected.length ? `${selected.length} chosen · ` : ""}
                {options.length} {noun}
                {options.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}
        </div>
        </PortalMenu>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Channel / role pickers                                              */
/* ------------------------------------------------------------------ */

function channelIcon(kind: ChannelKind) {
  switch (kind) {
    case "announcement":
      return <IconSpeakerphone size={14} />;
    case "voice":
      return <IconVolume size={14} />;
    case "stage":
      return <IconMicrophone2 size={14} />;
    case "forum":
      return <IconMessages size={14} />;
    default:
      return <IconHash size={14} />;
  }
}

export function ChannelPicker({
  channels,
  value,
  onChange,
  types = ["text", "announcement"],
  multi = false,
  placeholder = "Select a channel",
}: {
  channels: ManagedChannel[];
  value: string[] | string | null | undefined;
  onChange: (next: string[] | string | null) => void;
  types?: ChannelKind[];
  multi?: boolean;
  placeholder?: string;
}) {
  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const channel of channels) {
      if (channel.type === "category") map.set(channel.id, channel.name);
    }
    return map;
  }, [channels]);
  // `types` is a default or written inline, so a new array every render; the
  // options are rebuilt when what is in it changes, not when it is re-made.
  const typeKey = types.join(",");

  /* In Discord's order: uncategorised channels first, then each category in its
     position with its channels under it, so each heading appears once. */
  const options: PickerOption[] = useMemo(() => {
    const categoryOrder = new Map<string, number>();
    for (const channel of channels) {
      if (channel.type === "category") categoryOrder.set(channel.id, channel.position);
    }
    const rank = (channel: ManagedChannel) =>
      channel.parentId && categoryOrder.has(channel.parentId)
        ? categoryOrder.get(channel.parentId)! + 1
        : 0;
    const wanted = typeKey.split(",");
    return channels
      .filter((channel) => wanted.includes(channel.type))
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.parentId ?? "").localeCompare(b.parentId ?? "") ||
          a.position - b.position,
      )
      .map((channel) => ({
        id: channel.id,
        label: channel.name,
        group: channel.parentId ? categoryNames.get(channel.parentId) : undefined,
        icon:
          channel.type === "category" ? undefined : channelIcon(channel.type),
      }));
  }, [channels, typeKey, categoryNames]);

  const selected = useMemo(() => {
    if (Array.isArray(value)) return value.map(String);
    if (value) return [String(value)];
    return [];
  }, [value]);

  return (
    <PickerShell
      refreshable
      options={options}
      selected={selected}
      multi={multi}
      placeholder={placeholder}
      searchPlaceholder="Find a channel"
      noun="channel"
      onClear={() => onChange(multi ? [] : null)}
      onToggle={(id) => {
        if (multi) {
          const next = selected.includes(id)
            ? selected.filter((item) => item !== id)
            : [...selected, id];
          onChange(next);
        } else {
          onChange(selected.includes(id) ? null : id);
        }
      }}
    />
  );
}

export function RolePicker({
  roles,
  value,
  onChange,
  multi = false,
  placeholder = "Select a role",
}: {
  roles: ManagedRole[];
  value: string[] | string | null | undefined;
  onChange: (next: string[] | string | null) => void;
  multi?: boolean;
  placeholder?: string;
}) {
  const options: PickerOption[] = useMemo(
    () =>
      roles
        // Managed roles (bot/integration/booster roles) can't be assigned by
        // the bot — Discord rejects it — so never offer them for pick.
        .filter((role) => !role.managed)
        .map((role) => ({
          id: role.id,
          label: role.name,
          color: role.color || "#9aa0a6",
        })),
    [roles]
  );

  const selected = useMemo(() => {
    if (Array.isArray(value)) return value.map(String);
    if (value) return [String(value)];
    return [];
  }, [value]);

  return (
    <PickerShell
      refreshable
      options={options}
      selected={selected}
      multi={multi}
      placeholder={placeholder}
      searchPlaceholder="Find a role"
      noun="role"
      onClear={() => onChange(multi ? [] : null)}
      onToggle={(id) => {
        if (multi) {
          const next = selected.includes(id)
            ? selected.filter((item) => item !== id)
            : [...selected, id];
          onChange(next);
        } else {
          onChange(selected.includes(id) ? null : id);
        }
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

export function SelectField({
  value,
  onChange,
  options,
  searchPosition = "top",
  repositionOnScroll = true,
  placeholder = "Select…",
}: {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  options: {
    label: string;
    value: string;
    description?: string;
    icon?: React.ReactNode;
  }[];
  placeholder?: string;
  searchPosition?: "top" | "bottom";
  repositionOnScroll?: boolean;
}) {
  const pickerOptions: PickerOption[] = options.map((option) => ({
    id: option.value,
    label: option.label,
    hint: option.description,
    icon: option.icon,
  }));
  return (
    <PickerShell
      options={pickerOptions}
      selected={value ? [String(value)] : []}
      multi={false}
      placeholder={placeholder}
      searchPosition={searchPosition}
      repositionOnScroll={repositionOnScroll}
      searchPlaceholder="Search…"
      onToggle={(id) => onChange(id)}
    />
  );
}

export function MultiSelectField({
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: {
    label: string;
    value: string;
    description?: string;
    icon?: React.ReactNode;
  }[];
  placeholder?: string;
}) {
  const selected = value.map(String);
  const pickerOptions: PickerOption[] = options.map((option) => ({
    id: option.value,
    label: option.label,
    hint: option.description,
    icon: option.icon,
  }));
  return (
    <PickerShell
      options={pickerOptions}
      selected={selected}
      multi
      placeholder={placeholder}
      searchPlaceholder="Search…"
      onClear={() => onChange([])}
      onToggle={(id) =>
        onChange(
          selected.includes(id)
            ? selected.filter((item) => item !== id)
            : [...selected, id],
        )
      }
    />
  );
}
