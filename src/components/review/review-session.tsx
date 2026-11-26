"use client";

import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LessonShell } from "@/components/learn";
import {
  createQueue,
  currentCardId,
  dropCard,
  gradeCurrent,
  isQueueFinished,
  queueProgress,
  queueStats,
  type QueueStats,
} from "@/lib/review/queue";
import type { CompleteResponse, ReviewCardData, ReviewSessionData } from "@/lib/review/types";
import { scheduleReview, type ReviewGrade } from "@/lib/srs";
import { ApiError, beaconCompleteReviewSession, completeReviewSession, postGrade } from "./api";
import { GradeButtons } from "./grade-buttons";
import { ReviewCard } from "./review-card";

export interface SessionOutcome {
  result: CompleteResponse | null;
  error: string | null;
  stats: QueueStats;
  cards: Record<string, ReviewCardData>;
  failedSaves: number;
}

export interface ReviewSessionProps {
  session: ReviewSessionData;
  onFinish: (outcome: SessionOutcome) => void;
  /** Leaving before any card was graded. */
  onAbandon: () => void;
}

async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Client errors (409 not allowed, 404 deleted) are final; retry network blips and 5xx once.
    if (error instanceof ApiError && error.status < 500) throw error;
    await new Promise((resolve) => setTimeout(resolve, 600));
    return run();
  }
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function ReviewSession({ session, onFinish, onAbandon }: ReviewSessionProps) {
  const [queue, setQueue] = useState(() => createQueue(session.cards.map((card) => card.id)));
  const [cards, setCards] = useState<Record<string, ReviewCardData>>(() =>
    Object.fromEntries(session.cards.map((card) => [card.id, card]))
  );
  const [revealed, setRevealed] = useState(false);
  const [failedSaves, setFailedSaves] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const gradedAnyRef = useRef(false);
  const completedRef = useRef(false);
  const failedRef = useRef(0);
  const latest = useRef({ queue, cards });
  latest.current = { queue, cards };

  const currentId = currentCardId(queue);
  const card = currentId ? cards[currentId] : null;
  const attempt = currentId ? queue.grades[currentId]?.length ?? 0 : 0;

  const finish = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFinishing(true);
    await chainRef.current;

    const { queue: finalQueue, cards: finalCards } = latest.current;
    const stats = queueStats(finalQueue);
    let result: CompleteResponse | null = null;
    let error: string | null = null;
    try {
      result = await withRetry(() => completeReviewSession(session.sessionId));
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't save this session";
    }

    onFinish({ result, error, stats, cards: finalCards, failedSaves: failedRef.current });
  }, [onFinish, session.sessionId]);

  const grade = useCallback(
    (value: ReviewGrade) => {
      if (!revealed || finishing || !currentId) return;
      const id = currentId;
      const local = scheduleReview(cards[id].srs, value, new Date());

      setCards((current) => ({
        ...current,
        [id]: {
          ...current[id],
          srs: { intervalDays: local.intervalDays, ease: local.ease, repetitions: local.repetitions, lapses: local.lapses },
        },
      }));
      setQueue((current) => gradeCurrent(current, value));
      setRevealed(false);
      gradedAnyRef.current = true;

      chainRef.current = chainRef.current.then(async () => {
        try {
          const saved = await withRetry(() => postGrade(session.sessionId, id, value));
          setCards((current) => ({ ...current, [id]: { ...current[id], srs: saved.srs } }));
          if (value === "again" && !saved.requeue) {
            setQueue((current) => dropCard(current, id));
          }
        } catch {
          failedRef.current += 1;
          setFailedSaves(failedRef.current);
          setQueue((current) => dropCard(current, id));
        }
      });
    },
    [cards, currentId, finishing, revealed, session.sessionId]
  );

  useEffect(() => {
    if (isQueueFinished(queue)) {
      void finish();
    }
  }, [queue, finish]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;

      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setRevealed(true);
        return;
      }

      const index = ["1", "2", "3", "4"].indexOf(event.key);
      if (revealed && index >= 0) {
        event.preventDefault();
        grade((["again", "hard", "good", "easy"] as const)[index]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [grade, revealed]);

  useEffect(() => {
    const onPageHide = () => {
      if (gradedAnyRef.current && !completedRef.current) {
        completedRef.current = true;
        beaconCompleteReviewSession(session.sessionId);
      }
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [session.sessionId]);

  const handleExit = () => {
    if (gradedAnyRef.current) {
      void finish();
    } else {
      onAbandon();
    }
  };

  const remaining = queue.order.length;

  const footer = finishing ? null : (
    <div className="mx-auto w-full max-w-2xl px-4 pb-4 pt-2 sm:px-6">
      {revealed && card ? (
        <>
          <GradeButtons srs={card.srs} onGrade={grade} />
          <p className="mt-2 text-center text-xs text-white/60 sm:hidden">Tip: swipe the card left for Again, right for Good</p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          disabled={!card}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-lg font-extrabold text-indigo-700 shadow-lg transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 active:scale-[0.98]"
        >
          Show answer
          <kbd aria-hidden className="hidden rounded bg-indigo-100 px-1.5 text-xs font-bold text-indigo-600 sm:inline">
            Space
          </kbd>
        </button>
      )}
    </div>
  );

  return (
    <LessonShell
      onExit={handleExit}
      exitLabel={gradedAnyRef.current ? "Finish session" : "Leave review"}
      progress={queueProgress(queue)}
      progressLabel="Review progress"
      topBarEnd={
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold tabular-nums text-white" aria-label={`${remaining} cards left`}>
          {remaining} left
        </span>
      }
      footer={footer}
      contentClassName="justify-center"
    >
      {finishing ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/90" role="status">
          <Loader2 aria-hidden className="h-8 w-8 animate-spin" />
          <p className="font-semibold">Saving your progress…</p>
        </div>
      ) : (
        <>
          {failedSaves > 0 && (
            <p role="alert" className="mb-3 rounded-xl bg-rose-500/20 px-3 py-2 text-center text-sm text-rose-100">
              {failedSaves === 1 ? "One grade" : `${failedSaves} grades`} couldn&apos;t be saved. Check your connection.
            </p>
          )}
          <AnimatePresence mode="wait" initial={false}>
            {card && (
              <ReviewCard
                key={`${card.id}-${attempt}`}
                card={card}
                language={session.language}
                revealed={revealed}
                onReveal={() => setRevealed(true)}
                onSwipe={(direction) => grade(direction === "left" ? "again" : "good")}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </LessonShell>
  );
}
