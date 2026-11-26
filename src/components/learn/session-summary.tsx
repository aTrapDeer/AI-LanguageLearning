"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Target, TrendingUp, Trophy, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useCountUp } from "@/hooks/use-count-up";
import { getLevelInfo } from "@/lib/levels";
import { cn } from "@/lib/utils";
import { StarRating } from "./star-rating";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export interface SessionSummaryAction {
  label: string;
  /** Provide either a link target or a click handler. */
  href?: string;
  onClick?: () => void;
}

export interface SessionSummaryProps {
  /** Defaults to "Lesson complete!". */
  title?: string;
  subtitle?: ReactNode;
  /** 0..1; omit to hide the accuracy tile. */
  accuracy?: number;
  xpGained: number;
  /** 0–3; omit to hide stars. */
  stars?: number;
  /** Current streak after this session. */
  streak?: number;
  leveledUp?: boolean;
  /** New level when `leveledUp`. */
  level?: number;
  goalJustReached?: boolean;
  dailyXp?: number;
  dailyGoal?: number;
  /** Extra tiles, e.g. [{ label: "New words", value: 8 }]. */
  stats?: Array<{ label: string; value: ReactNode }>;
  primaryAction: SessionSummaryAction;
  secondaryAction?: SessionSummaryAction;
  /** Slot below the stats (e.g. words learned, mistakes to review). */
  children?: ReactNode;
  className?: string;
}

function ActionButton({ action, variant }: { action: SessionSummaryAction; variant: "primary" | "secondary" }) {
  const classes = cn(
    "inline-flex h-12 w-full items-center justify-center rounded-xl px-6 text-base font-bold transition focus-visible:outline-none focus-visible:ring-4",
    variant === "primary"
      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:from-indigo-500 hover:to-purple-500 focus-visible:ring-indigo-300"
      : "border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-200"
  );

  return action.href ? (
    <Link href={action.href} onClick={action.onClick} className={classes}>
      {action.label}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={classes}>
      {action.label}
    </button>
  );
}

function Tile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-center", tone)}>
      <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-xl font-extrabold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

/** End-of-session card: stars, accuracy, XP count-up, streak, and level-up / goal celebrations. */
export function SessionSummary({
  title = "Lesson complete!",
  subtitle,
  accuracy,
  xpGained,
  stars,
  streak,
  leveledUp = false,
  level,
  goalJustReached = false,
  dailyXp,
  dailyGoal,
  stats = [],
  primaryAction,
  secondaryAction,
  children,
  className,
}: SessionSummaryProps) {
  const reduceMotion = usePrefersReducedMotion();
  const xp = useCountUp(Math.max(0, Math.round(xpGained)), { delayMs: 300 });
  const levelInfo = leveledUp && level ? getLevelInfo(level) : null;

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion ? { duration: 0 } : { delay, duration: 0.35 },
  });

  return (
    <section
      aria-labelledby="session-summary-title"
      className={cn("mx-auto w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-xl sm:p-8", className)}
    >
      <motion.div {...enter(0)} className="flex flex-col items-center text-center">
        <motion.div
          aria-hidden
          className="text-5xl"
          animate={reduceMotion ? undefined : { rotate: [0, -10, 10, -6, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 0.9, delay: 0.2 }}
        >
          {leveledUp ? "🏆" : stars === 3 ? "🌟" : "🎉"}
        </motion.div>
        <h2 id="session-summary-title" className="mt-2 text-2xl font-extrabold">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        {stars !== undefined && <StarRating stars={stars} size="lg" animate className="mt-3" />}
      </motion.div>

      <motion.div {...enter(0.15)} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile
          icon={<Zap aria-hidden className="h-3.5 w-3.5" />}
          label="XP"
          value={<span aria-label={`${Math.round(xpGained)} XP gained`}>+{xp}</span>}
          tone="border-amber-200 bg-amber-50 text-amber-700"
        />
        {accuracy !== undefined && (
          <Tile
            icon={<Target aria-hidden className="h-3.5 w-3.5" />}
            label="Accuracy"
            value={`${Math.round(Math.min(1, Math.max(0, accuracy)) * 100)}%`}
            tone="border-emerald-200 bg-emerald-50 text-emerald-700"
          />
        )}
        {streak !== undefined && (
          <Tile
            icon={<Flame aria-hidden className="h-3.5 w-3.5" />}
            label="Streak"
            value={`${streak} ${streak === 1 ? "day" : "days"}`}
            tone="border-orange-200 bg-orange-50 text-orange-700"
          />
        )}
        {stats.map((stat) => (
          <Tile
            key={stat.label}
            icon={<TrendingUp aria-hidden className="h-3.5 w-3.5" />}
            label={stat.label}
            value={stat.value}
            tone="border-indigo-200 bg-indigo-50 text-indigo-700"
          />
        ))}
      </motion.div>

      {(levelInfo || goalJustReached) && (
        <motion.div {...enter(0.35)} className="mt-4 space-y-2" role="status">
          {levelInfo && (
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
              <Trophy aria-hidden className="h-8 w-8 shrink-0 text-amber-300" />
              <div>
                <p className="font-bold">Level up! You reached level {levelInfo.level}</p>
                <p className="text-sm text-indigo-100">
                  {levelInfo.cefr} · {levelInfo.label}
                </p>
              </div>
            </div>
          )}
          {goalJustReached && (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <span aria-hidden className="text-2xl">
                🎯
              </span>
              <p className="font-semibold">
                Daily goal reached{dailyXp !== undefined && dailyGoal !== undefined ? ` — ${dailyXp}/${dailyGoal} XP` : ""}!
              </p>
            </div>
          )}
        </motion.div>
      )}

      {children && <div className="mt-4">{children}</div>}

      <motion.div {...enter(0.5)} className="mt-6 flex flex-col gap-3">
        <ActionButton action={primaryAction} variant="primary" />
        {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
      </motion.div>
    </section>
  );
}
