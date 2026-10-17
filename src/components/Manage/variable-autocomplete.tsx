"use client";

import React from "react";
import { createPortal } from "react-dom";
import { describeVariable } from "@/config/variable-registry";

/**
 * Variables offered where they are typed. In any text field of a message
 * editor, `{` opens a small list at the bracket with the variables this message
 * can use (the module's own, then shared, then global), narrowing as you type.
 * The best match is also previewed in grey ahead of the caret, like Chrome's
 * address bar: Tab or → accepts it, Enter takes the highlighted row, Esc
 * dismisses. One instance listens to the whole editor, so every field behaves
 * the same.
 */

type Field = HTMLTextAreaElement | HTMLInputElement;

interface Place {
  field: Field;
  /** Where the `{` is. */
  start: number;
  /** What has been typed after it. */
  term: string;
  /** The bracket, and the caret, in the viewport. */
  bracket: { x: number; top: number; bottom: number };
  caret: { x: number; top: number };
  /** How far the field runs to the right of the caret. */
  room: number;
  font: React.CSSProperties;
  /** Whether the text right after the caret leaves room for a completion. */
  tail: boolean;
}

interface Match {
  key: string;
  description: string;
  scope: "global" | "shared" | "module";
  group: string;
}

const TOKEN = /\{([\w.]*)$/;

function isField(target: EventTarget | null): target is Field {
  if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled;
  if (target instanceof HTMLInputElement) {
    return ["text", "search", "url", ""].includes(target.type) && !target.readOnly && !target.disabled;
  }
  return false;
}

/* Finding a character's position in a field: a hidden copy laid out the same
   way, with a marker at that character, measured. (A textarea does not expose
   caret coordinates.) */
const COPIED = [
  "direction", "boxSizing", "width", "height", "overflowX", "overflowY",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontSizeAdjust",
  "lineHeight", "fontFamily", "textAlign", "textTransform", "textIndent",
  "letterSpacing", "wordSpacing", "tabSize",
] as const;

function pointAt(field: Field, index: number) {
  const input = field instanceof HTMLInputElement;
  const computed = window.getComputedStyle(field);
  const copy = document.createElement("div");
  const style = copy.style as unknown as Record<string, string>;
  for (const name of COPIED) style[name] = (computed as unknown as Record<string, string>)[name];
  style.position = "absolute";
  style.visibility = "hidden";
  style.top = "0";
  style.left = "-9999px";
  style.overflow = "hidden";
  style.whiteSpace = input ? "pre" : "pre-wrap";
  style.overflowWrap = input ? "normal" : "break-word";
  copy.textContent = field.value.slice(0, index);
  const mark = document.createElement("span");
  mark.textContent = field.value.slice(index) || ".";
  copy.appendChild(mark);
  document.body.appendChild(copy);
  const rect = field.getBoundingClientRect();
  const fontSize = parseFloat(computed.fontSize) || 14;
  const declared = parseFloat(computed.lineHeight);
  const line = Number.isFinite(declared) ? declared : fontSize * 1.3;
  const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
  const borderTop = parseFloat(computed.borderTopWidth) || 0;
  const x = rect.left + borderLeft + mark.offsetLeft - field.scrollLeft;
  // A one-line field centres its line; a textarea puts it where it wraps to.
  const top = input
    ? rect.top + (rect.height - line) / 2
    : rect.top + borderTop + mark.offsetTop - field.scrollTop;
  document.body.removeChild(copy);
  return { x, top, bottom: top + line, line, computed };
}

/**
 * The module's own variables first, then shared, then global; within each, a
 * match at the start of the name before one in the middle, and description
 * matches last.
 */
function rank(variables: string[], term: string): Match[] {
  const lower = term.toLowerCase();
  const scopeOrder = { module: 0, shared: 1, global: 2 } as const;
  const scored: (Match & { score: number; order: number })[] = [];
  variables.forEach((key, order) => {
    const bare = key.replace(/^\{|\}$/g, "").toLowerCase();
    const meta = describeVariable(key);
    let score: number;
    if (!lower || bare.startsWith(lower)) score = 0;
    else if (bare.split(/[._]/).some((part) => part.startsWith(lower))) score = 1;
    else if (bare.includes(lower)) score = 2;
    else if (meta.description.toLowerCase().includes(lower)) score = 3;
    else return;
    scored.push({ key, description: meta.description, scope: meta.scope, group: meta.group, score, order });
  });
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      scopeOrder[a.scope] - scopeOrder[b.scope] ||
      (lower ? a.key.length - b.key.length : 0) ||
      a.order - b.order,
  );
  // All of them. It stopped at seven, so the list could never be scrolled
  // and anything past the seventh could only be reached by typing more.
  return scored;
}

const SCOPE_TITLE = { shared: "Shared", global: "Every message" } as const;

export function VariableAutocomplete({
  containerRef,
  variables,
  module,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  variables: string[];
  /**
   * The module this editor belongs to. Its variables are tagged with this name,
   * since a variable can resolve in several modules and the one being edited is
   * the one that matters.
   */
  module?: string;
}) {
  const [place, setPlace] = React.useState<Place | null>(null);
  const [cursor, setCursor] = React.useState(0);
  const listId = React.useId();
  const matches = React.useMemo(
    () => (place ? rank(variables, place.term) : []),
    [variables, place],
  );

  // Read by the listeners, which are attached once.
  const live = React.useRef({ place, matches, cursor });
  live.current = { place, matches, cursor };

  const read = React.useCallback((field: Field) => {
    const caret = field.selectionStart ?? field.value.length;
    if (field.selectionEnd !== caret) {
      setPlace(null);
      return;
    }
    const match = field.value.slice(0, caret).match(TOKEN);
    if (!match) {
      setPlace(null);
      return;
    }
    const start = caret - match[0].length;
    const at = pointAt(field, start);
    const end = pointAt(field, caret);
    const next = field.value.charAt(caret);
    const box = field.getBoundingClientRect();
    const inner =
      box.right - (parseFloat(end.computed.paddingRight) || 0) - (parseFloat(end.computed.borderRightWidth) || 0);
    const previous = live.current.place;
    if (!previous || previous.field !== field || previous.start !== start || previous.term !== match[1]) {
      setCursor(0);
    }
    setPlace({
        field,
        start,
        term: match[1],
        bracket: { x: at.x, top: at.top, bottom: at.bottom },
        caret: { x: end.x, top: end.top },
        room: Math.max(0, inner - end.x),
        font: {
          fontFamily: at.computed.fontFamily,
          fontSize: at.computed.fontSize,
          fontWeight: at.computed.fontWeight as React.CSSProperties["fontWeight"],
          letterSpacing: at.computed.letterSpacing,
          lineHeight: `${at.line}px`,
          color: at.computed.color,
        },
        tail: !next || /[\s)\].,!?:;"'*_~`]/.test(next),
    });
  }, []);

  const accept = React.useCallback((key: string) => {
    const current = live.current.place;
    if (!current) return;
    const field = current.field;
    const caret = field.selectionStart ?? field.value.length;
    // A closing brace already there is the one this completes.
    const through = field.value.charAt(caret) === "}" ? caret + 1 : caret;
    const next = field.value.slice(0, current.start) + key + field.value.slice(through);
    const setter = Object.getOwnPropertyDescriptor(
      field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(field, next);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const at = current.start + key.length;
    setPlace(null);
    requestAnimationFrame(() => {
      field.focus();
      try {
        field.setSelectionRange(at, at);
      } catch {}
    });
  }, []);

  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onInput = (event: Event) => {
      if (isField(event.target)) read(event.target);
    };
    const onMove = (event: Event) => {
      if (!isField(event.target)) return;
      if (event instanceof KeyboardEvent && !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      read(event.target);
    };
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const onKey = (event: KeyboardEvent) => {
      const { place: open, matches: list, cursor: at } = live.current;
      if (!open || event.target !== open.field) return;
      if (event.key === "Escape") {
        stop(event);
        setPlace(null);
        return;
      }
      if (!list.length) return;
      if (event.key === "ArrowDown") {
        stop(event);
        setCursor((c) => (c + 1) % list.length);
      } else if (event.key === "ArrowUp") {
        stop(event);
        setCursor((c) => (c - 1 + list.length) % list.length);
      } else if (event.key === "Enter" || event.key === "Tab") {
        stop(event);
        accept(list[at].key);
      } else if (event.key === "ArrowRight") {
        const field = open.field;
        const top = list[at];
        const caret = field.selectionStart ?? 0;
        const typed = `{${open.term}`.toLowerCase();
        if (open.tail && caret === open.start + typed.length && top.key.toLowerCase().startsWith(typed)) {
          stop(event);
          accept(top.key);
        }
      }
    };
    const onLeave = (event: FocusEvent) => {
      const open = live.current.place;
      if (open && event.target === open.field) {
        window.setTimeout(() => {
          if (document.activeElement !== live.current.place?.field) setPlace(null);
        }, 0);
      }
    };
    root.addEventListener("input", onInput);
    root.addEventListener("keydown", onKey, true);
    root.addEventListener("keyup", onMove);
    root.addEventListener("click", onMove);
    root.addEventListener("focusout", onLeave);
    return () => {
      root.removeEventListener("input", onInput);
      root.removeEventListener("keydown", onKey, true);
      root.removeEventListener("keyup", onMove);
      root.removeEventListener("click", onMove);
      root.removeEventListener("focusout", onLeave);
    };
  }, [containerRef, read, accept]);

  // It stays on its bracket while the page or the field scrolls under it.
  const openField = place?.field ?? null;
  const listRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!openField) return;
    const follow = (event: Event) => {
      // Scrolling the list itself is not the field moving.
      if (event.target instanceof Element && event.target.closest(".gw-vac")) return;
      read(openField);
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [openField, read]);

  // Said to a screen reader as what it is: a list completing the field.
  React.useEffect(() => {
    const field = openField;
    if (!field) return;
    field.setAttribute("aria-autocomplete", "both");
    field.setAttribute("aria-controls", listId);
    field.setAttribute("aria-expanded", "true");
    return () => {
      field.removeAttribute("aria-autocomplete");
      field.removeAttribute("aria-controls");
      field.removeAttribute("aria-expanded");
      field.removeAttribute("aria-activedescendant");
    };
  }, [openField, listId]);
  React.useEffect(() => {
    if (openField && matches[cursor]) openField.setAttribute("aria-activedescendant", `${listId}-${cursor}`);
    // The arrows walk past the edge of what is showing; the list follows.
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [openField, matches, cursor, listId]);

  if (!place || typeof document === "undefined") return null;
  const host = containerRef.current?.closest<HTMLElement>(".manage-root") ?? document.body;

  const lit = matches[cursor];
  const typed = `{${place.term}`;
  // Written only where the field has room for it, and cut at its edge: the
  // completion belongs inside the field it completes.
  const ghost =
    lit && place.tail && place.room > 16 && lit.key.toLowerCase().startsWith(typed.toLowerCase())
      ? lit.key.slice(typed.length)
      : "";
  // Above the bracket where there is room, under its line where there is not.
  const above = place.bracket.top > 240;
  const left = Math.max(8, Math.min(place.bracket.x - 10, window.innerWidth - 8 - 360));

  return createPortal(
    <>
      {ghost ? (
        <span
          className="gw-vac-ghost"
          aria-hidden="true"
          style={{ left: place.caret.x, top: place.caret.top, maxWidth: place.room, ...place.font }}
        >
          {ghost}
        </span>
      ) : null}
      <div
        className="gw-vac"
        data-side={above ? "above" : "below"}
        style={above ? { left, top: place.bracket.top - 6 } : { left, top: place.bracket.bottom + 6 }}
        // The field keeps its focus and its caret while the list is used.
        onPointerDown={(event) => event.preventDefault()}
        onMouseDown={(event) => event.preventDefault()}
      >
        {matches.length ? (
          <div className="gw-vac-list" role="listbox" id={listId} aria-label="Variables" ref={listRef}>
            {matches.map((item, index) => {
              // Named once, over the first of each kind, rather than on
              // every row: seven pills reading "Tickets" said it seven times.
              const title =
                index === 0 || matches[index - 1].scope !== item.scope
                  ? item.scope === "module"
                    ? module || item.group
                    : SCOPE_TITLE[item.scope]
                  : null;
              const bare = item.key.replace(/^\{|\}$/g, "");
              const typedBare = typed.slice(1);
              const lead = bare.toLowerCase().startsWith(typedBare.toLowerCase()) ? typedBare.length : 0;
              return (
                <React.Fragment key={item.key}>
                  {title ? <p className="gw-vac-group">{title}</p> : null}
                  <button
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    data-on={index === cursor ? "true" : undefined}
                    data-index={index}
                    className="gw-vac-row"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => accept(item.key)}
                  >
                    <span className="gw-vac-key">
                      <span className="gw-vac-brace">{"{"}</span>
                      {lead ? <span className="gw-vac-typed">{bare.slice(0, lead)}</span> : null}
                      {bare.slice(lead)}
                      <span className="gw-vac-brace">{"}"}</span>
                    </span>
                    {item.description ? <span className="gw-vac-say">{item.description}</span> : null}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <p className="gw-vac-none">No variable called {typed}…</p>
        )}
        <p className="gw-vac-keys" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> choose</span>
          <span><kbd>Tab</kbd> insert</span>
          <span><kbd>Esc</kbd> close</span>
          {matches.length > 7 ? <span className="gw-vac-n">{matches.length}</span> : null}
        </p>
      </div>
    </>,
    host,
  );
}
