"use client";

/* One header for every page. On the landing the leading slot is the mark and
   wordmark; everywhere else it is a back button in the same place. Sign in and
   the avatar are styled here beside the back button and profile chip, using
   this site's palette. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Link, useTransitionRouter } from "next-view-transitions";
import { IconArrowLeft, IconBook2, IconLayoutDashboard, IconLifebuoy } from "@tabler/icons-react";
import { DOCS_URL, SUPPORT_URL, SITE_NAME } from "@/config/site";
import { AppLogo } from "./app-logo";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { HoverTip } from "./hover-tip";
import { NavMenu } from "./nav-menu";

export interface LandingUser {
  id: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
}

/* Configured external destinations use ordinary anchors. */
const LINKS = [
  { href: DOCS_URL, label: "Documentation", Icon: IconBook2, external: DOCS_URL.startsWith("http") },
  { href: "/servers", label: "Dashboard", Icon: IconLayoutDashboard, external: false },
  { href: SUPPORT_URL, label: "Support", Icon: IconLifebuoy, external: SUPPORT_URL.startsWith("http") },
];

/* `useLayoutEffect` warns on the server and `useEffect` runs after the first
   paint (the blob would be on the wrong link for a frame), so pick per
   environment. */
const useMeasure = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SiteNav({
  user,
  leading = "brand",
  backHref,
  float = false,
  className,
}: {
  user: LandingUser | null;
  leading?: "brand" | "back";
  /** Where Back goes when history cannot be trusted to hold the answer. */
  backHref?: string;
  /**
   * Draws the bar as a floating pill as the page scrolls. The morph is in the
   * stylesheet, tied to the scroll; this only opts in.
   */
  float?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const transitionRouter = useTransitionRouter();
  const here = usePathname();
  const links = useRef<HTMLElement | null>(null);
  const tabs = useRef(new Map<string, HTMLAnchorElement>());
  const [aimed, setAimed] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  // Where the blob rests when nothing is under the pointer: the link for the
  // page you are on, if one of them is.
  const onPage = LINKS.find((link) => !link.external && link.href === here)?.href ?? null;
  const lit = aimed ?? onPage;

  useMeasure(() => {
    const box = links.current;
    const target = lit ? tabs.current.get(lit) : null;
    if (!box || !target) return;
    const put = () => {
      box.style.setProperty("--nav-blob-x", `${target.offsetLeft}px`);
      box.style.setProperty("--nav-blob-y", `${target.offsetTop}px`);
      box.style.setProperty("--nav-blob-w", `${target.offsetWidth}px`);
      box.style.setProperty("--nav-blob-h", `${target.offsetHeight}px`);
    };
    put();
    // The header reflows with the viewport, and the links move with it.
    const watch = new ResizeObserver(put);
    watch.observe(box);
    return () => watch.disconnect();
  }, [lit]);

  // Squash only on a real move, never on the first paint.
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = Boolean(lit);
      return;
    }
    setMoving(true);
    const id = window.setTimeout(() => setMoving(false), 230);
    return () => window.clearTimeout(id);
  }, [lit]);

  /* Whether there is anywhere on this site to go back to: either the referrer
     is this site (a full load from a click), or the router has moved since the
     tab opened (counted pathnames). Not `history.length`, which counts the
     whole tab. */
  const seen = useRef(0);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    try {
      const from = document.referrer;
      setArrived(Boolean(from) && new URL(from).origin === window.location.origin);
    } catch {
      setArrived(false);
    }
  }, []);
  useEffect(() => {
    seen.current += 1;
  }, [here]);

  const goBack = useCallback(() => {
    /* Back goes up, not back: every page that shows this declares what it is
       inside (a document is inside the site, the Roblox page inside the
       account, the owner console inside the picker), and Back goes there.
       Walking the history from a page header can loop back to the page you are
       on. The history is only a fallback for pages that declare nothing. */
    if (backHref) {
      transitionRouter.push(backHref);
      return;
    }
    if (arrived || seen.current > 1) {
      router.back();
      return;
    }
    transitionRouter.push("/");
  }, [arrived, backHref, router, transitionRouter]);

  return (
    <header
      className={`g-nav ${className ?? ""}`}
      data-float={float ? "true" : "false"}
    >
      {/* The bar is a layer inside the header: the header holds the sticky
         position and the bar morphs, since a sticky element cannot be narrowed
         and rounded without the sticking moving too. */}
      <div className="g-nav-bar">
        {leading === "back" ? (
          <button className="g-back" type="button" onClick={goBack}>
            <IconArrowLeft size={17} stroke={2} />
            Back
          </button>
        ) : (
          <Link className="g-brand" href="/">
            <AppLogo size={30} />
            <span className="g-brand-word">{SITE_NAME}</span>
          </Link>
        )}

        <nav
          ref={links}
          className="g-nav-links"
          aria-label="Primary"
          data-lit={aimed || onPage ? "true" : "false"}
          data-moving={moving ? "true" : "false"}
          onPointerLeave={() => setAimed(null)}
        >
          {/* The travelling highlight. It rests on the current page's link when
             there is one; otherwise it fades out (two of the three links leave
             the site). */}
          <span className="g-nav-blob" aria-hidden="true">
            <span className="g-nav-blob-skin" />
          </span>

          {LINKS.map(({ href, label, Icon, external }) => {
            const shared = {
              className: "g-nav-link",
              ref: (node: HTMLAnchorElement | null) => {
                if (node) tabs.current.set(href, node);
                else tabs.current.delete(href);
              },
              onPointerEnter: () => setAimed(href),
              onFocus: () => setAimed(href),
              onBlur: () => setAimed(null),
            };
            return external ? (
              <a key={href} {...shared} href={href} target="_blank" rel="noreferrer">
                <Icon size={16} stroke={1.8} />
                {label}
              </a>
            ) : (
              <Link
                key={href}
                {...shared}
                href={href}
                aria-current={here === href ? "page" : undefined}
                /* Pressing the link for the page you are on does nothing:
                   `/servers` is `force-dynamic`, so navigating there again
                   would refetch the list from the bot (a few seconds with the
                   old page frozen). The page's own Refresh does that on
                   purpose. */
                onClick={(event) => {
                  if (here !== href) return;
                  event.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Icon size={16} stroke={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <span className="g-nav-spacer" />

        {/* Search, appearance and account, grouped closer together than to the
           links: they are tools, not destinations. */}
        <div className="g-nav-tools">
          <CommandPalette signedIn={Boolean(user?.id)} />
          <ThemeToggle />

          {/* Replaces the links below 900px (shown only there, by the
             stylesheet), and takes appearance and the account into its sheet,
             leaving only search beside it. */}
          <NavMenu user={user} />

          {user ? (
            <HoverTip label="Your account" align="end">
              <Link className="g-profile" href="/account">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="g-profile-face" src={user.image} alt="" />
                ) : (
                  <span className="g-profile-face g-profile-mono" aria-hidden="true">
                    {(user.name ?? "A").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="g-profile-name">{user.name ?? "Account"}</span>
              </Link>
            </HoverTip>
          ) : (
            <HoverTip label="Sign in with Discord" align="end">
              <a className="g-signin" href="/auth/discord">
                Sign in
              </a>
            </HoverTip>
          )}
        </div>
      </div>
    </header>
  );
}
