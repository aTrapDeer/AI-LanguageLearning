"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export type FeedbackStatus = "correct" | "incorrect";

export interface FeedbackBannerProps {
  /** null hides the banner. */
  status: FeedbackStatus | null;
  /** Defaults to an encouraging line for the status. */
  title?: ReactNode;
  /** Explanation, tip or translation. */
  message?: ReactNode;
  /** Shown on incorrect answers as "Correct answer: …". */
  correctAnswer?: ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  /** Extra controls next to the message (e.g. a SpeakButton for the answer). */
  extra?: ReactNode;
  className?: string;
}

/** Bottom sheet that reports an answer and moves on. Focuses its button so Enter/Space continues. */
export function FeedbackBanner({
  status,
  title,
  message,
  correctAnswer,
  onContinue,
  continueLabel = "Continue",
  extra,
  className,
}: FeedbackBannerProps) {
  const reduceMotion = usePrefersReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isCorrect = status === "correct";

  useEffect(() => {
    if (status) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [status]);

  const defaultTitle = isCorrect ? "Great job!" : "Not quite";

  return (
    <AnimatePresence>
      {status && (
        <motion.div
          key={status}
          role="status"
          aria-live="polite"
          initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className={cn(
            "w-full border-t-2 px-4 pb-4 pt-4 sm:px-6",
            isCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900",
            className
          )}
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {isCorrect ? (
                <CheckCircle2 aria-hidden className="mt-0.5 h-7 w-7 shrink-0 text-emerald-500" />
              ) : (
                <XCircle aria-hidden className="mt-0.5 h-7 w-7 shrink-0 text-rose-500" />
              )}
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-bold">{title ?? defaultTitle}</p>
                {!isCorrect && correctAnswer && (
                  <p className="text-sm">
                    <span className="font-semibold">Correct answer: </span>
                    <span className="break-words">{correctAnswer}</span>
                  </p>
                )}
                {message && <div className="text-sm opacity-90">{message}</div>}
                {extra}
              </div>
            </div>
            <button
              ref={buttonRef}
              type="button"
              onClick={onContinue}
              className={cn(
                "h-12 w-full shrink-0 rounded-xl px-8 text-base font-bold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-4 sm:w-auto",
                isCorrect
                  ? "bg-emerald-500 hover:bg-emerald-600 focus-visible:ring-emerald-300"
                  : "bg-rose-500 hover:bg-rose-600 focus-visible:ring-rose-300"
              )}
            >
              {continueLabel}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
