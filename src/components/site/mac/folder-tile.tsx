"use client";

/* A module card on the landing window's wall: the module's name and what it
   does, with its glyph bare above them and its group as a quiet label.

   - A <button>: keyboard reachable, Enter and Space open it, and hover and
     focus look the same.
   - One click opens; the wall owns hold-to-drag.
   - Reduced motion keeps the tonal states and drops the movement.

   The folder's hue (given by the caller) colours the glyph and the card's edge
   on hover, never a fill. */

import { forwardRef } from "react";
import { ModuleGlyph } from "./module-glyphs";

export interface FolderTileProps {
  /** Which glyph the card carries. The module's key, from the wall's data. */
  moduleKey: string;
  label: string;
  hue: string;
  /** One line on what the module does, from the dashboard's own description. */
  say?: string;
  /** The group it belongs to, set opposite the glyph. */
  meta?: string;
  selected?: boolean;
  /**
   * Whether the ending gesture was a drag (the wall runs the drag), so the
   * click that follows can be ignored.
   */
  dragged?: () => boolean;
  onSelect: () => void;
  onOpen: () => void;
}

export const FolderTile = forwardRef<HTMLButtonElement, FolderTileProps>(
  function FolderTile(
    { moduleKey, label, hue, say, meta, selected, dragged, onSelect, onOpen },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        className="g-fcard"
        data-key={moduleKey}
        data-selected={selected ? "true" : "false"}
        style={{ ["--hue" as string]: hue }}
        onClick={(event) => {
          /* A press that became a drag is not also a click; the browser fires
             one anyway on pointerup over the same element. */
          if (event.detail !== 0 && dragged?.()) {
            event.preventDefault();
            return;
          }
          onSelect();
          onOpen();
        }}
        aria-label={`${label}${meta ? `, ${meta}` : ""}. Click to open. Hold to rearrange; Alt and arrow keys also move it.`}
      >
        {/* The same mark twice: small at the top, and very large and faint
           behind the card, clipped by its corner, giving the card a subject. */}
        <ModuleGlyph
          className="g-fcard-ghost"
          moduleKey={moduleKey}
          size={88}
          weight={1.3}
        />
        <ModuleGlyph
          className="g-fcard-glyph"
          moduleKey={moduleKey}
          size={20}
          weight={1.9}
        />
        <span className="g-fcard-name">{label}</span>
        {say ? <span className="g-fcard-say">{say}</span> : null}
      </button>
    );
  },
);
