import type { GradeNote, LessonAnswer, LessonPlan } from "./types";

/**
 * Player progress through a plan: a queue of step ids, first-try results and the current combo.
 * Pure so the player, the resume path and the server-side validation share one definition.
 *
 * A missed exercise goes back to the end of the queue until it is answered correctly once (at most
 * MAX_RETRIES extra times, so nobody gets stuck). Only the first try counts towards stars.
 */

export const MAX_RETRIES = 3;

export interface FirstTryResult {
  correct: boolean;
  answer: LessonAnswer;
  note: GradeNote;
}

export interface LessonProgress {
  v: 1;
  queue: string[];
  done: number;
  results: Record<string, FirstTryResult>;
  retries: Record<string, number>;
  combo: number;
  bestCombo: number;
}

export interface StepOutcome {
  stepId: string;
  graded: boolean;
  correct?: boolean;
  answer?: LessonAnswer;
  note?: GradeNote;
}

export function createInitialProgress(plan: Pick<LessonPlan, "steps">): LessonProgress {
  return { v: 1, queue: plan.steps.map((step) => step.id), done: 0, results: {}, retries: {}, combo: 0, bestCombo: 0 };
}

export function currentStepId(progress: LessonProgress): string | null {
  return progress.queue[0] ?? null;
}

export function isRetry(progress: LessonProgress, stepId: string): boolean {
  return stepId in progress.results;
}

export function applyStepOutcome(progress: LessonProgress, outcome: StepOutcome): LessonProgress {
  if (progress.queue[0] !== outcome.stepId) {
    return progress;
  }

  const [, ...rest] = progress.queue;
  const next: LessonProgress = { ...progress, queue: rest, done: progress.done + 1 };

  if (!outcome.graded) {
    return next;
  }

  const correct = Boolean(outcome.correct);
  const firstTry = !(outcome.stepId in progress.results);
  if (firstTry && outcome.answer) {
    next.results = { ...progress.results, [outcome.stepId]: { correct, answer: outcome.answer, note: outcome.note ?? null } };
  }

  // Combos reward first-try answers; getting a re-queued item right keeps the combo but doesn't grow it.
  next.combo = !correct ? 0 : firstTry ? progress.combo + 1 : progress.combo;
  next.bestCombo = Math.max(progress.bestCombo, next.combo);

  if (!correct) {
    const retries = progress.retries[outcome.stepId] ?? 0;
    if (retries < MAX_RETRIES) {
      next.queue = [...rest, outcome.stepId];
      next.retries = { ...progress.retries, [outcome.stepId]: retries + 1 };
    }
  }

  return next;
}

/** 0..1 — completed steps over completed + remaining, so a re-queued miss nudges the bar back a bit. */
export function progressRatio(progress: LessonProgress): number {
  const total = progress.done + progress.queue.length;
  return total === 0 ? 1 : progress.done / total;
}

export function isFinished(progress: LessonProgress): boolean {
  return progress.queue.length === 0;
}

export function firstTryStats(plan: Pick<LessonPlan, "steps">, progress: Pick<LessonProgress, "results">) {
  const graded = plan.steps.filter((step) => step.graded);
  const correct = graded.filter((step) => progress.results[step.id]?.correct).length;
  return { correct, total: graded.length, answered: graded.filter((step) => progress.results[step.id]).length };
}

/** Combo counts worth celebrating. */
export function isComboMilestone(combo: number): boolean {
  return combo === 3 || combo === 5 || (combo >= 8 && combo % 4 === 0);
}

/**
 * Accepts progress coming back from a client (resume state) only if it refers to this plan's steps,
 * so a tampered save cannot inject unknown ids or blow up the stored state.
 */
export function sanitizeProgress(plan: Pick<LessonPlan, "steps">, raw: unknown): LessonProgress | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Partial<LessonProgress>;
  const ids = new Set(plan.steps.map((step) => step.id));
  const gradedIds = new Set(plan.steps.filter((step) => step.graded).map((step) => step.id));
  const maxQueue = plan.steps.length * (MAX_RETRIES + 1);

  if (!Array.isArray(value.queue) || value.queue.length > maxQueue || !value.queue.every((id) => typeof id === "string" && ids.has(id))) {
    return null;
  }

  const done = Number(value.done);
  if (!Number.isInteger(done) || done < 0 || done > maxQueue) {
    return null;
  }

  const results: Record<string, FirstTryResult> = {};
  for (const [id, result] of Object.entries(value.results ?? {})) {
    if (!gradedIds.has(id) || !result || typeof result !== "object") {
      return null;
    }
    const answer = (result as FirstTryResult).answer;
    if (!answer || typeof answer !== "object" || JSON.stringify(answer).length > 4000) {
      return null;
    }
    const note = (result as FirstTryResult).note;
    results[id] = {
      correct: Boolean((result as FirstTryResult).correct),
      answer,
      note: note === "accent" || note === "typo" || note === "article" ? note : null,
    };
  }

  const retries: Record<string, number> = {};
  for (const [id, count] of Object.entries(value.retries ?? {})) {
    const numeric = Number(count);
    if (!gradedIds.has(id) || !Number.isInteger(numeric) || numeric < 0 || numeric > MAX_RETRIES) {
      return null;
    }
    retries[id] = numeric;
  }

  const combo = Math.max(0, Math.min(1000, Math.floor(Number(value.combo) || 0)));
  const bestCombo = Math.max(combo, Math.min(1000, Math.floor(Number(value.bestCombo) || 0)));

  return { v: 1, queue: value.queue, done, results, retries, combo, bestCombo };
}
