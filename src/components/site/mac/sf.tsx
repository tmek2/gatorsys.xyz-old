/* SF Symbols-style glyphs for the landing window's chrome.

   Original paths drawn to SF Symbols' published geometry (nothing traced from
   Apple's files): - a 24×24 viewBox with the mark in a 20×20 optical area, so a
   glyph at 22px matches a 17pt label beside it; - round line caps and joins on
   every stroked path; - weight as a prop, since a symbol beside semibold chrome
   takes a heavier stroke; - `.fill` variants as real filled shapes.

   Chevrons have arms at about 66 degrees, not 90, which makes them read as a
   direction rather than an arrowhead. `chevron.right` at 13px, weight 2.5, is
   iOS's list disclosure mark. */

export interface SFProps {
  /** Point size. SF Symbols scales as a font does, so this is the em box. */
  size?: number;
  /** Stroke weight, in the same units. Matches the label it stands beside. */
  weight?: number;
  className?: string;
}

/* Every stroked symbol is this shell, so the round terminals and the viewBox
   are stated once and cannot drift apart between glyphs. */
function Stroked({
  size = 20,
  weight = 1.8,
  className,
  children,
}: SFProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Filled({
  size = 20,
  className,
  children,
}: Omit<SFProps, "weight"> & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------- chevrons */

/* 66 degrees between the arms, which is SF Symbols' angle. A right angle is
   what a generic icon set draws and it reads as an arrowhead. */
export const ChevronRight = (p: SFProps) => (
  <Stroked weight={2.2} {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Stroked>
);

export const ChevronLeft = (p: SFProps) => (
  <Stroked weight={2.2} {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Stroked>
);

/* -------------------------------------------------------------- folders */

/* The folder: one outline including the tab, which rises from the back edge
   over the leading 42% and returns on a short diagonal. The front face starts
   slightly below the back edge so the two read as separate sheets. */
export const FolderFill = (p: Omit<SFProps, "weight">) => (
  <Filled {...p}>
    <path d="M3 7.4c0-1.33 1.02-2.4 2.28-2.4h3.36c.5 0 .98.18 1.37.5l1.6 1.34c.2.16.44.25.69.25h7.42C20.98 7.09 22 8.16 22 9.49v7.11c0 1.33-1.02 2.4-2.28 2.4H5.28C4.02 19 3 17.93 3 16.6z" />
  </Filled>
);

export const Folder = (p: SFProps) => (
  <Stroked weight={1.7} {...p}>
    <path d="M3.2 8.2c0-1.27.98-2.3 2.18-2.3h3.1c.48 0 .94.18 1.31.49l1.44 1.22c.2.16.44.25.69.25h7.7c1.2 0 2.18 1.03 2.18 2.3v6.55c0 1.27-.98 2.3-2.18 2.3H5.38c-1.2 0-2.18-1.03-2.18-2.3z" />
  </Stroked>
);

/* ---------------------------------------------------------------- files */

/* doc.text.fill: a page with a folded corner and four ruled lines. The fold is
   a real corner cut, so the silhouette is one shape. */
export const DocTextFill = (p: Omit<SFProps, "weight">) => (
  <Filled {...p}>
    <path d="M6.5 2.5h6.02c.4 0 .78.16 1.06.44l4.48 4.48c.28.28.44.66.44 1.06V19.5c0 1.1-.9 2-2 2h-10c-1.1 0-2-.9-2-2v-15c0-1.1.9-2 2-2m6.9 1.9v3.1c0 .33.27.6.6.6h3.1zM8.4 11.6h7.2a.75.75 0 0 1 0 1.5H8.4a.75.75 0 0 1 0-1.5m0 3.2h7.2a.75.75 0 0 1 0 1.5H8.4a.75.75 0 0 1 0-1.5" />
  </Filled>
);

/* -------------------------------------------------------------- toolbar */

export const MagnifyingGlass = (p: SFProps) => (
  <Stroked weight={2} {...p}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.6 15.6 4 4" />
  </Stroked>
);

/* xmark.circle.fill — the clear button inside a search field. Filled disc,
   knocked-out cross, which is how iOS draws it. */
export const XmarkCircleFill = (p: Omit<SFProps, "weight">) => (
  <Filled {...p}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m3.66 12.6a.75.75 0 0 1-1.06 1.06L12 13.06l-2.6 2.6a.75.75 0 1 1-1.06-1.06l2.6-2.6-2.6-2.6A.75.75 0 0 1 9.4 8.34l2.6 2.6 2.6-2.6a.75.75 0 0 1 1.06 1.06l-2.6 2.6z" />
  </Filled>
);

/* ellipsis.circle — the trailing menu button on an iOS navigation bar, and the
   one Files itself uses. A ring with three dots, not a filled disc. */
export const EllipsisCircle = ({ size = 20, weight = 1.8, className }: SFProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      cx="12"
      cy="12"
      r="9.1"
      stroke="currentColor"
      strokeWidth={weight}
    />
    <circle cx="7.6" cy="12" r="1.25" fill="currentColor" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
    <circle cx="16.4" cy="12" r="1.25" fill="currentColor" />
  </svg>
);

/* line.3.horizontal: three equal bars with round ends. */
export const Line3Horizontal = (p: SFProps) => (
  <Stroked weight={2} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Stroked>
);

/* The two view modes, as Finder and Files both draw them. */
export const SquareGrid2x2 = (p: SFProps) => (
  <Stroked weight={1.9} {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.9" />
    <rect x="13" y="4" width="7" height="7" rx="1.9" />
    <rect x="4" y="13" width="7" height="7" rx="1.9" />
    <rect x="13" y="13" width="7" height="7" rx="1.9" />
  </Stroked>
);

export const ListBullet = ({ size = 20, weight = 1.9, className }: SFProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={weight}
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.6" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="4.6" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="4.6" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

/* ------------------------------------------------------------- sections */

/* book.closed, for Documentation: a spine and a cover, outlined like the
   folders beside it. */
export const BookClosed = (p: SFProps) => (
  <Stroked weight={1.7} {...p}>
    <path d="M5.4 4.6c0-1.16.94-2.1 2.1-2.1h9.9c1.16 0 2.1.94 2.1 2.1v11.5H7.5a2.1 2.1 0 0 0-2.1 2.1z" />
    <path d="M5.4 18.2a2.1 2.1 0 0 0 2.1 2.1h12" />
    <path d="M8.7 2.5v13.6" />
  </Stroked>
);

/* lifepreserver — Support. A ring with four spokes reaching the inner circle,
   set on the diagonals, which is what makes it a life ring and not a wheel. */
export const Lifepreserver = (p: SFProps) => (
  <Stroked weight={1.7} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.9" />
    <path d="m5.63 5.63 3.6 3.6M18.37 5.63l-3.6 3.6M18.37 18.37l-3.6-3.6M5.63 18.37l3.6-3.6" />
  </Stroked>
);

export const BuildingColumnsFill = (p: Omit<SFProps, "weight">) => (
  <Filled {...p}>
    <path d="M12.53 2.6a1.2 1.2 0 0 0-1.06 0L3.1 6.9a.9.9 0 0 0 .4 1.7h17a.9.9 0 0 0 .4-1.7zM4.9 10.4h2.4v6.6H4.9zm3.9 0h2.4v6.6H8.8zm3.9 0h2.4v6.6h-2.4zm3.9 0h2.4v6.6h-2.4zM3.9 18.7h16.2a.95.95 0 0 1 0 1.9H3.9a.95.95 0 0 1 0-1.9" />
  </Filled>
);

/* square.grid.2x2.fill on a slider — the dashboard. Four panes, one wide. */
export const SquareGridDashboard = (p: SFProps) => (
  <Stroked weight={1.8} {...p}>
    <rect x="3.6" y="3.6" width="7.2" height="9.4" rx="1.9" />
    <rect x="13.2" y="3.6" width="7.2" height="5.6" rx="1.9" />
    <rect x="3.6" y="15.4" width="7.2" height="5" rx="1.9" />
    <rect x="13.2" y="11.6" width="7.2" height="8.8" rx="1.9" />
  </Stroked>
);

/* ---------------------------------------------------------------- marks */

export const CheckmarkCircleFill = (p: Omit<SFProps, "weight">) => (
  <Filled {...p}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m5.06 7.44-6.1 6.85a.9.9 0 0 1-1.32.04l-2.86-2.86a.85.85 0 0 1 1.2-1.2l2.18 2.18 5.53-6.2a.85.85 0 0 1 1.27 1.13z" />
  </Filled>
);

/* arrow.up.forward — the mark on a row that leaves the app. iOS draws it as an
   arrow on the diagonal, not as a box with an arrow in it. */
export const ArrowUpForward = (p: SFProps) => (
  <Stroked weight={2.1} {...p}>
    <path d="M7.5 16.5 16.5 7.5M9.2 7.5h7.3v7.3" />
  </Stroked>
);

export const ArrowLeft = (p: SFProps) => (
  <Stroked weight={2} {...p}>
    <path d="M10 5.5 3.5 12l6.5 6.5M3.9 12h16.6" />
  </Stroked>
);

export const ArrowRight = (p: SFProps) => (
  <Stroked weight={2} {...p}>
    <path d="M14 5.5 20.5 12 14 18.5M20.1 12H3.5" />
  </Stroked>
);

/* person.crop.circle — the account row in the phone's menu. */
export const PersonCropCircle = (p: SFProps) => (
  <Stroked weight={1.8} {...p}>
    <circle cx="12" cy="12" r="9.1" />
    <circle cx="12" cy="9.6" r="3.1" />
    <path d="M5.6 19.2a7.4 7.4 0 0 1 12.8 0" />
  </Stroked>
);
