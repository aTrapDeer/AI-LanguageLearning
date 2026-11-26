"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notifyLearnSummaryChanged } from "@/hooks/use-learn-summary";
import type {
  CompleteLessonRequest,
  CompleteLessonResponse,
  LessonErrorCode,
  LessonErrorResponse,
  StartLessonResponse,
} from "@/lib/lesson/api-types";
import { applyStepOutcome, createInitialProgress, isFinished, type LessonProgress, type StepOutcome } from "@/lib/lesson/session";
import { getLocalDateString } from "@/lib/local-date";

export type RunnerState =
  | { status: "loading" }
  | { status: "error"; code: LessonErrorCode; message: string }
  | { status: "playing"; lesson: StartLessonResponse; progress: LessonProgress }
  | { status: "completing"; lesson: StartLessonResponse; progress: LessonProgress; error: string | null }
  | { status: "done"; lesson: StartLessonResponse; progress: LessonProgress; result: CompleteLessonResponse };

class LessonRequestError extends Error {
  constructor(
    readonly code: LessonErrorCode,
    message: string
  ) {
    super(message);
  }
}

async function postJson<T>(url: string, body: unknown, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
  const data = (await response.json().catch(() => null)) as (T & Partial<LessonErrorResponse>) | null;
  if (!response.ok || !data) {
    throw new LessonRequestError(data?.code ?? "server_error", data?.error ?? "Something went wrong. Please try again.");
  }
  return data;
}

// React re-runs effects in development; share one in-flight start per key so a lesson isn't started twice.
const inflightStarts = new Map<string, Promise<StartLessonResponse>>();

function startLessonRequest(key: string, language: string, unitId: string | null) {
  let request = inflightStarts.get(key);
  if (!request) {
    request = postJson<StartLessonResponse>("/api/lessons/start", { language, unitId });
    inflightStarts.set(key, request);
    const clear = () => inflightStarts.delete(key);
    request.then(clear, clear);
  }
  return request;
}

/**
 * Loads (or resumes) a lesson for a unit, advances through it, saves resume state after every step
 * and completes it on the server at the end.
 */
export function useLessonRunner(language: string, unitId: string | null) {
  const [state, setState] = useState<RunnerState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const stateRef = useRef(state);
  stateRef.current = state;

  const persist = useCallback((attemptId: string, progress: LessonProgress) => {
    saveChain.current = saveChain.current
      .catch(() => undefined)
      .then(() =>
        fetch(`/api/lessons/attempts/${encodeURIComponent(attemptId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress }),
          keepalive: true,
        })
      )
      .catch(() => undefined);
  }, []);

  const complete = useCallback(async (lesson: StartLessonResponse, progress: LessonProgress) => {
    setState({ status: "completing", lesson, progress, error: null });
    const body: CompleteLessonRequest = {
      results: Object.entries(progress.results).map(([stepId, result]) => ({ stepId, answer: result.answer })),
      localDate: getLocalDateString(),
    };

    try {
      await saveChain.current.catch(() => undefined);
      const result = await postJson<CompleteLessonResponse>(`/api/lessons/attempts/${encodeURIComponent(lesson.attemptId)}/complete`, body);
      setState({ status: "done", lesson, progress, result });
      notifyLearnSummaryChanged();
    } catch (error) {
      setState({ status: "completing", lesson, progress, error: error instanceof Error ? error.message : "Couldn't save your lesson." });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    startLessonRequest(`${language}|${unitId ?? ""}|${nonce}`, language, unitId)
      .then((lesson) => {
        if (cancelled) return;
        const progress = lesson.progress ?? createInitialProgress(lesson.plan);
        if (isFinished(progress)) {
          void complete(lesson, progress);
        } else {
          setState({ status: "playing", lesson, progress });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const code = error instanceof LessonRequestError ? error.code : "server_error";
        setState({ status: "error", code, message: error instanceof Error ? error.message : "Couldn't load the lesson." });
      });

    return () => {
      cancelled = true;
    };
  }, [complete, language, unitId, nonce]);

  const advance = useCallback(
    (outcome: StepOutcome) => {
      const current = stateRef.current;
      if (current.status !== "playing") return;
      const progress = applyStepOutcome(current.progress, outcome);
      if (progress === current.progress) return;

      persist(current.lesson.attemptId, progress);
      if (isFinished(progress)) {
        void complete(current.lesson, progress);
      } else {
        setState({ status: "playing", lesson: current.lesson, progress });
      }
    },
    [complete, persist]
  );

  const retryComplete = useCallback(() => {
    const current = stateRef.current;
    if (current.status === "completing") void complete(current.lesson, current.progress);
  }, [complete]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  /** Waits for pending saves (used before leaving the lesson). */
  const flush = useCallback(() => saveChain.current.catch(() => undefined), []);

  return { state, advance, retryComplete, reload, flush };
}
