"use client";

/* The header on a phone.

   Below 900px the header's three links are hidden, so this menu replaces them.
   It also takes appearance and the account into its sheet, leaving only search
   beside it (four identical circles in the corner would have no hierarchy). The
   result is shaped like iOS Settings: the account at the top with a face, the
   places to go under it, and appearance as a three-way segmented control.

   It opens as an action sheet from the bottom edge, where a thumb can reach
   every row, using iOS metrics: 36×5pt grabber, 14pt corner radius, 56pt rows
   with inset hairlines, a 32pt segmented control, and 44pt minimum targets.

   Rendered through a portal: the header bar sets `z-index: 0` to make its own
   stacking context, so any z-index inside it is scoped under the landing
   window's. */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { DOCS_URL, SUPPORT_URL } from "@/config/site";
import { useAppearance } from "./theme-toggle";
import type { LandingUser } from "./site-nav";
import {
  ArrowUpForward,
  BookClosed,
  ChevronRight,
  Lifepreserver,
  Line3Horizontal,
  PersonCropCircle,
  SquareGridDashboard,
} from "./mac/sf";

const ROWS = [
  {
    href: DOCS_URL,
    label: "Documentation",
    detail: "Setup and reference guides",
    Icon: BookClosed,
    external: DOCS_URL.startsWith("http"),
  },
  {
    href: "/servers",
    label: "Dashboard",
    detail: "Where the settings live",
    Icon: SquareGridDashboard,
    external: false,
  },
  {
    href: SUPPORT_URL,
    label: "Support",
    detail: "Help and contact information",
    Icon: Lifepreserver,
    external: SUPPORT_URL.startsWith("http"),
  },
];

export function NavMenu({ user }: { user: LandingUser | null }) {
  const here = usePathname();
  const [open, setOpen] = useState(false);
  /* Closing is its own state, so the exit animation plays before React unmounts
     the sheet. */
  const [closing, setClosing] = useState(false);
  const sheet = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const { theme, set, options } = useAppearance();

  const close = useCallback(() => {
    /* Focus returns to the button that opened it immediately, not after the
       animation. */
    button.current?.focus();
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setOpen(false);
      return;
    }
    setClosing(true);
  }, []);

  // The sheet is gone once its exit has finished playing.
  const finished = useCallback(() => {
    setClosing(false);
    setOpen(false);
  }, []);

  /* A fallback timeout ends the close if `animationend` never arrives: a scrim
     that never unmounts would leave the site unclickable. */
  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(finished, 600);
    return () => window.clearTimeout(id);
  }, [closing, finished]);

  useEffect(() => {
    if (!open) return;
    sheet.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button
        ref={button}
        className="g-burger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Line3Horizontal size={22} weight={2} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="g-sheet-layer"
              data-closing={closing ? "true" : "false"}
            >
              {/* The scrim is the way out, and it is a real, labelled button:
                 tapping off, Escape and keyboard focus all reach the same
                 control. (This is a menu of places, dismissed by tapping off or
                 pulling down, so it has no Cancel button.) */}
              <button
                className="g-sheet-scrim"
                type="button"
                onClick={close}
                aria-label="Close menu"
              />

              <div
                className="g-action-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                tabIndex={-1}
                ref={sheet}
                onAnimationEnd={(event) => {
                  // Only the sheet's own exit ends it, not a child's animation.
                  if (closing && event.target === event.currentTarget) finished();
                }}
              >
                <span className="g-sheet-grab" aria-hidden="true" />

                {/* The account, at the top with a face on it, which is where
                    iOS Settings puts it and why that screen is legible. */}
                <div className="g-action-group">
                  {user ? (
                    <Link className="g-action-row" href="/account" onClick={close}>
                      <span className="g-action-face">
                        {user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.image} alt="" />
                        ) : (
                          <PersonCropCircle size={26} />
                        )}
                      </span>
                      <span className="g-action-text">
                        <span className="g-action-label">
                          {user.name ?? "Account"}
                        </span>
                        <span className="g-action-detail">
                          Your servers and connections
                        </span>
                      </span>
                      <ChevronRight size={15} weight={2.5} className="g-action-chev" />
                    </Link>
                  ) : (
                    <a className="g-action-row" href="/auth/discord" onClick={close}>
                      <span className="g-action-face g-action-face-empty">
                        <PersonCropCircle size={26} />
                      </span>
                      <span className="g-action-text">
                        <span className="g-action-label">Sign in</span>
                        <span className="g-action-detail">With Discord</span>
                      </span>
                      <ChevronRight size={15} weight={2.5} className="g-action-chev" />
                    </a>
                  )}
                </div>

                <div className="g-action-group">
                  {ROWS.map(({ href, label, detail, Icon, external }) =>
                    external ? (
                      <a
                        className="g-action-row"
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={close}
                      >
                        <span className="g-action-glyph">
                          <Icon size={22} />
                        </span>
                        <span className="g-action-text">
                          <span className="g-action-label">{label}</span>
                          <span className="g-action-detail">{detail}</span>
                        </span>
                        <ArrowUpForward
                          size={15}
                          weight={2.3}
                          className="g-action-chev"
                        />
                      </a>
                    ) : (
                      <Link
                        className="g-action-row"
                        key={href}
                        href={href}
                        /* Pressing the current page's link shuts the sheet
                           instead of fetching the same page again. */
                        onClick={(event) => {
                          if (here === href) event.preventDefault();
                          close();
                        }}
                      >
                        <span className="g-action-glyph">
                          <Icon size={22} />
                        </span>
                        <span className="g-action-text">
                          <span className="g-action-label">{label}</span>
                          <span className="g-action-detail">{detail}</span>
                        </span>
                        <ChevronRight
                          size={15}
                          weight={2.5}
                          className="g-action-chev"
                        />
                      </Link>
                    ),
                  )}
                </div>

                {/* Appearance as the three-way segmented control from iOS's
                   Display & Brightness: all three states visible, one press to
                   any, Auto named. */}
                {/* The caption sits above the card, like every grouped-list
                   caption on the site. */}
                <span className="g-action-cap">Appearance</span>
                <div className="g-action-group g-action-appearance">
                  <div
                    className="g-action-seg"
                    role="group"
                    aria-label="Appearance"
                    data-at={
                      theme ? String(options.findIndex((o) => o.value === theme)) : "0"
                    }
                  >
                    {/* Drawn only once the stored value has been read, so the
                       pill never shows a guessed setting. */}
                    {theme ? <span className="g-action-seg-pill" aria-hidden="true" /> : null}
                    {options.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        data-tap="inline"
                        data-on={theme === value ? "true" : "false"}
                        aria-pressed={theme === value}
                        onClick={(event) => set(value, event.currentTarget)}
                      >
                        {label.replace(" mode", "").replace("Match device", "Auto")}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
