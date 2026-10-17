/* Modules with real screenshots instead of drawings (where a capture exists, it
   wins). - A pair is one rectangle: the ratio is declared here once and the
   frame uses it, so both halves of the wipe are the same shape. - Nothing is a
   real conversation: message bodies are grey bars and names are invented. - A
   GIF cannot be paused, so each one has a still of its first frame, used under
   reduced motion. */

/** One half of a pair. `still` is required of anything that moves. */
export type Frame = {
  src: string;
  /** Shown instead of `src` when the reader has asked for less motion. */
  still?: string;
};

/** A before and an after, in one appearance. */
export type Pair = {
  before: Frame;
  after: Frame;
};

export type Shot = Pair & {
  /** The shape of both halves, as a CSS `aspect-ratio`. */
  ratio: string;
  /* The same captures in the light appearance, at the same two sizes, so
     `ratio` covers all four. */
  light?: Pair;
};

export const SHOTS: Record<string, Shot> = {
  sessions: {
    ratio: "43 / 30",
    before: {
      src: "/modules/sessions-before.webp",
      still: "/modules/sessions-before-still.png",
    },
    after: { src: "/modules/sessions-after.png" },
    light: {
      before: {
        src: "/modules/session-before-light.webp",
        still: "/modules/session-before-light-still.png",
      },
      after: { src: "/modules/session-after-light.png" },
    },
  },
  infractions: {
    ratio: "43 / 30",
    before: {
      src: "/modules/infractions-before.webp",
      still: "/modules/infractions-before-still.png",
    },
    after: { src: "/modules/infractions-after.png" },
    light: {
      before: {
        src: "/modules/infractions-before-light.webp",
        still: "/modules/infractions-before-light-still.png",
      },
      after: { src: "/modules/infractions-after-light.png" },
    },
  },
};

/** The pair for an appearance, falling back to dark. */
export const pairFor = (shot: Shot, appearance: "light" | "dark"): Pair =>
  appearance === "light" && shot.light ? shot.light : shot;

export const shotFor = (key?: string): Shot | undefined =>
  key ? SHOTS[key] : undefined;
