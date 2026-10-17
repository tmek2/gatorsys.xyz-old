"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconArrowRight,
  IconMenu2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/Manage/theme-toggle";
import { NAV_LINKS, SITE_NAME, SUPPORT_URL } from "@/config/site";

type HeaderShellProps = {
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  /** Always full-width and flush to the top — no scroll morph into a pill.
   *  Used on reader / viewer pages that pin the nav above a secondary bar. */
  pinned?: boolean;
};

export function HeaderShell({ user, pinned = false }: HeaderShellProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Freeze the page behind the mobile menu while it is open.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // Freeze the page behind the search overlay while it is open.
  useEffect(() => {
    if (!searchOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [searchOpen]);

  return (
    <>
      <header
        data-pinned={pinned ? "true" : "false"}
        className="topbar-frame fixed left-0 top-0 z-50 w-full"
      >
        <nav
          className="topbar-shell mx-auto grid h-16 grid-cols-[1fr_auto_1fr] items-center border px-5 text-sm"
        >
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 justify-self-start"
          >
            <img
              src="/gator-logo.png"
              alt="Gator"
              className="h-8 w-7 shrink-0 object-contain"
            />
            <span
              className="topbar-logo-text hidden whitespace-nowrap text-lg font-bold tracking-tight text-white sm:block"
            >
              {SITE_NAME}
            </span>
          </Link>

          <div
            className="relative hidden items-center gap-1 justify-self-center md:flex"
          >
            {NAV_LINKS.map((link) => {
              const active =
                link.href.startsWith("/") &&
                (pathname === link.href ||
                  pathname?.startsWith(`${link.href}/`));

              const sharedProps = {
                className: `topbar-nav-link nav-link relative z-10 ${
                  active ? "text-white" : ""
                }`,
                "data-active": active,
              };

              return link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...sharedProps}
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} {...sharedProps}>
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Pinned to the last grid column: when the desktop nav is hidden on
             mobile, auto-placement would otherwise centre these buttons. */}
          <div className="col-start-3 flex items-center gap-2 justify-self-end">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="icon-button flex"
            >
              <IconSearch className="size-4" />
            </button>
            {/* Sign-in and the user menu show on desktop; on mobile they live in
               the menu, except the small avatar. */}
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Link
                href="/auth/discord"
                className="btn-pop btn-peach inline-flex h-9 items-center px-4"
              >
                Login
              </Link>
            )}
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="icon-button flex md:hidden"
            >
              {menuOpen ? (
                <IconX className="size-5" />
              ) : (
                <IconMenu2 className="size-5" />
              )}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile navigation menu */}
      {menuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="glass-panel animate-fade-up mx-3 mt-[4.5rem] overflow-hidden rounded-2xl p-2 shadow-2xl shadow-black/50"
          >
            {NAV_LINKS.map((link) => {
              const active =
                link.href.startsWith("/") &&
                (pathname === link.href ||
                  pathname?.startsWith(`${link.href}/`));
              const className = `flex items-center justify-between rounded-xl px-4 py-4 text-base font-bold transition-colors ${
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-white/80 hover:bg-white/[0.04]"
              }`;
              return link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className={className}
                >
                  {link.label}
                  <IconArrowRight className="size-4 text-white/35" />
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={className}
                >
                  {link.label}
                  <IconArrowRight className="size-4 text-white/35" />
                </Link>
              );
            })}
            <div className="my-1.5 h-px bg-white/[0.08]" />
            {user ? (
              <Link
                href="/servers"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between rounded-xl px-4 py-4 text-base font-bold text-white/80 transition-colors hover:bg-white/[0.04]"
              >
                Your servers
                <IconArrowRight className="size-4 text-white/35" />
              </Link>
            ) : (
              <Link
                href="/auth/discord"
                onClick={() => setMenuOpen(false)}
                className="btn-pop btn-peach mx-1 my-1 flex h-11 items-center justify-center text-sm font-bold"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {searchOpen
        ? (() => {
            const term = searchQuery.trim().toLowerCase();
            const links = [
              [
                "Dashboard",
                "/servers",
                "Manage the communities connected to Gator.",
              ],
              [
                "Features",
                "/#features",
                "Explore Gator's moderation and staff tools.",
              ],
              [
                "Documentation",
                "https://docs.gatorsys.xyz",
                "Read the full Gator documentation.",
              ],
              ["Support", SUPPORT_URL, "Get help from the Gator team."],
            ].filter(
              ([label, , description]) =>
                !term || `${label} ${description}`.toLowerCase().includes(term),
            );
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Search Gator"
                onClick={() => setSearchOpen(false)}
                className="fixed inset-0 z-[60] flex cursor-default items-center justify-center bg-black/60 px-4 backdrop-blur-md"
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="glass-panel animate-pop-in w-full max-w-xl cursor-auto overflow-hidden rounded-2xl p-2 shadow-2xl shadow-black/50"
                >
                  <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
                    <IconSearch className="size-4 text-[var(--accent-peach)]" />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search documentation and pages"
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
                    />
                    <button
                      aria-label="Close search"
                      onClick={() => setSearchOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-white/55 transition duration-300 ease-premium hover:bg-white/10 hover:text-white"
                    >
                      <IconX className="size-4" />
                    </button>
                  </div>
                  <div className="max-h-[55vh] overflow-y-auto p-2">
                    {links.map(([label, href, description]) => (
                      <a
                        key={href}
                        href={href}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel={
                          href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        onClick={() => setSearchOpen(false)}
                        className="group flex items-center justify-between rounded-xl px-3 py-3 transition duration-300 ease-premium hover:bg-white/[0.06]"
                      >
                        <span>
                          <span className="block text-sm font-bold text-white">
                            {label}
                          </span>
                          <span className="block text-xs font-medium text-white/55">
                            {description}
                          </span>
                        </span>
                        <IconArrowRight className="size-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent-peach)]" />
                      </a>
                    ))}
                    {links.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-white/55">
                        Nothing matches “{searchQuery}”.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })()
        : null}
    </>
  );
}
