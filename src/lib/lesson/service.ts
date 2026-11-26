import { enforceAiQuota } from "@/lib/api-auth";
import { getNextUnit, getUnitById, getUnitsForLevel, isUnitUnlocked, type CurriculumUnit } from "@/lib/curriculum";
import {
  applyReviewGrade,
  completeLessonAttempt,
  findReusableLesson,
  getActiveLessonAttempt,
  getLessonAttempt,
  getLessonById,
  getProgress,
  getUnitProgress,
  insertLesson,
  listDueVocabulary,
  listKnownWords,
  listRecentMistakes,
  listWeakestVocabulary,
  recordMistakes,
  saveLessonAttemptState,
  startLessonAttempt,
  upsertVocabulary,
  type LessonAttempt,
  type MistakeInput,
  type StoredLesson,
} from "@/lib/database";
import { clampLevel } from "@/lib/levels";
import { generateJson, isOpenAIConfigured, StructuredOutputError } from "@/lib/openai";
import { gradeFromOutcome } from "@/lib/srs";
import type {
  CompleteLessonRequest,
  CompleteLessonResponse,
  LessonErrorCode,
  LessonSource,
  LessonWordResult,
  PathResponse,
  StartLessonResponse,
} from "./api-types";
import { buildLessonPlan, countGradedSteps } from "./builder";
import {
  generatedLessonContentSchema,
  LESSON_CONTENT_VERSION,
  validateLessonContent,
  validateStoredContent,
  type LessonContent,
} from "./content";
import { gradeStep } from "./grader";
import { buildLessonPrompt } from "./prompt";
import { randomSeed, pickSome, createRng } from "./rng";
import { sanitizeProgress, type LessonProgress } from "./session";
import { getStarterContent } from "./starter-content";
import { findAnyLessonForUnit, listInProgressUnits } from "./store";
import { isGradedStep, type GradedStep, type LessonPlan, type PlanWord } from "./types";

/** Lesson orchestration for the /api/lessons routes. Server-only. */

export interface AttemptState {
  v: 1;
  plan: LessonPlan;
  progress: LessonProgress | null;
  outcome?: { words: LessonWordResult[]; reviewedCount: number } | null;
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code: LessonErrorCode };

function fail(status: number, code: LessonErrorCode, error: string): { ok: false; status: number; error: string; code: LessonErrorCode } {
  return { ok: false, status, error, code };
}

/** One second per exercise is faster than anyone can read and answer; stops scripted XP farming. */
const MIN_MS_PER_EXERCISE = 1000;

function isPlayable(unit: CurriculumUnit, learnerLevel: number, completedUnitIds: string[]) {
  if (unit.level < learnerLevel) return true;
  if (unit.level > learnerLevel) return false;
  return isUnitUnlocked(unit.id, completedUnitIds);
}

function isAttemptState(value: unknown): value is AttemptState {
  const state = value as AttemptState | null;
  return Boolean(state && state.v === 1 && state.plan && Array.isArray(state.plan.steps) && state.plan.steps.length > 0);
}

async function loadValidLesson(lesson: StoredLesson | null, language: string): Promise<{ lesson: StoredLesson; content: LessonContent } | null> {
  if (!lesson) return null;
  const content = validateStoredContent(lesson.content, language);
  return content ? { lesson, content } : null;
}

async function generateContent(params: { userId: string; language: string; unit: CurriculumUnit }): Promise<LessonContent> {
  const [known, weakest, mistakes] = await Promise.all([
    listKnownWords(params.userId, params.language, 200),
    listWeakestVocabulary(params.userId, params.language, 8),
    listRecentMistakes({ userId: params.userId, language: params.language, limit: 8 }),
  ]);
  const rng = createRng(randomSeed());

  let retryFeedback: string[] | undefined;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const prompt = buildLessonPrompt({
      language: params.language,
      unit: params.unit,
      knownWords: pickSome(known, 40, rng),
      weakWords: weakest.map((item) => item.word),
      recentMistakes: mistakes.map((mistake) => `${mistake.incorrect} → ${mistake.correction}`),
      retryFeedback,
    });

    const raw = await generateJson({
      schema: generatedLessonContentSchema,
      schemaName: "lesson_content",
      system: prompt.system,
      user: prompt.user,
      temperature: 0.7,
      maxTokens: 3000,
    });

    const validation = validateLessonContent(raw, params.language);
    if (validation.ok) {
      return { ...validation.content, title: validation.content.title || params.unit.title };
    }
    retryFeedback = validation.errors;
  }

  throw new StructuredOutputError("schema_mismatch", "Generated lesson content failed validation", {
    attempts: 2,
    issues: retryFeedback,
  });
}

async function chooseLesson(params: {
  userId: string;
  language: string;
  unit: CurriculumUnit;
}): Promise<ServiceResult<{ lesson: StoredLesson; content: LessonContent; source: LessonSource }>> {
  const { userId, language, unit } = params;

  const reusable = await loadValidLesson(
    await findReusableLesson({ userId, language, unitId: unit.id, minContentVersion: LESSON_CONTENT_VERSION }),
    language
  );
  if (reusable) {
    return { ok: true, data: { ...reusable, source: "pool" } };
  }

  // Nothing new in the pool: generate a fresh lesson when we can.
  let failure: { status: number; code: LessonErrorCode; error: string } = {
    status: 503,
    code: "generation_unavailable",
    error: "New lessons for this unit can't be prepared right now.",
  };

  if (isOpenAIConfigured()) {
    const limited = await enforceAiQuota(userId, "text");
    if (limited) {
      failure = { status: 429, code: "ai_quota_exceeded", error: "You've reached today's limit for new lessons. It resets at midnight UTC." };
    } else {
      try {
        const content = await generateContent({ userId, language, unit });
        const lesson = await insertLesson({ language, unitId: unit.id, content, contentVersion: LESSON_CONTENT_VERSION, createdBy: userId });
        return { ok: true, data: { lesson, content, source: "generated" } };
      } catch (error) {
        console.error("[LESSON_GENERATE]", error instanceof StructuredOutputError ? { kind: error.kind, issues: error.issues } : error);
        failure = { status: 502, code: "generation_failed", error: "We couldn't prepare this lesson. Please try again." };
      }
    }
  }

  // Replays may reuse a lesson the learner has seen before rather than fail.
  const any = await loadValidLesson(
    await findAnyLessonForUnit({ language, unitId: unit.id, minContentVersion: LESSON_CONTENT_VERSION }),
    language
  );
  if (any) {
    return { ok: true, data: { ...any, source: "pool" } };
  }

  const starter = getStarterContent(language, unit.id);
  if (starter) {
    const validation = validateLessonContent(starter, language);
    if (validation.ok) {
      const lesson = await insertLesson({
        language,
        unitId: unit.id,
        content: validation.content,
        contentVersion: LESSON_CONTENT_VERSION,
        createdBy: null,
      });
      return { ok: true, data: { lesson, content: validation.content, source: "starter" } };
    }
  }

  return { ok: false, ...failure };
}

async function planFor(params: { userId: string; language: string; lesson: StoredLesson; content: LessonContent }): Promise<LessonPlan> {
  const due = await listDueVocabulary({ userId: params.userId, language: params.language, limit: 12 });
  return buildLessonPlan(params.content, {
    language: params.language,
    lessonId: params.lesson.id,
    unitId: params.lesson.unitId,
    seed: randomSeed(),
    reviewWords: due.map((item) => ({ id: item.id, word: item.word, translation: item.translation, romanization: item.romanization })),
  });
}

async function resume(userId: string, attempt: LessonAttempt<unknown>, unit: CurriculumUnit): Promise<StartLessonResponse | null> {
  if (isAttemptState(attempt.state)) {
    const progress = sanitizeProgress(attempt.state.plan, attempt.state.progress);
    return { attemptId: attempt.id, resumed: progress !== null && progress.done > 0, source: "pool", unit, plan: attempt.state.plan, progress };
  }

  // An attempt without a plan (e.g. created elsewhere): give it one.
  const loaded = await loadValidLesson(await getLessonById(attempt.lessonId), attempt.language);
  if (!loaded) return null;
  const plan = await planFor({ userId, language: attempt.language, ...loaded });
  const state: AttemptState = { v: 1, plan, progress: null };
  const saved = await saveLessonAttemptState({ userId, attemptId: attempt.id, state });
  return saved ? { attemptId: attempt.id, resumed: false, source: "pool", unit, plan, progress: null } : null;
}

export async function startLesson(params: { userId: string; language: string; unitId?: string | null }): Promise<ServiceResult<StartLessonResponse>> {
  const { userId, language } = params;
  const progress = await getProgress(userId, language);
  if (!progress) {
    return fail(409, "language_not_setup", "Add this language to your account first.");
  }

  const { completedUnitIds } = await getUnitProgress(userId, language);
  const unit = params.unitId
    ? getUnitById(params.unitId)
    : (getNextUnit(progress.level, completedUnitIds) ?? getUnitsForLevel(progress.level)[0]);
  if (!unit) {
    return fail(404, "unit_not_found", "That unit doesn't exist.");
  }
  if (!isPlayable(unit, progress.level, completedUnitIds)) {
    return fail(
      403,
      "unit_locked",
      unit.level > progress.level ? `Reach level ${unit.level} to unlock this unit.` : "Finish the earlier units first to unlock this one."
    );
  }

  const active = await getActiveLessonAttempt({ userId, language, unitId: unit.id });
  if (active) {
    const resumed = await resume(userId, active, unit);
    if (resumed) return { ok: true, data: resumed };
  }

  const chosen = await chooseLesson({ userId, language, unit });
  if (!chosen.ok) return chosen;

  const plan = await planFor({ userId, language, lesson: chosen.data.lesson, content: chosen.data.content });
  const initialState: AttemptState = { v: 1, plan, progress: null };
  const attempt = await startLessonAttempt<AttemptState>({ userId, lessonId: chosen.data.lesson.id, initialState });
  const state = isAttemptState(attempt.state) ? attempt.state : initialState;

  return {
    ok: true,
    data: {
      attemptId: attempt.id,
      resumed: false,
      source: chosen.data.source,
      unit,
      plan: state.plan,
      progress: sanitizeProgress(state.plan, state.progress),
    },
  };
}

export async function saveProgress(params: { userId: string; attemptId: string; progress: unknown }): Promise<ServiceResult<{ saved: true }>> {
  const attempt = await getLessonAttempt(params.userId, params.attemptId);
  if (!attempt || attempt.status !== "in_progress" || !isAttemptState(attempt.state)) {
    return fail(404, "attempt_not_found", "This lesson is no longer in progress.");
  }

  const progress = sanitizeProgress(attempt.state.plan, params.progress);
  if (!progress) {
    return fail(400, "invalid_request", "Invalid progress.");
  }

  const state: AttemptState = { ...attempt.state, progress };
  const correct = Object.values(progress.results).filter((result) => result.correct).length;
  const saved = await saveLessonAttemptState({
    userId: params.userId,
    attemptId: params.attemptId,
    state,
    correctCount: correct,
    totalCount: countGradedSteps(attempt.state.plan),
  });
  return saved ? { ok: true, data: { saved: true } } : fail(404, "attempt_not_found", "This lesson is no longer in progress.");
}

function mistakeFor(step: GradedStep, expected: string, given: string, language: string): MistakeInput | null {
  if (!given.trim() || !expected.trim()) return null;
  switch (step.kind) {
    case "build":
      return { kind: "word_order", incorrect: given, correction: expected, context: step.translation, explanation: step.explanation };
    case "type":
      return { kind: "spelling", incorrect: given, correction: expected, context: step.prompt, explanation: step.explanation };
    case "fill":
      return { kind: "vocabulary", incorrect: given, correction: expected, context: step.sentence.text, explanation: step.explanation };
    case "choice":
    case "listen":
      return {
        kind: "vocabulary",
        incorrect: given,
        correction: expected,
        context: step.kind === "choice" ? step.prompt.text : step.audio.text,
        explanation: step.explanation,
      };
    case "match":
      return { kind: "vocabulary", incorrect: given, correction: expected, context: `matching (${language})`, explanation: null };
    default:
      return null;
  }
}

function wordsResult(plan: LessonPlan, missedKeys: Set<string>): LessonWordResult[] {
  return plan.newWords.map((word: PlanWord) => ({
    word: word.word,
    translation: word.translation,
    romanization: word.romanization,
    missed: missedKeys.has(word.key),
  }));
}

async function nextUnitFor(userId: string, language: string, level: number): Promise<CompleteLessonResponse["nextUnit"]> {
  const { completedUnitIds } = await getUnitProgress(userId, language);
  const next = getNextUnit(clampLevel(level), completedUnitIds);
  return next ? { id: next.id, title: next.title, emoji: next.emoji, level: next.level } : null;
}

async function alreadyCompleted(userId: string, attempt: LessonAttempt<unknown>): Promise<CompleteLessonResponse> {
  const state = isAttemptState(attempt.state) ? attempt.state : null;
  const progress = await getProgress(userId, attempt.language);
  const { bestStars } = await getUnitProgress(userId, attempt.language);
  return {
    alreadyCompleted: true,
    unitId: attempt.unitId,
    correctCount: attempt.correctCount,
    totalCount: attempt.totalCount,
    accuracy: attempt.accuracy,
    stars: attempt.stars,
    xpAwarded: attempt.xpAwarded,
    isFirstPass: false,
    bestStars: bestStars[attempt.unitId] ?? attempt.stars,
    activity: null,
    words: state?.outcome?.words ?? [],
    reviewedCount: state?.outcome?.reviewedCount ?? 0,
    nextUnit: await nextUnitFor(userId, attempt.language, progress?.level ?? attempt.level),
  };
}

export async function completeLesson(params: {
  userId: string;
  attemptId: string;
  body: CompleteLessonRequest;
  now?: Date;
}): Promise<ServiceResult<CompleteLessonResponse>> {
  const { userId, attemptId } = params;
  const now = params.now ?? new Date();
  const attempt = await getLessonAttempt(userId, attemptId);
  if (!attempt) {
    return fail(404, "attempt_not_found", "Lesson not found.");
  }
  if (attempt.status === "completed") {
    return { ok: true, data: await alreadyCompleted(userId, attempt) };
  }
  if (!isAttemptState(attempt.state)) {
    return fail(409, "attempt_not_found", "This lesson can't be completed. Please start it again.");
  }

  const state = attempt.state;
  const plan = state.plan;
  const language = attempt.language;
  const graded = plan.steps.filter(isGradedStep);
  const results = Array.isArray(params.body.results) ? params.body.results : [];
  if (results.length > graded.length) {
    return fail(400, "invalid_request", "Too many results.");
  }

  const answers = new Map<string, CompleteLessonRequest["results"][number]["answer"]>();
  for (const result of results) {
    const id = typeof result?.stepId === "string" ? result.stepId : "";
    if (!graded.some((step) => step.id === id) || answers.has(id) || JSON.stringify(result.answer ?? null).length > 4000) {
      return fail(400, "invalid_request", "Unknown or repeated exercise result.");
    }
    answers.set(id, result.answer);
  }
  if (answers.size !== graded.length) {
    return fail(400, "lesson_incomplete", "Finish every exercise before completing the lesson.");
  }

  const elapsed = now.getTime() - new Date(attempt.startedAt).getTime();
  if (elapsed < graded.length * MIN_MS_PER_EXERCISE) {
    return fail(400, "too_fast", "That was quicker than humanly possible — take your time.");
  }

  const outcomes = graded.map((step) => ({ step, result: gradeStep(step, answers.get(step.id), language) }));
  const correctCount = outcomes.filter((outcome) => outcome.result.correct).length;

  const missedKeys = new Set(
    outcomes.filter((outcome) => !outcome.result.correct && outcome.step.ref.kind === "word").map((outcome) => (outcome.step.ref as { key: string }).key)
  );
  const words = wordsResult(plan, missedKeys);
  const reviewOutcomes = outcomes.filter((outcome) => outcome.step.ref.kind === "review");

  const finalProgress = sanitizeProgress(plan, state.progress);
  const completed = await completeLessonAttempt({
    userId,
    attemptId,
    correctCount,
    totalCount: graded.length,
    localDate: params.body.localDate,
    finalState: { ...state, progress: finalProgress, outcome: { words, reviewedCount: reviewOutcomes.length } } satisfies AttemptState,
    now,
  });

  if (!completed) {
    const fresh = await getLessonAttempt(userId, attemptId);
    return fresh ? { ok: true, data: await alreadyCompleted(userId, fresh) } : fail(404, "attempt_not_found", "Lesson not found.");
  }

  // XP is recorded; the learning side effects below should not fail the response.
  try {
    const missed = plan.newWords.filter((word) => missedKeys.has(word.key));
    const learned = plan.newWords.filter((word) => !missedKeys.has(word.key));
    const toInput = (word: PlanWord) => ({
      word: word.word,
      translation: word.translation,
      romanization: word.romanization,
      exampleSentence: word.example,
      exampleTranslation: word.exampleTranslation,
      unitId: plan.unitId,
      tags: [plan.unitId],
    });
    if (missed.length > 0) {
      await upsertVocabulary({ userId, language, source: "journey", items: missed.map(toInput), now });
    }
    if (learned.length > 0) {
      // Words answered right first time were just practised; the first review is tomorrow.
      await upsertVocabulary({
        userId,
        language,
        source: "journey",
        items: learned.map(toInput),
        now,
        firstReviewAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      });
    }

    for (const { step, result } of reviewOutcomes) {
      if (step.ref.kind === "review") {
        await applyReviewGrade({ userId, itemId: step.ref.vocabId, grade: gradeFromOutcome(result.correct), now });
      }
    }

    const mistakes = outcomes
      .filter((outcome) => !outcome.result.correct)
      .map((outcome) => mistakeFor(outcome.step, outcome.result.expected, outcome.result.given, language))
      .filter((mistake): mistake is MistakeInput => Boolean(mistake));
    if (mistakes.length > 0) {
      await recordMistakes({ userId, language, source: "journey", mistakes });
    }
  } catch (error) {
    console.error("[LESSON_COMPLETE_SIDE_EFFECTS]", error);
  }

  return {
    ok: true,
    data: {
      alreadyCompleted: false,
      unitId: plan.unitId,
      correctCount,
      totalCount: graded.length,
      accuracy: completed.accuracy,
      stars: completed.stars,
      xpAwarded: completed.xpAwarded,
      isFirstPass: completed.isFirstPass,
      bestStars: completed.bestStars,
      activity: completed.activity,
      words,
      reviewedCount: reviewOutcomes.length,
      nextUnit: await nextUnitFor(userId, language, completed.activity.level),
    },
  };
}

export async function getPath(params: { userId: string; language: string; level?: number | null }): Promise<PathResponse> {
  const { userId, language } = params;
  const [progress, unitProgress, inProgress] = await Promise.all([
    getProgress(userId, language),
    getUnitProgress(userId, language),
    listInProgressUnits(userId, language),
  ]);
  const learnerLevel = progress?.level ?? 1;
  const level = clampLevel(params.level ?? learnerLevel);
  const passed = new Set(unitProgress.completedUnitIds);

  return {
    language,
    hasProgress: Boolean(progress),
    learnerLevel,
    level,
    units: getUnitsForLevel(level).map((unit) => ({
      ...unit,
      stars: unitProgress.bestStars[unit.id] ?? 0,
      completed: passed.has(unit.id),
      unlocked: isPlayable(unit, learnerLevel, unitProgress.completedUnitIds),
      inProgress: unit.id in inProgress ? inProgress[unit.id] : null,
    })),
  };
}
