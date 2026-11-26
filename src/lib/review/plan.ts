/**
 * Server rules for building and grading a review session. Pure so they can be unit-tested; the
 * store applies them in SQL.
 */

import type { Maturity } from "../srs";
import type { CardDirection } from "./types";

export const SESSION_MAX_CARDS = 20;
/** Never introduce more than this many never-seen words in one session. */
export const SESSION_MAX_NEW = 10;
/** A session with fewer cards than this is topped up with generated words (when allowed). */
export const SESSION_TARGET_CARDS = 10;
/** Smallest generation batch worth an API call. */
export const MIN_GENERATION_BATCH = 5;
/** Generated words per learner, language and rolling 24 hours. */
export const DAILY_GENERATED_WORD_CAP = 30;
/** Grades accepted per card per session ("again" re-queues it; this stops endless loops). */
export const MAX_GRADES_PER_CARD = 4;
/** Sessions can be graded/completed for this long after they start. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface PlannableItem {
  id: string;
  maturity: Maturity;
  /** ISO timestamp. */
  nextReview: string;
}

/**
 * Picks the cards for a session from due items (any order): previously seen cards first, most
 * overdue first, then new words, capped in total and in new words.
 */
export function planSession<T extends PlannableItem>(
  due: readonly T[],
  options: { maxCards?: number; maxNew?: number } = {}
): T[] {
  const maxCards = options.maxCards ?? SESSION_MAX_CARDS;
  const maxNew = options.maxNew ?? SESSION_MAX_NEW;
  const byDue = (a: T, b: T) => Date.parse(a.nextReview) - Date.parse(b.nextReview);

  const seen = due.filter((item) => item.maturity !== "new").sort(byDue);
  const fresh = due.filter((item) => item.maturity === "new").sort(byDue);

  const reviews = seen.slice(0, maxCards);
  const newOnes = fresh.slice(0, Math.max(0, Math.min(maxNew, maxCards - reviews.length)));
  return [...reviews, ...newOnes];
}

/** New and learning words are recognised; once a word is young or mature the learner must produce it. */
export function cardDirection(maturity: Maturity): CardDirection {
  return maturity === "young" || maturity === "mature" ? "produce" : "recognize";
}

/**
 * How many words to generate for a session. Only when the deck is empty or there is at least one due
 * card but the session is thin; a learner who is simply caught up is offered new words instead.
 */
export function topUpCount(params: {
  plannedCards: number;
  deckSize: number;
  generatedLast24h: number;
  aiAvailable: boolean;
  /** The learner explicitly asked for new words. */
  requested?: boolean;
}): number {
  if (!params.aiAvailable) {
    return 0;
  }

  const thin = params.deckSize === 0 || (params.plannedCards > 0 && params.plannedCards < SESSION_TARGET_CARDS);
  if (!thin && !params.requested) {
    return 0;
  }

  const allowance = Math.max(0, DAILY_GENERATED_WORD_CAP - params.generatedLast24h);
  const wanted = params.requested
    ? SESSION_TARGET_CARDS
    : Math.max(MIN_GENERATION_BATCH, SESSION_TARGET_CARDS - params.plannedCards);
  const count = Math.min(wanted, allowance, SESSION_MAX_NEW);
  return count >= MIN_GENERATION_BATCH ? count : 0;
}

export function canGenerateMore(generatedLast24h: number, aiAvailable: boolean): boolean {
  return aiAvailable && DAILY_GENERATED_WORD_CAP - generatedLast24h >= MIN_GENERATION_BATCH;
}
