"use client";

import React from "react";
import Link from "next/link";
import { GatorLogo } from "@/components/site/gator-logo";
import { RippleButton, RippleButtonRipples } from "@/components/site/ripple-button";
import "@/components/site/tokens.css";
import "./status-screen.css";

/* A page with one thing to say (not found, something went wrong, not yours to
   see, verified): the mark, a short line, a sentence saying what to do, and at
   most two actions, the first in the accent. On the landing's ground. */

export interface StatusAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function StatusScreen({
  label,
  title,
  children,
  actions = [],
  mark,
  lines,
}: {
  /** A small line over the title: "404", "Verified". */
  label?: string;
  title: string;
  children?: React.ReactNode;
  /** The first is the primary action. */
  actions?: StatusAction[];
  /** In place of the mark: an avatar, say. */
  mark?: React.ReactNode;
  /** Pressing the mark says the next of these, in turn. */
  lines?: string[];
}) {
  const [turn, setTurn] = React.useState(0);
  const [swim, setSwim] = React.useState(0);
  const spoken = lines?.length && turn > 0 ? lines[(turn - 1) % lines.length] : null;

  return (
    <main className="g-root gs-status">
      <div className="gs-status-card" role="status">
        {mark ?? (
          <button
            type="button"
            className="gs-status-mark"
            aria-label="The gator"
            data-swim={swim % 2 ? "b" : swim ? "a" : undefined}
            onClick={() => {
              setSwim((n) => n + 1);
              if (lines?.length) setTurn((n) => n + 1);
            }}
          >
            <GatorLogo size={40} />
          </button>
        )}
        {label ? <p className="gs-status-label">{label}</p> : null}
        <h1 className="gs-status-title">{title}</h1>
        {spoken ? (
          <p key={turn} className="gs-status-aside">
            {spoken}
          </p>
        ) : null}
        {children ? <div className="gs-status-body">{children}</div> : null}
        {actions.length ? (
          <div className="gs-status-acts">
            {actions.map((action, index) => (
              <RippleButton
                key={action.label}
                as={action.href ? Link : undefined}
                href={action.href}
                onClick={action.onClick}
                variant={index === 0 ? "default" : "outline"}
                size="lg"
                className="gs-status-btn"
              >
                {action.label}
                <RippleButtonRipples />
              </RippleButton>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
