"use client";

import React from "react";

/**
 * What the open tab is (its glyph and group), provided by the shell so every
 * tab's header can show its own faint glyph. A context because the header is
 * used inside every section.
 */
export interface SectionIdentity {
  icon?: React.ReactNode;
  group?: string;
}

export const SectionIdentityContext = React.createContext<SectionIdentity>({});

export function useSectionIdentity(): SectionIdentity {
  return React.useContext(SectionIdentityContext);
}
