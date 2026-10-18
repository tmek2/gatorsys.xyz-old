"use client";

/* The empty server list: an open, empty box with the one action that fills it
   sitting in it.

   The button is always visible and hittable (hover lifts it the rest of the way
   and fans the cards behind it), so nothing depends on a gesture phones and
   keyboards lack, and the motion can be interrupted halfway. On touch and under
   reduced motion they rest in the lifted position. */

import { IconPlus } from "@tabler/icons-react";
import { RippleButton, RippleButtonRipples } from "@/components/site/ripple-button";
import { DiscordLogo } from "@/components/brand-icons";
import { MODULE_COUNT } from "@/components/site/modules";
import "./empty-box.css";

/* The two slips behind the button: what adding Bot gives you, named. Not
   buttons. */
const SLIPS = [
  { key: "modules", title: `${MODULE_COUNT} modules`, sub: "on by default" },
  { key: "setup", title: "No commands", sub: "it is all a dashboard" },
];

export function EmptyBox({ inviteUrl }: { inviteUrl?: string }) {
  return (
    <div className="g-box">
      <div className="g-box-stage">
        {/* The back of the box and its two open flaps. Drawn behind
            everything, so what comes out comes out of it. */}
        <svg className="g-box-art g-box-back" viewBox="0 0 320 240" aria-hidden="true">
          <defs>
            <linearGradient id="g-box-flap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--box-flap-a)" />
              <stop offset="1" stopColor="var(--box-flap-b)" />
            </linearGradient>
          </defs>
          {/* Left flap, folded up and away. */}
          <path
            d="M18 42 L92 74 L80 96 L6 64 Z"
            fill="url(#g-box-flap)"
            stroke="var(--box-edge)"
            strokeWidth="1"
          />
          {/* Right flap. */}
          <path
            d="M302 42 L228 74 L240 96 L314 64 Z"
            fill="url(#g-box-flap)"
            stroke="var(--box-edge)"
            strokeWidth="1"
          />
          {/* The inside, which is the dark you see down into. */}
          <path d="M74 96 L246 96 L238 132 L82 132 Z" fill="var(--box-void)" />
        </svg>

        {/* What is in it. These sit between the back and the front, so they
            genuinely rise out rather than over. */}
        <div className="g-box-load">
          {SLIPS.map((slip, i) => (
            <span
              className="g-box-slip"
              key={slip.key}
              style={{ ["--n" as string]: i }}
              aria-hidden="true"
            >
              <b>{slip.title}</b>
              <i>{slip.sub}</i>
            </span>
          ))}

          {inviteUrl ? (
            <RippleButton
              as="a"
              href={inviteUrl}
              target="_blank"
              rel="noreferrer"
              className="g-box-cta"
              size="lg"
            >
              <DiscordLogo size={17} />
              Add Bot
              <RippleButtonRipples />
            </RippleButton>
          ) : (
            <span className="g-box-cta g-box-cta-quiet">
              <IconPlus size={16} />
              Add Bot
            </span>
          )}
        </div>

        {/* The near face, over the top of the load. */}
        <svg className="g-box-art g-box-front" viewBox="0 0 320 240" aria-hidden="true">
          <defs>
            <linearGradient id="g-box-face" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--box-face-a)" />
              <stop offset="1" stopColor="var(--box-face-b)" />
            </linearGradient>
            <linearGradient id="g-box-lip" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--box-lip-a)" />
              <stop offset="1" stopColor="var(--box-lip-b)" />
            </linearGradient>
          </defs>
          {/* The front flap, folded down toward you. */}
          <path
            d="M62 96 L258 96 L244 140 L76 140 Z"
            fill="url(#g-box-lip)"
            stroke="var(--box-edge)"
            strokeWidth="1"
          />
          {/* And the body. */}
          <path
            d="M76 140 L244 140 L236 226 L84 226 Z"
            fill="url(#g-box-face)"
            stroke="var(--box-edge)"
            strokeWidth="1"
          />
        </svg>
      </div>

      <h3 className="g-box-title">Nothing in here yet</h3>
      {/* One sentence. */}
      <p className="g-box-say">
        Add Bot to a server you administer and it shows up here.
      </p>
    </div>
  );
}
