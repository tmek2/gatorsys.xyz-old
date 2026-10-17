"use client";

import React from "react";
import { useSectionIdentity } from "./section-identity";

/**
 * The top of a /manage tab: the title, an optional kicker and emphasised
 * phrase, and the actions. `editorial` (on by default) shows the kicker and the
 * larger title.
 */

export function SectionHeader({
  title,
  emphasis,
  actions,
  kicker,
  editorial = true,
}: {
  title: string;
  /** Optional italic/script accent phrase inserted after the plain title. */
  emphasis?: string;
  actions?: React.ReactNode;
  /** Small pre-title label; a light "location" cue. Only shown in editorial. */
  kicker?: string;
  /**
   * The kicker and the larger title. On by default: the top of a tab is where
   * the display treatment belongs.
   */
  editorial?: boolean;
}) {
  /* The tab's own glyph, large and faint behind the end of its header (like the
     Overview's module cards), so each tab looks distinct without a boxed icon
     or category pill. */
  const identity = useSectionIdentity();
  const eyebrow = kicker;
  return (
    <div
      className="section-header tab-page-header flex flex-wrap items-start justify-between gap-4"
      data-editorial={editorial ? "true" : undefined}
      data-identity={identity.icon ? "true" : undefined}
    >
      {identity.icon ? (
        <span className="gw-hero-ghost" aria-hidden="true">
          {identity.icon}
        </span>
      ) : null}
      <div className="min-w-[16rem] flex-1">
        {editorial && eyebrow ? (
          <span className="manage-kicker" data-testid="section-kicker">
            {eyebrow}
          </span>
        ) : null}
        <h2
          className={
            editorial
              ? "section-header-title manage-editorial-title"
              : "section-header-title text-xl font-extrabold tracking-tight text-[#f5f2f2]"
          }
          data-testid="section-header-title"
        >
          {title}
          {emphasis ? (
            <>
              {" "}
              <em className="accent">{emphasis}</em>
            </>
          ) : null}
        </h2>
        {/* No description under the title: the tab name, the rail and the card
           that opened it already say what it is. */}
      </div>
      {actions ? <div className="gw-hero-acts shrink-0">{actions}</div> : null}
    </div>
  );
}
