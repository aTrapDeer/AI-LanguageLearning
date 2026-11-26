/**
 * Human-readable intervals for the review screen ("10 min", "3 d") and due times ("in 2 hours").
 * Pure and client-safe.
 */

import { REVIEW_GRADES, scheduleReview, type ReviewGrade, type SrsState } from "../srs";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

/** Compact interval label used on the grade buttons. */
export function formatInterval(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;

  if (safe < HOUR_MS) {
    return `${Math.max(1, Math.round(safe / MINUTE_MS))} min`;
  }

  if (safe < DAY_MS) {
    return `${Math.round(safe / HOUR_MS)} h`;
  }

  const days = safe / DAY_MS;
  if (days < 30) {
    return `${Math.round(days)} d`;
  }

  if (days < 365) {
    const months = roundTo(days / 30, 0.5);
    return `${Number.isInteger(months) ? months : months.toFixed(1)} mo`;
  }

  const years = roundTo(days / 365, 0.5);
  return `${Number.isInteger(years) ? years : years.toFixed(1)} y`;
}

export interface IntervalPreview {
  grade: ReviewGrade;
  label: string;
  nextReview: Date;
}

/** What each grade would schedule for this card right now. */
export function previewIntervals(state: Partial<SrsState> | null | undefined, now: Date): Record<ReviewGrade, IntervalPreview> {
  const entries = REVIEW_GRADES.map((grade) => {
    const next = scheduleReview(state, grade, now);
    return [grade, { grade, label: formatInterval(next.nextReview.getTime() - now.getTime()), nextReview: next.nextReview }] as const;
  });

  return Object.fromEntries(entries) as Record<ReviewGrade, IntervalPreview>;
}

/** "now", "in 10 minutes", "in 3 hours", "tomorrow", "in 4 days", "in 2 months". */
export function formatDueIn(target: Date | string | null | undefined, now: Date): string | null {
  if (target === null || target === undefined || target === "") {
    return null;
  }

  const dueMs = target instanceof Date ? target.getTime() : Date.parse(target);
  if (Number.isNaN(dueMs)) {
    return null;
  }

  const diff = dueMs - now.getTime();
  if (diff <= 30 * 1000) {
    return "now";
  }

  if (diff < HOUR_MS) {
    const minutes = Math.max(1, Math.round(diff / MINUTE_MS));
    return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }

  if (diff < DAY_MS) {
    const hours = Math.round(diff / HOUR_MS);
    return hours >= 24 ? "tomorrow" : `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  const days = Math.round(diff / DAY_MS);
  if (days <= 1) {
    return "tomorrow";
  }

  if (days < 45) {
    return `in ${days} days`;
  }

  const months = Math.round(days / 30);
  return `in ${months} ${months === 1 ? "month" : "months"}`;
}
