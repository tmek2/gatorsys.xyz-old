"use client";

/* What is inside a folder: the module sheet, in Apple's detail-view grammar. A
   header that says what you are looking at, then a stack of grouped lists (one
   rounded container, hairlines that stop short of the leading edge, a small
   caption above and sometimes a footnote below). One container shape, one
   separator and one caption style.

   - The header: the folder, its group as a tinted caption, the name at display
     size and one sentence.
   - The difference: the same server drawn twice with a seam you drag through
     it, with the two sentences as the footnote.
   - What you get: one group of three rows.
   - Turn it on: the site's button.
   - Next door: rows with a folder glyph, a name and a chevron.

   The same markup serves the Mac window and the phone; they differ in metrics,
   not structure. */

import { FOLDERS, MODULE_BY_KEY, type Folder } from "../modules";
import { Link } from "next-view-transitions";
import { Compare } from "./compare";
import { DiscordAfter, DiscordBefore } from "./discord-scene";
import { shotFor } from "./shots";
import { CheckmarkCircleFill, ChevronRight } from "./sf";
import { ModuleGlyph } from "./module-glyphs";

/* The folder art at any size: the same tile as the wall, so the thing at the
   top of the sheet is recognisably what you opened. */
export function FolderArt({
  moduleKey,
  className,
}: {
  moduleKey: string;
  className?: string;
}) {
  return (
    <span className={`g-sheet-mark ${className ?? ""}`} aria-hidden="true">
      <ModuleGlyph moduleKey={moduleKey} size={26} weight={1.9} />
    </span>
  );
}

export function ModuleSheet({
  folder,
  onOpen,
}: {
  folder: Folder;
  onOpen: (key: string) => void;
}) {
  const m = MODULE_BY_KEY.get(folder.key);
  const shot = shotFor(folder.key);

  /* Its neighbours: the ones from the same group first, then whatever is next
     around the wall, so there is always somewhere to go from here. */
  const near = [
    ...FOLDERS.filter(
      (f) => f.key !== folder.key && MODULE_BY_KEY.get(f.key)?.slug === m?.slug,
    ),
    ...FOLDERS.filter(
      (f) => f.key !== folder.key && MODULE_BY_KEY.get(f.key)?.slug !== m?.slug,
    ),
  ].slice(0, 2);

  return (
    <article className="g-sheet" style={{ ["--hue" as string]: folder.hue }}>
      {/* ------------------------------------------------------------ head */}
      {/* The head says what this is: the name, what it is, and one sentence on
         why. The invitation to turn it on is at the foot, after the reasons. */}
      <header className="g-sheet-head">
        {/* The folder art anchors the title. */}
        <FolderArt moduleKey={folder.key} />

        <div className="g-sheet-say">
          <h3 className="g-sheet-title">
            {m?.name ?? folder.label}
            {m?.group ? (
              <span className="g-sheet-kicker">{m.group}</span>
            ) : null}
          </h3>
          <p className="g-sheet-pitch">{folder.pitch}</p>
        </div>
      </header>

      {/* The four groups, wrapped so a wide window can set them in two columns. */}
      <div className="g-sheet-groups">
        {/* ------------------------------------------------------ difference */}
        {/* The comparison: the same window twice with a seam you drag through
           it. Under it, the before and after sentences in the same order. */}
        <section className="g-group g-group-wide" aria-label="What changes">
          <h4 className="g-group-cap">The difference</h4>
          {/* The frame takes the shape of its content (drawings are 640x420,
             screenshots their captured shape); both halves read the same value
             so the seam runs down one rectangle. */}
          <div
            className="g-group-box g-shot"
            style={shot ? { ["--shot-ratio" as string]: shot.ratio } : undefined}
          >
            <Compare
              className="g-shot-cmp"
              before={
                <DiscordBefore
                  className="g-shot-art"
                  scene={folder.key}
                  label={folder.without}
                />
              }
              after={
                <DiscordAfter
                  className="g-shot-art"
                  scene={folder.key}
                  label={folder.with}
                />
              }
              beforeLabel="Without Gator"
              afterLabel="With Gator"
            />
          </div>
          {/* One plain paragraph. The before and after sentences are the
             picture's descriptions, so they still reach anyone who cannot see
             it. */}
          <p className="g-shot-say">{folder.explain}</p>
        </section>

        {/* -------------------------------------------------------- what you get */}
        <section className="g-group g-group-gets" aria-label="What you get">
          <h4 className="g-group-cap">What you get</h4>
          <ul className="g-group-box g-gets">
            {folder.points.map((point) => (
              <li className="g-row" key={point}>
                {/* A tick: the items have no order. */}
                <span className="g-row-tick" aria-hidden="true">
                  <CheckmarkCircleFill size={17} />
                </span>
                <span className="g-row-text">
                  <span className="g-row-body">{point}</span>
                </span>
              </li>
            ))}
          </ul>
          {/* Where to go next: two buttons under the list. */}
          <nav className="g-sheet-near" aria-label="Nearby modules">
            {near.map((f) => (
              <button
                className="g-near"
                key={f.key}
                type="button"
                style={{ ["--hue" as string]: f.hue }}
                onClick={() => onOpen(f.key)}
              >
                <ModuleGlyph
                  className="g-near-glyph"
                  moduleKey={f.key}
                  size={17}
                  weight={1.9}
                />
                <span className="g-near-name">{f.label}</span>
                <ChevronRight size={14} weight={2.5} className="g-near-chev" />
              </button>
            ))}
          </nav>
        </section>
      </div>

      {/* ------------------------------------------------------------ foot */}
      {/* The invitation, last: a link (not a filled button) with a rule above it
         and its own line. */}
      <footer className="g-sheet-foot">
        <Link href="/servers" className="g-sheet-go">
          Turn it on
          <ChevronRight size={15} weight={2.6} />
        </Link>
        <span className="g-act-say">Free, and on in about a minute.</span>
      </footer>
    </article>
  );
}
