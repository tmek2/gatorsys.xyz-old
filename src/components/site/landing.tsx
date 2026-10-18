"use client";

/* The landing page: one screen and a window.

   The screen is the hero (the header, one line saying what Bot is, and two
   actions). It is sticky, so scrolling does not leave it; scrolling raises a
   window over it. That window is the About page (there is no /about route).
   Nothing animates on a timer: the only motion is the window following the
   scroll, driven by the browser's scroll timeline where available. */

import { useCallback, useEffect, useRef, useState } from "react";
import { IconLayoutDashboard } from "@tabler/icons-react";
import { getDiscordBotInviteUrl } from "@/utils/discord-links";
import { DiscordLogo } from "@/components/brand-icons";
import { SiteNav, type LandingUser } from "./site-nav";
import { SmoothScroll } from "./smooth-scroll";
import { glide } from "./glide";
import { RippleButton, RippleButtonRipples } from "./ripple-button";
import { Finder } from "./mac/finder";
import { DotField } from "./dot-field";
import { FooterLine } from "./site-footer";
import "./tokens.css";
import "./astryx-theme.css";
import "./landing.css";
import "./mac/mac.css";
/* What is inside a folder, on both platforms: one grouped-list grammar, which
   is the only shape Apple builds a detail view out of. */
import "./mac/sheet.css";
/* The phone. Not a set of overrides on the sheet above it — a second design
   for a second component, which is what ios.css now describes. */
import "./mac/ios.css";

export type { LandingUser };

export function LandingPage({ user }: { user: LandingUser | null }) {
  const page = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  /* Opening and closing the window is scrolling the page, since the window's
     position is bound to the scroll. Both go through `glide`, which scrolls on
     the site's own curve (and does not animate under reduced motion). */
  const raise = useCallback(() => {
    const node = page.current;
    if (!node) return;
    glide(node.offsetTop + node.offsetHeight - window.innerHeight);
  }, []);

  const lower = useCallback(() => {
    glide(0);
  }, []);

  /* Escape puts the window away from anywhere, which is the one shortcut
     everybody already tries on something that looks like this. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") lower();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lower]);

  return (
    <div className="g-root g-poster" data-open={open ? "true" : "false"}>
      {/* The runway. Two screens tall: the first is the hero, the second is
          the distance the window travels. */}
      <div className="g-page" ref={page}>
        <div className="g-hero-sticky">
          <DotField className="g-hero-field" />

          {/* A wheel notch sets a destination and the page eases to it.
             Trackpads already glide and are left alone. */}
          <SmoothScroll />
          <SiteNav user={user} leading="brand" />

          <main className="g-hero" inert={open}>
            <h1 className="g-hero-h1">
              {"Your community. "}
              <br className="g-break-wide" />
              {"One dashboard."}
            </h1>

            {/* The explanation and the two actions share one row; the actions
               stack below the copy when they no longer fit. */}
            <div className="g-hero-foot">
              <div className="g-hero-say">
                <p className="g-hero-lede">
                  Manage sessions, shifts, tickets, infractions, and leave from
                  one dashboard.
                </p>
              </div>

              <div className="g-hero-actions">
                <RippleButton
                  className="g-add"
                  size="lg"
                  /* The same invite link as /servers, in a new tab. No
                     redirect: Discord rejects an invite whose `redirect_uri` is
                     not registered on the app. */
                  onClick={() => {
                    window.open(getDiscordBotInviteUrl(), "_blank", "noopener,noreferrer");
                  }}
                >
                  <DiscordLogo size={17} />
                  Add bot
                  <RippleButtonRipples />
                </RippleButton>

                <RippleButton
                  as="a"
                  className="g-open"
                  href="/servers"
                  variant="secondary"
                  size="lg"
                >
                  <IconLayoutDashboard
                    className="g-open-icon"
                    size={17}
                    stroke={1.9}
                    aria-hidden="true"
                  />
                  Dashboard
                  <RippleButtonRipples />
                </RippleButton>
              </div>
            </div>
          </main>

          {/* Two ways up: this pill, and the parked window itself (its grip
             lives inside the window). Both scroll the page, since the window's
             position is bound to the scroll. */}
          <button className="g-raise" type="button" onClick={raise}>
            Explore features
          </button>
          <FooterLine />
        </div>

        <Finder
          onRequestClose={lower}
          onRequestOpen={raise}
          registerOpen={setOpen}
        />
      </div>
    </div>
  );
}
