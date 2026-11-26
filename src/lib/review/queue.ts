/**
 * Client-side card order for a review session. Pure and immutable: every function returns a new state.
 * A card graded "again" goes back a few places so it returns later in the same session.
 */

import type { ReviewGrade } from "../srs";
import { MAX_GRADES_PER_CARD } from "./plan";

/** Cards shown before an "again" card comes back (fewer if the queue is shorter). */
export const REQUEUE_GAP = 3;

export interface ReviewQueue {
  /** Card ids still to show; the first is the current card. */
  order: string[];
  /** Card ids finished in this session, in finishing order. */
  done: string[];
  /** Grades given per card id this session. */
  grades: Record<string, ReviewGrade[]>;
  total: number;
}

export function createQueue(cardIds: readonly string[]): ReviewQueue {
  const unique = Array.from(new Set(cardIds));
  return { order: unique, done: [], grades: {}, total: unique.length };
}

export function currentCardId(queue: ReviewQueue): string | null {
  return queue.order[0] ?? null;
}

export function isQueueFinished(queue: ReviewQueue): boolean {
  return queue.order.length === 0;
}

/**
 * Records a grade for the current card. "again" re-inserts it `REQUEUE_GAP` places later unless it
 * has used up its tries (`MAX_GRADES_PER_CARD`) or `requeue` is false (the server said no).
 */
export function gradeCurrent(queue: ReviewQueue, grade: ReviewGrade, options: { requeue?: boolean } = {}): ReviewQueue {
  const [id, ...rest] = queue.order;
  if (!id) {
    return queue;
  }

  const grades = { ...queue.grades, [id]: [...(queue.grades[id] ?? []), grade] };
  const tries = grades[id].length;
  const requeue = grade === "again" && (options.requeue ?? true) && tries < MAX_GRADES_PER_CARD;

  if (requeue) {
    const position = Math.min(rest.length, REQUEUE_GAP);
    return { ...queue, grades, order: [...rest.slice(0, position), id, ...rest.slice(position)] };
  }

  return { ...queue, grades, order: rest, done: [...queue.done, id] };
}

/** Removes a card wherever it is (e.g. the server refused it). */
export function dropCard(queue: ReviewQueue, id: string): ReviewQueue {
  if (!queue.order.includes(id)) {
    return queue;
  }

  return { ...queue, order: queue.order.filter((entry) => entry !== id), done: [...queue.done, id] };
}

/** 0..1 share of cards finished. */
export function queueProgress(queue: ReviewQueue): number {
  return queue.total === 0 ? 1 : queue.done.length / queue.total;
}

export interface QueueStats {
  reviewed: number;
  /** Cards whose first grade this session was not "again". */
  correct: number;
  /** Ids of cards that needed "again" at least once. */
  struggled: string[];
}

/** Mirrors the server's scoring (first grade per card), for display before the server confirms. */
export function queueStats(queue: ReviewQueue): QueueStats {
  const entries = Object.entries(queue.grades).filter(([, grades]) => grades.length > 0);
  return {
    reviewed: entries.length,
    correct: entries.filter(([, grades]) => grades[0] !== "again").length,
    struggled: entries.filter(([, grades]) => grades.includes("again")).map(([id]) => id),
  };
}
