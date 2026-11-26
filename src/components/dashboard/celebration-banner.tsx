"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { streakMilestone } from "@/lib/review/scoring";

/** A short, positive note when today hit a streak milestone or the daily goal. Never a guilt trip. */
export function CelebrationBanner({ summary }: { summary: LearnerSummary }) {
  const reduceMotion = usePrefersReducedMotion();
  const milestone = summary.streak.todayDone ? streakMilestone(summary.streak.current) : null;

  let emoji: string;
  let text: string;
  if (milestone) {
    emoji = "🔥";
    text = `${milestone}-day streak! You've practised ${milestone} days in a row.`;
  } else if (summary.today.goalReached) {
    emoji = "🎯";
    text = `Daily goal done: ${summary.today.xp} XP today. Anything more is a bonus.`;
  } else {
    return null;
  }

  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 px-4 py-3 font-bold text-white shadow-md"
    >
      <motion.span
        aria-hidden
        className="text-2xl"
        animate={reduceMotion ? undefined : { rotate: [0, -12, 12, -6, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 0.9, delay: 0.3 }}
      >
        {emoji}
      </motion.span>
      <span>{text}</span>
    </motion.div>
  );
}
