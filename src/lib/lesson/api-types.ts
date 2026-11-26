import type { CurriculumUnit } from "@/lib/curriculum";
import type { ActivityResult } from "@/lib/db/activity";
import type { LessonProgress } from "./session";
import type { LessonAnswer, LessonPlan } from "./types";

/** Request/response shapes of /api/lessons/*, shared by the routes and the player. */

export type LessonSource = "pool" | "generated" | "starter";

export interface StartLessonRequest {
  language: string;
  unitId?: string | null;
}

export interface StartLessonResponse {
  attemptId: string;
  resumed: boolean;
  source: LessonSource;
  unit: CurriculumUnit;
  plan: LessonPlan;
  progress: LessonProgress | null;
}

export type LessonErrorCode =
  | "invalid_request"
  | "language_not_setup"
  | "unit_not_found"
  | "unit_locked"
  | "generation_unavailable"
  | "generation_failed"
  | "ai_quota_exceeded"
  | "attempt_not_found"
  | "lesson_incomplete"
  | "too_fast"
  | "server_error";

export interface LessonErrorResponse {
  error: string;
  code: LessonErrorCode;
}

export interface SaveProgressRequest {
  progress: LessonProgress;
}

export interface CompleteLessonRequest {
  results: Array<{ stepId: string; answer: LessonAnswer }>;
  localDate?: string | null;
}

export interface LessonWordResult {
  word: string;
  translation: string;
  romanization: string | null;
  /** Missed on the first try: due for review right away. */
  missed: boolean;
  /** Newly added to the review deck by this lesson (false when the learner already had it). */
  isNew: boolean;
}

export interface CompleteLessonResponse {
  alreadyCompleted: boolean;
  unitId: string;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  stars: number;
  xpAwarded: number;
  isFirstPass: boolean;
  bestStars: number;
  /** Null when the attempt had already been completed (nothing new was recorded). */
  activity: ActivityResult | null;
  words: LessonWordResult[];
  reviewedCount: number;
  nextUnit: Pick<CurriculumUnit, "id" | "title" | "emoji" | "level"> | null;
}

export interface PathUnit extends CurriculumUnit {
  stars: number;
  completed: boolean;
  /** Can be started now: earlier levels are open, the current level unlocks in order. */
  unlocked: boolean;
  /** 0..1 when there is an unfinished attempt. */
  inProgress: number | null;
}

export interface PathResponse {
  language: string;
  hasProgress: boolean;
  learnerLevel: number;
  level: number;
  units: PathUnit[];
}
