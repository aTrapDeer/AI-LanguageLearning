/**
 * SM-2 style spaced-repetition scheduler (Anki-like four-button grading).
 * Deterministic: every function takes `now` explicitly and there is no interval fuzz.
 */

export type ReviewGrade = "again" | "hard" | "good" | "easy";

export const REVIEW_GRADES: readonly ReviewGrade[] = ["again", "hard", "good", "easy"];

export interface SrsState {
  /** Days until the next review after the last successful recall. 0 while (re)learning. */
  intervalDays: number;
  /** Ease factor; multiplies the interval on "good". */
  ease: number;
  /** Consecutive successful recalls. Reset to 0 by "again". */
  repetitions: number;
  /** Times the item was forgotten after having been recalled at least once. */
  lapses: number;
}

export interface SrsScheduleResult extends SrsState {
  nextReview: Date;
}

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const MAX_INTERVAL_DAYS = 365;
/** A failed item comes back within the same session. */
export const RELEARN_DELAY_MINUTES = 10;

export const INITIAL_SRS_STATE: Readonly<SrsState> = Object.freeze({
  intervalDays: 0,
  ease: DEFAULT_EASE,
  repetitions: 0,
  lapses: 0,
});

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function clampEase(value: number) {
  return Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, value)) * 100) / 100;
}

function clampInterval(value: number) {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(value)));
}

function sanitize(state: Partial<SrsState> | null | undefined): SrsState {
  const finite = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

  return {
    intervalDays: finite(state?.intervalDays, 0),
    ease: clampEase(finite(state?.ease, DEFAULT_EASE) || DEFAULT_EASE),
    repetitions: Math.floor(finite(state?.repetitions, 0)),
    lapses: Math.floor(finite(state?.lapses, 0)),
  };
}

/** Returns the item's next state and when it is due again. Does not mutate `state`. */
export function scheduleReview(
  state: Partial<SrsState> | null | undefined,
  grade: ReviewGrade,
  now: Date
): SrsScheduleResult {
  const current = sanitize(state);
  const nowMs = now.getTime();

  if (grade === "again") {
    return {
      intervalDays: 0,
      ease: clampEase(current.ease - 0.2),
      repetitions: 0,
      lapses: current.repetitions > 0 ? current.lapses + 1 : current.lapses,
      nextReview: new Date(nowMs + RELEARN_DELAY_MINUTES * MINUTE_MS),
    };
  }

  const repetitions = current.repetitions + 1;
  const previous = current.intervalDays;
  let ease = current.ease;
  let intervalDays: number;

  if (grade === "hard") {
    ease = clampEase(ease - 0.15);
    intervalDays = repetitions === 1 ? 1 : clampInterval(Math.max(previous + 1, previous * 1.2));
  } else if (grade === "good") {
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = Math.max(3, clampInterval(previous + 1));
    } else {
      intervalDays = clampInterval(Math.max(previous + 1, previous * ease));
    }
  } else {
    ease = clampEase(ease + 0.15);
    if (repetitions === 1) {
      intervalDays = 4;
    } else {
      const goodInterval = repetitions === 2 ? Math.max(3, previous + 1) : Math.max(previous + 1, previous * current.ease);
      intervalDays = clampInterval(Math.max(goodInterval + 1, previous * ease * 1.3));
    }
  }

  intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDays);

  return {
    intervalDays,
    ease,
    repetitions,
    lapses: current.lapses,
    nextReview: new Date(nowMs + intervalDays * DAY_MS),
  };
}

export interface ExerciseOutcome {
  correct: boolean;
  /** The learner used a hint, needed a second try, or answered noticeably slowly. */
  hesitant?: boolean;
  /** The learner answered instantly and confidently (e.g. a fast typed recall). */
  effortless?: boolean;
}

/** Maps a plain exercise result onto a review grade. */
export function gradeFromOutcome(outcome: ExerciseOutcome | boolean): ReviewGrade {
  const result = typeof outcome === "boolean" ? { correct: outcome } : outcome;
  if (!result.correct) {
    return "again";
  }

  if (result.hesitant) {
    return "hard";
  }

  return result.effortless ? "easy" : "good";
}

export function isDue(nextReview: Date | string | null | undefined, now: Date): boolean {
  if (nextReview === null || nextReview === undefined || nextReview === "") {
    return true;
  }

  const dueAt = nextReview instanceof Date ? nextReview.getTime() : Date.parse(nextReview);
  return Number.isNaN(dueAt) || dueAt <= now.getTime();
}

export type Maturity = "new" | "learning" | "young" | "mature";

/** Interval thresholds shared with the SQL that counts maturity buckets. */
export const YOUNG_INTERVAL_DAYS = 7;
export const MATURE_INTERVAL_DAYS = 21;

export function getMaturity(state: Pick<SrsState, "intervalDays">, totalReviews: number): Maturity {
  if (totalReviews <= 0) {
    return "new";
  }

  if (state.intervalDays >= MATURE_INTERVAL_DAYS) {
    return "mature";
  }

  return state.intervalDays >= YOUNG_INTERVAL_DAYS ? "young" : "learning";
}
