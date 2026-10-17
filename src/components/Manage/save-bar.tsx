"use client";

import React from "react";
import { IconAlertTriangle, IconArrowBackUp, IconChevronUp, IconCircleCheck } from "@tabler/icons-react";
import { useManage } from "./manage-context";
import { fieldAt } from "./schema";
import { Toaster } from "sonner";
import { usePresence } from "../motion";

/**
 * A staged path in words: the setting's own label where the schema has one,
 * otherwise its last word, plus which part of the settings it belongs to.
 */
function describeChange(path: string) {
  const field = fieldAt(path);
  const parts = path.split(".");
  const tail = parts[parts.length - 1] || path;
  const label =
    field?.label ||
    tail
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^\w/, (c) => c.toUpperCase());
  const where = parts[0] === "Modules" ? "Modules" : parts[0].replace(/_/g, " ");
  return { label, where: where === label ? "" : where };
}

/**
 * Floating save prompt, shown while there are staged, unsaved changes; nothing
 * writes until Save is pressed. `usePresence` keeps it mounted for its exit,
 * and the `data-enter` contract in motion.css animates both directions. Drawn
 * from the window's own parts, in words, with a count that rolls and a sheen
 * across Save when it changes. Saved, it shrinks to a tick and the word (see
 * the "save prompt" section of 07-feedback.css).
 */
export function SaveBar({
  module,
  flashSignal = 0,
  hidden = false,
}: {
  module?: string;
  /** Increments when a blocked navigation should flash the prompt red. */
  flashSignal?: number;
  hidden?: boolean;
}) {
  const { dirty, saving, save, discard, revert, unsavedCount, pending, unsavedElsewhere } = useManage();
  const [flashKey, setFlashKey] = React.useState(0);
  const [peek, setPeek] = React.useState(false);

  /* After saving, a check draws itself where the count was, then the prompt
     leaves. */
  const [saved, setSaved] = React.useState(false);
  const wasSaving = React.useRef(false);
  /* The card's width just before it turns into "Saved", so it can shrink
     from there to fit the word rather than jump. */
  const card = React.useRef<HTMLDivElement | null>(null);
  const before = React.useRef(0);
  React.useEffect(() => {
    if (wasSaving.current && !saving && !dirty) {
      before.current = card.current?.offsetWidth ?? 0;
      setSaved(true);
      setPeek(false);
      const id = window.setTimeout(() => setSaved(false), 1100);
      wasSaving.current = false;
      return () => window.clearTimeout(id);
    }
    wasSaving.current = saving;
  }, [saving, dirty]);
  React.useEffect(() => {
    if (!dirty) setPeek(false);
  }, [dirty]);
  React.useLayoutEffect(() => {
    const node = card.current;
    if (!saved || !node || !before.current) return;
    const after = node.offsetWidth;
    if (Math.abs(after - before.current) > 2 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.animate([{ width: `${before.current}px` }, { width: `${after}px` }], {
        duration: 460,
        easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      });
    }
    before.current = 0;
  }, [saved]);

  const bar = usePresence((dirty || saved) && !hidden, { duration: 260 });
  /* "Saved" stays on the card while it leaves; going back to the buttons
     for the exit would widen it again on its way out. A new change ends it. */
  const leftSaved = React.useRef(false);
  if (saved) leftSaved.current = true;
  if (dirty) leftSaved.current = false;
  const done = saved || (leftSaved.current && !dirty && bar.mounted);
  // The key it says is the key this keyboard has.
  const shortcut =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
      ? "⌘S"
      : "Ctrl S";
  const changes = React.useMemo(() => Object.keys(pending).slice(0, 8), [pending]);
  /* After the settings it lists by name: the rest counted, then the editors
     that save separately. */
  const beyond = React.useMemo(() => {
    const more = Object.keys(pending).length - changes.length;
    const designs = unsavedElsewhere.filter((label) => label === "message design").length;
    const named = [...new Set(unsavedElsewhere.filter((label) => label !== "message design"))];
    const parts = [
      ...(more > 0 ? [`${more} more`] : []),
      ...(designs > 0 ? [`${designs} message design${designs === 1 ? "" : "s"}`] : []),
      ...named,
    ];
    return parts.length ? new Intl.ListFormat("en", { type: "conjunction" }).format(parts) : "";
  }, [changes.length, pending, unsavedElsewhere]);

  React.useEffect(() => {
    if (flashSignal > 0) setFlashKey(flashSignal);
  }, [flashSignal]);
  // A flash is only for the blocked navigation that asked for it, so it is
  // cleared once the changes are saved or discarded.
  React.useEffect(() => {
    if (!dirty) setFlashKey(0);
  }, [dirty]);

  // Shows the last real count during the exit (it drops to zero the instant the
  // change is saved).
  const lastCount = React.useRef(unsavedCount);
  if (dirty) lastCount.current = unsavedCount;
  const count = dirty ? unsavedCount : lastCount.current;

  return (
    <>
      {bar.mounted ? (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="gw-save-layer safe-bottom"
          style={{ ["--safe-bottom-gap" as string]: "1.25rem" }}
        >
          <div
            key={flashKey}
            ref={card}
            data-enter={bar.state}
            data-enter-from="bottom"
            data-saved={done ? "true" : undefined}
            className={`gw-save ${flashKey ? "gator-save-flash" : ""}`}
          >
            {/* The changes about to be written, one line each, with a way to
               undo just that one. */}
            {peek && !done ? (
              <div className="gw-save-peek" role="list" aria-label="Unsaved changes">
                {changes.map((path) => {
                  const change = describeChange(path);
                  return (
                    <div className="gw-save-item" role="listitem" key={path}>
                      <span className="gw-save-item-say">
                        <span className="gw-save-item-name">{change.label}</span>
                        {change.where ? <span className="gw-save-item-where">{change.where}</span> : null}
                      </span>
                      <button
                        type="button"
                        className="gw-save-item-undo"
                        aria-label={`Put back ${change.label}`}
                        title="Put this one back"
                        onClick={() => revert(path)}
                      >
                        <IconArrowBackUp size={15} />
                      </button>
                    </div>
                  );
                })}
                {beyond ? <p className="gw-save-item-more">{beyond.charAt(0).toUpperCase() + beyond.slice(1)}</p> : null}
              </div>
            ) : null}
            <div className="gw-save-row">
              {done ? (
                <p className="gw-save-say gw-save-done" aria-live="polite">
                  <svg className="gw-save-tick" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                  Saved
                </p>
              ) : (
                <button
                  type="button"
                  className="gw-save-say"
                  aria-expanded={peek}
                  onClick={() => setPeek((open) => !open)}
                  title={peek ? "Hide the changes" : "See what changed"}
                >
                  <span className="gw-save-count" key={count}>
                    {count}
                  </span>{" "}
                  unsaved change{count === 1 ? "" : "s"}
                  <IconChevronUp size={14} className="gw-save-chev" aria-hidden="true" />
                </button>
              )}
              {done ? null : (
                <>
                  <button
                    type="button"
                    onClick={discard}
                    disabled={saving}
                    className="gw-save-undo"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={() => save(module)}
                    disabled={saving || !dirty}
                    className="gw-save-go"
                    data-saving={saving ? "true" : undefined}
                  >
                    {/* Runs once for every new change. */}
                    {saving ? null : <span className="gw-save-sheen" key={count} aria-hidden="true" />}
                    {saving ? <span className="gw-save-spin" aria-hidden="true" /> : null}
                    {saving ? "Saving" : "Save"}
                    {saving ? null : <kbd className="gw-save-kbd" aria-hidden="true">{shortcut}</kbd>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* One toaster, always mounted (rendering it from two branches remounted
         the stack). It lifts above the save prompt rather than hiding, because
         a failed save's message arrives while the prompt is up. */}
      <Toasts lifted={bar.mounted} />
    </>
  );
}

/**
 * Where toasts appear and what they are drawn in: Sonner handles layout and
 * motion; unstyled so the toast uses the window's surface and face. Lifted
 * clear of the save prompt and, on a phone, the dock.
 */
/* Memoised and given its direction explicitly, so it does not recalculate the
   document's text direction on every keystroke under the save prompt. */
const Toasts = React.memo(function Toasts({ lifted }: { lifted: boolean }) {
  useTapToCollapse();
  return (
    <Toaster
      dir="ltr"
      position="bottom-right"
      gap={8}
      visibleToasts={3}
      // Above the window's status strip, which holds what a toast is often
      // about (the count of modules on, what needs fixing).
      offset={{ bottom: lifted ? 100 : 64, right: 20 }}
      mobileOffset={{ bottom: 86, left: 8, right: 8 }}
      swipeDirections={["bottom", "right"]}
      className="gw-toaster"
      style={{ ["--width" as string]: "400px" }}
      icons={{
        success: <IconCircleCheck size={16} />,
        error: <IconAlertTriangle size={16} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "gw-toast",
          title: "gw-toast-say",
          icon: "gw-toast-mark",
          actionButton: "gw-toast-act",
        },
      }}
    />
  );
});

/**
 * A second tap on the stack folds it back up (Sonner folds on pointer leave,
 * which a finger never does). Handled on click, after touch's emulated mouse
 * events, and not when the tap is on a toast's own button.
 */
function useTapToCollapse() {
  React.useEffect(() => {
    let wasOpen = false;
    const toasterOf = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>("[data-sonner-toaster]")
        : null;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const toaster = toasterOf(event.target);
      wasOpen = Boolean(
        toaster?.querySelector('[data-sonner-toast][data-expanded="true"]') &&
          toaster.querySelectorAll("[data-sonner-toast]").length > 1,
      );
    };
    const onClick = (event: MouseEvent) => {
      const toaster = toasterOf(event.target);
      if (!toaster || !wasOpen) return;
      wasOpen = false;
      if ((event.target as Element).closest("button, a")) return;
      window.requestAnimationFrame(() => {
        // React reads a pointer leaving from `mouseout` with somewhere else
        // as where it went.
        toaster.dispatchEvent(
          new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }),
        );
      });
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
}
