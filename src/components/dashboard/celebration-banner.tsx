"use client";

import { motion } from "framer-motion";
import { Flame, Target } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { streakMilestone } from "@/lib/review/scoring";

const SPARKS = Array.from({ length: 10 }, (_, index) => {
  const angle = (index / 10) * Math.PI * 2;
  return { x: Math.cos(angle) * 34, y: Math.sin(angle) * 34, delay: 0.35 + (index % 3) * 0.04 };
});

/** A short, positive note when today hit a streak milestone or the daily goal. Never a guilt trip. */
export function CelebrationBanner({ summary }: { summary: LearnerSummary }) {
  const reduceMotion = usePrefersReducedMotion();
  const milestone = summary.streak.todayDone ? streakMilestone(summary.streak.current) : null;

  let Icon = Target;
  let title: string;
  let text: string;
  if (milestone) {
    Icon = Flame;
    title = `${milestone}-day streak!`;
    text = `You've practised ${milestone} days in a row.`;
  } else if (summary.today.goalReached) {
    title = "Daily goal done";
    text = `${summary.today.xp} XP today. Anything more is a bonus.`;
  } else {
    return null;
  }

  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative mt-5 flex items-center gap-4 overflow-hidden rounded-[1.4rem] border border-ember-200 bg-gradient-to-r from-ember-50 via-ember-50 to-white px-4 py-3 text-ink-950 sm:px-5"
    >
      <span aria-hidden className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        {!reduceMotion &&
          SPARKS.map((spark, index) => (
            <motion.span
              key={index}
              className="absolute h-1.5 w-1.5 rounded-full bg-ember-400"
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
              animate={{ x: spark.x, y: spark.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
              transition={{ duration: 0.9, delay: spark.delay, ease: "easeOut" }}
            />
          ))}
        <motion.span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-ember-300 to-ember-500 text-ink-950 shadow-[0_6px_16px_-6px_rgb(221_98_8/0.8)]"
          initial={reduceMotion ? false : { scale: 0.6, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.25 }}
        >
          <Icon className={milestone ? "h-5 w-5 fill-white text-white" : "h-5 w-5"} strokeWidth={2.5} />
        </motion.span>
      </span>
      <p className="min-w-0 text-[15px] leading-snug">
        <span className="font-display text-lg font-extrabold">{title}</span> <span className="text-ink-600">{text}</span>
      </p>
    </motion.div>
  );
}
