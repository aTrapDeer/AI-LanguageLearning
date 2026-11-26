"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { SpeakButton } from "@/components/learn";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { getLanguageConfig } from "@/lib/language-config";
import type { ReviewCardData } from "@/lib/review/types";
import { cn } from "@/lib/utils";

/** Horizontal drag distance that counts as a swipe grade. */
const SWIPE_THRESHOLD = 110;

export interface ReviewCardProps {
  card: ReviewCardData;
  language: string;
  revealed: boolean;
  onReveal: () => void;
  /** Swipe left = again, right = good (only once revealed). */
  onSwipe?: (direction: "left" | "right") => void;
}

function TargetText({ text, language, className }: { text: string; language: string; className?: string }) {
  const config = getLanguageConfig(language);
  return (
    <span lang={config?.speechLocale ?? language} dir={config?.rtl ? "rtl" : "ltr"} className={cn("break-words", className)}>
      {text}
    </span>
  );
}

export function ReviewCard({ card, language, revealed, onReveal, onSwipe }: ReviewCardProps) {
  const reduceMotion = usePrefersReducedMotion();
  const config = getLanguageConfig(language);
  const languageName = config?.name ?? "the language";
  const recognize = card.direction === "recognize";
  const isNew = card.maturity === "new";

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (!revealed || !onSwipe) return;
    if (info.offset.x <= -SWIPE_THRESHOLD) onSwipe("left");
    else if (info.offset.x >= SWIPE_THRESHOLD) onSwipe("right");
  };

  const romanization = card.romanization ? (
    <p className="mt-1 text-base font-medium text-slate-500" aria-label={`${config?.romanizationName ?? "Reading"}: ${card.romanization}`}>
      {card.romanization}
    </p>
  ) : null;

  return (
    <motion.article
      key={card.id}
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -40 }}
      transition={{ duration: reduceMotion ? 0 : 0.25 }}
      drag={revealed && onSwipe && !reduceMotion ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileDrag={{ rotate: 0 }}
      className="relative w-full touch-pan-y select-none rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl shadow-indigo-950/40 sm:p-8"
    >
      <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide">
        <span className="text-indigo-500">{recognize ? "What does this mean?" : `Say it in ${languageName}`}</span>
        {isNew && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">New word</span>}
      </div>

      <button
        type="button"
        onClick={revealed ? undefined : onReveal}
        disabled={revealed}
        aria-label={revealed ? undefined : "Show answer"}
        className="mt-6 flex w-full flex-col items-center gap-3 rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-default"
      >
        {recognize ? (
          <TargetText text={card.word} language={language} className="text-4xl font-extrabold leading-tight sm:text-5xl" />
        ) : (
          <span className="break-words text-3xl font-extrabold leading-tight sm:text-4xl">{card.translation}</span>
        )}
      </button>
      {recognize && (
        <div className="mt-3 flex justify-center">
          <SpeakButton text={card.word} language={language} surface="light" />
        </div>
      )}

      <AnimatePresence initial={false}>
        {revealed ? (
          <motion.div
            key="back"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="overflow-hidden"
          >
            <div className="mx-auto my-5 h-px w-16 bg-slate-200" />
            {recognize ? (
              <>
                {romanization}
                <p className="mt-2 break-words text-2xl font-bold text-slate-800">{card.translation}</p>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-3">
                  <TargetText text={card.word} language={language} className="text-3xl font-extrabold sm:text-4xl" />
                  <SpeakButton text={card.word} language={language} surface="light" />
                </div>
                {romanization}
              </div>
            )}

            {card.exampleSentence && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left">
                <div className="flex items-start gap-2">
                  <TargetText text={card.exampleSentence} language={language} className="flex-1 text-base font-medium text-slate-800" />
                  <SpeakButton text={card.exampleSentence} language={language} surface="light" size="sm" />
                </div>
                {card.exampleTranslation && <p className="mt-1 text-sm text-slate-500">{card.exampleTranslation}</p>}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.p key="hint" exit={{ opacity: 0 }} className="mt-6 text-sm text-slate-400">
            Say the answer in your head, then reveal it.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
