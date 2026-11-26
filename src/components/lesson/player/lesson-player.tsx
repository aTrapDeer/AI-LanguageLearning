"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LessonShell } from "@/components/learn";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { getUnitById } from "@/lib/curriculum";
import { getLanguageConfig } from "@/lib/language-config";
import { gradeStep } from "@/lib/lesson/grader";
import { isComboMilestone, isRetry, MAX_RETRIES, progressRatio } from "@/lib/lesson/session";
import type { GradeResult, LessonAnswer, LessonStep } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";
import { StepView } from "../exercises/step-view";
import { useEnterKey } from "../hooks";
import { ComboBurst } from "./combo-burst";
import { LessonComplete } from "./lesson-complete";
import { LessonError, LessonLoading } from "./lesson-status";
import { StepFeedback } from "./step-feedback";
import { useLessonRunner } from "./use-lesson-runner";

const ROMANIZATION_KEY = "laingfy:lesson-romanization";

function useRomanizationPreference(language: string) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(`${ROMANIZATION_KEY}:${language}`) !== "off");
    } catch {
      setShow(true);
    }
  }, [language]);

  const toggle = useCallback(() => {
    setShow((current) => {
      try {
        window.localStorage.setItem(`${ROMANIZATION_KEY}:${language}`, current ? "off" : "on");
      } catch {
        // Preference only; ignore storage failures.
      }
      return !current;
    });
  }, [language]);

  return [show, toggle] as const;
}

export interface LessonPlayerProps {
  language: string;
  unitId: string;
}

/** Plays one unit's lesson: loading/resume, exercises with instant feedback, re-queued misses, summary. */
export function LessonPlayer({ language, unitId }: LessonPlayerProps) {
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();
  const { state, advance, retryComplete, reload, flush } = useLessonRunner(language, unitId);
  const config = getLanguageConfig(language);
  const [showRomanization, toggleRomanization] = useRomanizationPreference(language);
  const pathHref = `/learn/journey?lang=${encodeURIComponent(language)}`;

  const [draft, setDraft] = useState<LessonAnswer | null>(null);
  const [answer, setAnswer] = useState<LessonAnswer | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [comboShown, setComboShown] = useState<number | null>(null);
  const shake = useAnimationControls();

  const playing = state.status === "playing" ? state : null;
  const stepsById = useMemo(
    () => new Map<string, LessonStep>((state.status === "loading" || state.status === "error" ? [] : state.lesson.plan.steps).map((step) => [step.id, step])),
    [state]
  );
  const currentId = playing?.progress.queue[0] ?? null;
  const step = currentId ? (stepsById.get(currentId) ?? null) : null;
  const retry = playing && currentId ? (playing.progress.retries[currentId] ?? 0) : 0;
  const stepKey = `${currentId}:${retry}`;

  useEffect(() => {
    setDraft(null);
    setAnswer(null);
    setResult(null);
  }, [stepKey]);

  useEffect(() => {
    if (comboShown === null) return;
    const timeout = window.setTimeout(() => setComboShown(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [comboShown]);

  const submit = useCallback(
    (submitted: LessonAnswer) => {
      if (!step || !step.graded || result || !playing) return;
      const graded = gradeStep(step, submitted, language);
      setAnswer(submitted);
      setResult(graded);
      if (graded.correct && !isRetry(playing.progress, step.id)) {
        const nextCombo = playing.progress.combo + 1;
        if (isComboMilestone(nextCombo)) setComboShown(nextCombo);
      } else if (!graded.correct && !reduceMotion) {
        void shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
      }
    },
    [language, playing, reduceMotion, result, shake, step]
  );

  const proceed = useCallback(() => {
    if (!step || !currentId) return;
    if (!step.graded) {
      advance({ stepId: currentId, graded: false });
      return;
    }
    if (result && answer) {
      advance({ stepId: currentId, graded: true, correct: result.correct, answer, note: result.note });
    }
  }, [advance, answer, currentId, result, step]);

  const onEnter = useCallback(() => {
    if (!step) return;
    if (!step.graded || result) {
      proceed();
    } else if (draft) {
      submit(draft);
    }
  }, [draft, proceed, result, step, submit]);

  useEnterKey(onEnter, state.status === "playing");

  const exit = useCallback(async () => {
    await Promise.race([flush(), new Promise((resolve) => setTimeout(resolve, 1500))]);
    router.push(pathHref);
  }, [flush, pathHref, router]);

  const unit = state.status === "loading" || state.status === "error" ? getUnitById(unitId) : state.lesson.unit;

  const topBarEnd = (
    <>
      {playing && playing.progress.combo >= 2 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/25 px-2.5 py-1 text-sm font-bold tabular-nums text-orange-100" aria-label={`${playing.progress.combo} correct in a row`}>
          🔥 {playing.progress.combo}
        </span>
      )}
      {config?.romanizationName && state.status !== "loading" && state.status !== "error" && (
        <button
          type="button"
          onClick={toggleRomanization}
          aria-pressed={showRomanization}
          title={`${showRomanization ? "Hide" : "Show"} ${config.romanizationName}`}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            showRomanization ? "bg-white/20 text-white" : "bg-white/5 text-white/60 line-through"
          )}
        >
          {language === "zh" ? "Pinyin" : "Aa"}
        </button>
      )}
    </>
  );

  if (state.status === "loading") {
    return (
      <LessonShell onExit={() => router.push(pathHref)} progress={0} progressLabel="Lesson progress">
        <LessonLoading unit={unit} />
      </LessonShell>
    );
  }

  if (state.status === "error") {
    return (
      <LessonShell exitHref={pathHref} topBarCenter={<span className="font-bold">{unit ? `${unit.emoji} ${unit.title}` : "Lesson"}</span>}>
        <LessonError code={state.code} message={state.message} language={language} unitId={unitId} pathHref={pathHref} onRetry={reload} />
      </LessonShell>
    );
  }

  if (state.status === "completing") {
    return (
      <LessonShell exitHref={pathHref} progress={1} progressLabel="Lesson progress">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" role="status" aria-live="polite">
          {state.error ? (
            <>
              <p className="text-xl font-bold">We couldn&apos;t save your result yet.</p>
              <p className="text-white/75">{state.error}</p>
              <button type="button" onClick={retryComplete} className="h-12 rounded-xl bg-white px-6 font-bold text-indigo-700">
                Try again
              </button>
            </>
          ) : (
            <>
              <div aria-hidden className="text-6xl motion-safe:animate-bounce">
                🏁
              </div>
              <p className="text-xl font-bold">Adding up your score…</p>
            </>
          )}
        </div>
      </LessonShell>
    );
  }

  if (state.status === "done") {
    return (
      <LessonShell exitHref={pathHref} topBarCenter={<span className="font-bold">{`${state.lesson.unit.emoji} ${state.lesson.unit.title}`}</span>}>
        <LessonComplete
          language={language}
          lesson={state.lesson}
          result={state.result}
          bestCombo={state.progress.bestCombo}
          pathHref={pathHref}
          onReplay={reload}
        />
      </LessonShell>
    );
  }

  if (!step || !playing) {
    return null;
  }

  const variant = answer?.type === "choice" ? answer.variant : undefined;
  const willRepeat = Boolean(result && !result.correct && retry < MAX_RETRIES);
  const footer = step.graded ? (
    result ? (
      <StepFeedback
        step={step}
        result={result}
        language={language}
        showRomanization={showRomanization}
        variant={variant}
        willRepeat={willRepeat}
        isRetry={isRetry(playing.progress, step.id)}
        onContinue={proceed}
      />
    ) : step.kind === "match" ? null : (
      <div className="mx-auto w-full max-w-2xl px-4 pb-4 pt-2 sm:px-6">
        <button
          type="button"
          onClick={() => draft && submit(draft)}
          disabled={!draft}
          className="h-14 w-full rounded-2xl bg-emerald-500 text-lg font-extrabold uppercase tracking-wide text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:bg-white/15 disabled:text-white/50 disabled:shadow-none"
        >
          Check
        </button>
      </div>
    )
  ) : (
    <div className="mx-auto w-full max-w-2xl px-4 pb-4 pt-2 sm:px-6">
      <button
        type="button"
        onClick={proceed}
        autoFocus
        className="h-14 w-full rounded-2xl bg-white text-lg font-extrabold uppercase tracking-wide text-indigo-700 shadow-lg transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        {step.kind === "intro" ? "Got it" : "Continue"}
      </button>
    </div>
  );

  return (
    <LessonShell
      onExit={exit}
      exitLabel="Save and exit"
      progress={progressRatio(playing.progress)}
      progressLabel="Lesson progress"
      topBarEnd={topBarEnd}
      footer={footer}
      contentClassName="relative"
    >
      <ComboBurst combo={comboShown} />
      {/* Enter-only transition: exit animations can stall on exercises that use shared layout animations. */}
      <motion.div
        key={stepKey}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: "easeOut" }}
        className="flex flex-1 flex-col"
      >
        <motion.div animate={shake} className="flex flex-1 flex-col">
          {isRetry(playing.progress, step.id) && !result && (
            <p className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-amber-300/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-200">
              Let&apos;s try that again
            </p>
          )}
          <StepView
            step={step}
            language={language}
            showRomanization={showRomanization}
            revealed={result}
            retry={retry}
            onDraft={setDraft}
            onSubmit={submit}
          />
        </motion.div>
      </motion.div>
    </LessonShell>
  );
}
