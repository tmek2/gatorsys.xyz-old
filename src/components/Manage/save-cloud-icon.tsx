"use client";

import React from "react";

/**
 * The save mark: a cloud (the write goes to a server, not a disk). Inlined as
 * JSX so it never waits on a chunk; under 200 bytes of path data. Three states:
 * - `idle`: cloud with an upward arrow (something to send) - `saving`: cloud
 * alone, pulsing - `saved`: cloud with a check
 */
export type SaveCloudState = "idle" | "saving" | "saved";

/** One soft cloud, drawn once and shared by all three states. */
const CLOUD =
  "M7.05 18.4h9.6a3.85 3.85 0 0 0 .62-7.65 5.55 5.55 0 0 0-10.55-1.6 4.13 4.13 0 0 0 .33 9.25Z";

export function SaveCloudIcon({
  size = 15,
  state = "idle",
  className,
}: {
  size?: number;
  state?: SaveCloudState;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`gator-save-cloud${className ? ` ${className}` : ""}`}
      data-state={state}
    >
      <path d={CLOUD} />
      {state === "idle" ? (
        // Up arrow: sending it away from here.
        <>
          <path d="M12 15.1V9.9" />
          <path d="M9.9 12l2.1-2.1 2.1 2.1" />
        </>
      ) : null}
      {state === "saved" ? <path d="M9.6 13.4l1.85 1.85 3.3-3.85" /> : null}
    </svg>
  );
}
