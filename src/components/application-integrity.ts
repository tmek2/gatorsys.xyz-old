/**
 * Per-question authorship signals for application answers: how much text was
 * typed, how much was pasted, how many pastes, and how long the field was
 * focused. No keystroke content and no inter-key timings. It is a signal, never
 * a verdict: drafting elsewhere and pasting is fine, and the UI says so.
 */

export interface QuestionIntegrity {
  typed: number;
  pasted: number;
  pastes: number;
  /** Seconds the field was focused. */
  seconds: number;
}

export type IntegrityMap = Record<string, QuestionIntegrity>;

const EMPTY: QuestionIntegrity = { typed: 0, pasted: 0, pastes: 0, seconds: 0 };

export function blankIntegrity(): QuestionIntegrity {
  return { ...EMPTY };
}

/**
 * A tracker for one form, kept outside React state so typing does not re-render
 * the form on every keystroke.
 */
export function createIntegrityTracker() {
  const map: IntegrityMap = {};
  const focusedAt: Record<string, number> = {};
  const pendingPastes: Record<string, number> = {};

  const entry = (id: string): QuestionIntegrity => {
    if (!map[id]) map[id] = blankIntegrity();
    return map[id];
  };

  return {
    /** Text arrived by keyboard. `delta` is the change in length. */
    typed(id: string, delta: number) {
      if (delta > 0) entry(id).typed += delta;
    },
    /** A text input change also fires after paste; count those characters once. */
    input(id: string, delta: number) {
      const pasted = pendingPastes[id] || 0;
      delete pendingPastes[id];
      if (delta > pasted) entry(id).typed += delta - pasted;
    },
    paste(id: string, length: number) {
      const row = entry(id);
      row.pasted += Math.max(0, length);
      row.pastes += 1;
      pendingPastes[id] = Math.max(0, length);
    },
    focus(id: string) {
      focusedAt[id] = Date.now();
    },
    blur(id: string) {
      const started = focusedAt[id];
      if (!started) return;
      entry(id).seconds += Math.round((Date.now() - started) / 1000);
      delete focusedAt[id];
    },
    /** Snapshot for submission. Closes any field still focused. */
    snapshot(): IntegrityMap {
      for (const id of Object.keys(focusedAt)) this.blur(id);
      return { ...map };
    },
  };
}

export type IntegrityVerdict = "typed" | "mixed" | "pasted" | "fast" | null;

/**
 * How an answer was most likely produced. Thresholds keep common honest cases
 * silent (short answers, quick answers, a little pasting in mostly typed text);
 * only a lopsided ratio, or a long answer that appeared faster than anyone
 * types, is flagged.
 */
export function verdictFor(
  row: QuestionIntegrity | undefined,
  answerLength: number,
): IntegrityVerdict {
  if (!row) return null;
  const total = row.typed + row.pasted;
  // Too short to say anything meaningful about.
  if (total < 40 || answerLength < 40) return null;

  const pastedShare = row.pasted / total;
  if (pastedShare >= 0.8) return "pasted";
  if (pastedShare >= 0.35) return "mixed";

  // ~12 characters a second is faster than sustained human typing. Only
  // considered once there is enough text for the rate to mean anything.
  if (row.seconds > 0 && total >= 200 && total / row.seconds > 12) return "fast";

  return "typed";
}

/**
 * Whether a model wrote it: a separate judgement made by a detector only when a
 * reviewer asks, shown apart from the paste counters so a measurement does not
 * borrow a judgement's authority. The scan runs on the bot
 * (utils/application_ai_detect.py); this file holds the shape and wording.
 */
export type AiVerdict = "clear" | "possible" | "likely";

export interface AiQuestionFlag {
  verdict: AiVerdict;
  /** 0..1 confidence the answer was generated. */
  score: number;
  /** Why, in the detector's words. Rendered under the tag. */
  reasons: string[];
  source: "heuristic" | "model" | "both";
}

export interface AiDetection {
  questions: Record<string, AiQuestionFlag>;
  scanned_at?: string;
  scanned_by_name?: string;
  /**
   * False when only the offline heuristic ran, so the UI can tell "nothing
   * looked generated" from "half the detector was unavailable".
   */
  model_available?: boolean;
}

export const AI_VERDICT_LABEL: Record<
  AiVerdict,
  { label: string; detail: string; tone: "good" | "warn" | "flag" }
> = {
  clear: {
    label: "Reads as written",
    detail: "Nothing in this answer looks generated.",
    tone: "good",
  },
  possible: {
    label: "Possibly AI",
    detail:
      "Some traits of generated writing. A careful writer could produce this too.",
    tone: "warn",
  },
  likely: {
    label: "Likely AI",
    detail:
      "Strongly resembles generated writing. Worth reading closely, but it is not proof.",
    tone: "flag",
  },
};

export const VERDICT_LABEL: Record<
  Exclude<IntegrityVerdict, null>,
  { label: string; detail: string; tone: "good" | "warn" | "flag" }
> = {
  typed: {
    label: "Typed",
    detail: "Written in the form.",
    tone: "good",
  },
  mixed: {
    label: "Part pasted",
    detail: "Some of this answer was pasted in.",
    tone: "warn",
  },
  pasted: {
    label: "Pasted",
    detail:
      "Nearly all of this answer was pasted. That may just mean it was drafted elsewhere.",
    tone: "flag",
  },
  fast: {
    label: "Very fast",
    detail:
      "Appeared faster than it could reasonably be typed. Worth a read, not a verdict.",
    tone: "warn",
  },
};
