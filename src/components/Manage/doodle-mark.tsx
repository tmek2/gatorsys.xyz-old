"use client";

import React from "react";

/**
 * A hand-drawn doodle mark for /manage, from a small curated set of SVGs in
 * /public/doodle. Decoration around real work; add a name to `DOODLES` to use
 * another.
 */

export const DOODLES = {
  dashboard: "/doodle/interface/dashboard.svg",
  puzzle: "/doodle/interface/puzzle.svg",
  shield: "/doodle/interface/shield.svg",
  users: "/doodle/interface/user.svg",
  rocket: "/doodle/misc/rocket.svg",
  trophy: "/doodle/misc/trophy.svg",
  bot: "/doodle/misc/bot.svg",
  bulb: "/doodle/interface/bulb.svg",
  bell: "/doodle/interface/bell.svg",
  settings: "/doodle/interface/setting.svg",
  bookmark: "/doodle/interface/bookmark.svg",
  home: "/doodle/interface/home.svg",
  folder: "/doodle/interface/folder.svg",
  fire: "/doodle/misc/fire.svg",
  spark: "/doodle/misc/hot-air-balloon.svg",
} as const;

export type DoodleName = keyof typeof DOODLES;

export function DoodleMark({
  name,
  className,
  size = 22,
  fill = false,
  title,
}: {
  name: DoodleName;
  className?: string;
  size?: number;
  fill?: boolean;
  title?: string;
}) {
  const href = DOODLES[name];
  return (
    <span
      className={`doodle-mark ${className ?? ""}`}
      data-fill={fill ? "true" : undefined}
      style={{ width: size, height: size }}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {/* An <img>, which keeps the SVG's own colours and still takes a CSS
         filter for dark surfaces. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={href} alt="" width={size} height={size} draggable={false} />
    </span>
  );
}
