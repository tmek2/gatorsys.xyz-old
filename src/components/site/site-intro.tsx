import { GatorLogo } from "./gator-logo";
import "./intro.css";

/* The cover: the mark and the five letters of the wordmark, each in its own
   mask so it arrives from behind an edge, in one left-to-right sequence. The
   letters are `aria-hidden` and the real name is in the markup underneath, so a
   screen reader hears "Gator" once; the cover is `aria-hidden` and `inert`. The
   markup ships on every page and is `display: none` until intro.ts says
   otherwise, so there is nothing for hydration to disagree about. */

const WORD = "Gator";

export function SiteIntro() {
  return (
    <div className="g-intro" aria-hidden="true" inert>
      {/* A CSS dot grid rather than the pages' canvas, because it must paint
         before any JavaScript runs. */}
      <span className="g-intro-field" />
      <span className="g-intro-glow" />

      <span className="g-intro-word">
        <span className="g-intro-item" style={{ ["--i" as string]: 0 }}>
          <span className="g-intro-glyph g-intro-mark">
            <GatorLogo size={62} title="" />
          </span>
        </span>
        {/* The letters as one group, so the mark centres on the word's line
            the way it does in the header's lockup, not on one letter. */}
        <span className="g-intro-letters">
          {WORD.split("").map((letter, index) => (
            <span
              className="g-intro-item"
              key={`${letter}-${index}`}
              style={{ ["--i" as string]: index + 1 }}
            >
              <span className="g-intro-glyph">{letter}</span>
            </span>
          ))}
        </span>
      </span>

      {/* One hairline drawn left to right under the word while the last letter
         lands. */}
      <span className="g-intro-rule" />
    </div>
  );
}
