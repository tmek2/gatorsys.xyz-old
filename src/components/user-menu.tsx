"use client";


import { DOCS_URL } from "@/config/site";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { UserAvatar } from "./user-avatar";
import {
  IconChevronDown,
  IconFileDescription,
  IconLogout as LogOut,
  IconServer as Server,
  IconSettings,
} from "@tabler/icons-react";
import "./user-menu.css";

type UserMenuProps = {
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  openOnHover?: boolean;
};

/**
 * Account dropdown in the top bar, with plain state and portals: the top bar
 * uses backdrop-blur, which makes it the containing block for fixed-position
 * children, so the menu and the sign-out dialog are portalled to <body>.
 */
export function UserMenu({ user, openOnHover = true }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  // The panel mounts closed and opens on the next frame, so there is always a
  // starting frame to transition from.
  const [entered, setEntered] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setEntered(false);
      const hideTimer = window.setTimeout(() => setMenuVisible(false), 300);
      return () => window.clearTimeout(hideTimer);
    }
    setMenuVisible(true);
    function place() {
      const box = buttonRef.current?.getBoundingClientRect();
      if (!box) return;
      // `clientWidth`, not `innerWidth`: the latter includes the scrollbar and,
      // on a pinch-zoomed phone, describes the layout viewport rather than the
      // visible one.
      const viewport =
        document.documentElement.clientWidth || window.innerWidth;
      // Clamp so the panel never hangs off the right edge (or tucks under a
      // rounded nav pill), which made it look cut off rather than fully open.
      setAnchor({
        top: box.bottom + 10,
        right: Math.max(8, viewport - box.right),
      });
    }
    place();
    // Two frames: one to commit the closed state, one to flip it open. A single
    // rAF can still land inside the same paint and skip the transition.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setEntered(true));
    });
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    // `pointerdown` as well as `mousedown`: on iOS a tap on something
    // non-interactive does not reliably produce a mouse event, so tapping away
    // would not close the menu.
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    // The keyboard and the URL bar both change the height a phone actually
    // has, and neither fires `resize` on every browser.
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Keep the page still while the sign-out confirmation is up.
  useEffect(() => {
    if (!confirmSignOut) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [confirmSignOut]);

  if (!user) return null;

  const displayName = user.name || user.email || "User";
  // The @handle, which is what people recognise themselves by. NextAuth gives
  // Discord's username here; the display name above it can be anything.
  const handle = (user as { username?: string | null }).username || user.name || null;
  const openMenu = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => {
          if (openOnHover && window.matchMedia("(hover: hover)").matches) {
            openMenu();
          } else {
            setOpen((current) => !current);
          }
        }}
        /* Pointer handlers checking `pointerType` instead of
           mouseenter/mouseleave: a touch browser synthesises mouse events for a
           tap, so `mouseenter` would open the menu and the following click
           would close it again. */
        onPointerEnter={(event) => {
          if (openOnHover && event.pointerType === "mouse") openMenu();
        }}
        onPointerLeave={(event) => {
          if (openOnHover && event.pointerType === "mouse") scheduleClose();
        }}
        /* A circle that opens into a pill on hover showing who you are. The
           identity is a grid column animating from `0fr` to `1fr` rather than a
           width animation, because the trigger sits inside `.tg-nav-links`,
           which also widens on hover, and two width animations fought for
           space. Hover shows who you are; click opens the menu. */
        className="user-menu-trigger"
        data-open={open ? "true" : "false"}
        title={displayName}
      >
        <span className="user-menu-face">
          <UserAvatar user={user} className="h-full w-full" />
        </span>
        <span className="user-menu-identity">
          <span className="user-menu-identity-inner">
            <span className="user-menu-identity-name">{displayName}</span>
            {handle ? (
              <span className="user-menu-identity-handle">@{handle}</span>
            ) : null}
          </span>
        </span>
        <span className="user-menu-caret" aria-hidden="true">
          <IconChevronDown size={14} />
        </span>
      </button>

      {menuVisible && anchor && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              data-open={open && entered ? "true" : "false"}
              /* Mouse only, via `pointerType`: a synthesised mouseenter on the
                 panel would reopen a menu just tapped closed. */
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") openMenu();
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") scheduleClose();
              }}
              style={{
                position: "fixed",
                top: anchor.top,
                right: anchor.right,
                zIndex: 500,
                // Read by the stylesheet's `max-height`, so the panel fits the
                // space actually below the trigger.
                ["--user-menu-top" as string]: `${anchor.top}px`,
              }}
              className="gator-user-menu w-60 rounded-2xl border border-white/[0.08] bg-[#090909]/95 p-2 shadow-2xl shadow-black/45 ring-1 ring-black/10 backdrop-blur-xl"
            >
              {/* Name, handle, id: the handle leads (it is what people
                 recognise), the id sits under it in mono. */}
              <div className="flex items-center gap-3 border-b border-white/[0.08] px-3 py-3">
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
                  <UserAvatar user={user} className="h-full w-full" />
                </span>
                <span className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">
                  {displayName}
                </p>
                {handle ? (
                  <p className="truncate text-xs font-semibold text-white/45">
                    @{handle}
                  </p>
                ) : null}
                {user.id ? (
                  <p className="truncate font-mono text-[11px] text-white/25">
                    {user.id}
                  </p>
                ) : null}
                </span>
              </div>
              <div className="py-1">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="gator-user-menu-item"
                >
                  <IconSettings className="h-4 w-4 text-[var(--accent-peach)]" />
                  Account &amp; Settings
                </Link>
                {/* The slot a Premium entry would take, given to what people
                   open this menu for. */}
                <Link
                  href="/servers"
                  onClick={() => setOpen(false)}
                  className="gator-user-menu-item"
                >
                  <Server className="h-4 w-4 text-[var(--accent-peach)]" />
                  Servers
                </Link>
                {/* No Roblox row: whether Roblox is linked is shown on the
                   account page. */}
                <Link
                  href={DOCS_URL}
                  target="_blank"
                  onClick={() => setOpen(false)}
                  className="gator-user-menu-item"
                >
                  <IconFileDescription className="h-4 w-4 text-[var(--accent-peach)]" />
                  Documentation
                </Link>
                <div className="my-1 h-px bg-white/[0.06]" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmSignOut(true);
                  }}
                  className="gator-user-menu-item gator-user-menu-danger"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {confirmSignOut && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
              <button
                type="button"
                aria-label="Cancel sign out"
                className="absolute inset-0 bg-[#030303]/78 backdrop-blur-xl"
                onClick={() => setConfirmSignOut(false)}
              />
              <section className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#080808]/95 p-5 text-center shadow-2xl shadow-black/55 ring-1 ring-white/[0.04]">
                <h2 className="text-2xl font-extrabold text-[#f7faff]">
                  Sign out?
                </h2>
                <p className="cool-text mx-auto mt-3 max-w-xs text-sm leading-6">
                  Are you sure you want to sign out?
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmSignOut(false)}
                    className="btn-pop btn-quiet h-9 min-w-28 px-4 text-sm"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="btn-pop btn-peach h-9 min-w-28 px-4 text-sm"
                  >
                    Yes
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
