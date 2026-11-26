"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { CurriculumUnit } from "@/lib/curriculum";
import type { LessonErrorCode } from "@/lib/lesson/api-types";

const LOADING_LINES = ["Picking words for this unit…", "Writing example sentences…", "Shuffling the exercises…", "Almost ready…"];

/** Shown while a lesson is being fetched or generated (generation can take several seconds). */
export function LessonLoading({ unit }: { unit: Pick<CurriculumUnit, "emoji" | "title"> | null }) {
  const reduceMotion = usePrefersReducedMotion();
  const [line, setLine] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setLine((value) => Math.min(value + 1, LOADING_LINES.length - 1)), 2500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" role="status" aria-live="polite">
      <motion.div
        aria-hidden
        className="text-7xl"
        animate={reduceMotion ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {unit?.emoji ?? "📘"}
      </motion.div>
      <div>
        <p className="text-2xl font-extrabold">{unit?.title ?? "Your lesson"}</p>
        <p className="mt-2 text-white/75">{LOADING_LINES[line]}</p>
      </div>
      <div className="w-full max-w-xs space-y-3" aria-hidden>
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-14 rounded-2xl bg-white/10 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}

const ERROR_COPY: Partial<Record<LessonErrorCode, { title: string; body: string; emoji: string }>> = {
  generation_unavailable: {
    emoji: "🛠️",
    title: "This lesson isn't ready yet",
    body: "We can't prepare new material for this unit right now. Try again in a little while — or practise the topic with your tutor in the meantime.",
  },
  generation_failed: {
    emoji: "🧩",
    title: "That didn't come together",
    body: "Something went wrong while preparing this lesson. Give it another try.",
  },
  ai_quota_exceeded: { emoji: "⏳", title: "That's all for today", body: "" },
  unit_locked: { emoji: "🔒", title: "This unit is locked", body: "" },
  unit_not_found: { emoji: "🧭", title: "Unit not found", body: "That unit doesn't exist. Head back to your path to pick one." },
  language_not_setup: { emoji: "🌍", title: "Add this language first", body: "Set up this language on your account to start its lessons." },
};

export function LessonError({
  code,
  message,
  language,
  unitId,
  pathHref,
  onRetry,
}: {
  code: LessonErrorCode;
  message: string;
  language: string;
  unitId: string | null;
  pathHref: string;
  onRetry: () => void;
}) {
  const copy = ERROR_COPY[code] ?? { emoji: "😕", title: "Something went wrong", body: message };
  const canRetry = code !== "unit_locked" && code !== "unit_not_found" && code !== "language_not_setup";
  const setupHref = `/account-setup?${new URLSearchParams({ mode: "add-language", lang: language, redirect: pathHref }).toString()}`;
  const chatHref = `/learn/${encodeURIComponent(language)}${unitId ? `?unit=${encodeURIComponent(unitId)}` : ""}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center" role="alert">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center text-slate-900 shadow-xl sm:p-8">
        <div aria-hidden className="text-5xl">
          {copy.emoji}
        </div>
        <h2 className="mt-3 text-2xl font-extrabold">{copy.title}</h2>
        <p className="mt-2 text-slate-600">{copy.body || message}</p>
        <div className="mt-6 flex flex-col gap-3">
          {code === "language_not_setup" ? (
            <Link href={setupHref} className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-bold text-white">
              Add language
            </Link>
          ) : canRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
            >
              Try again
            </button>
          ) : null}
          {(code === "generation_unavailable" || code === "generation_failed" || code === "ai_quota_exceeded") && (
            <Link href={chatHref} className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-slate-200 font-bold text-slate-700 hover:bg-slate-50">
              Practise with the tutor
            </Link>
          )}
          <Link href={pathHref} className="inline-flex h-12 items-center justify-center rounded-xl font-semibold text-indigo-700 hover:bg-indigo-50">
            Back to your path
          </Link>
        </div>
      </div>
    </div>
  );
}
