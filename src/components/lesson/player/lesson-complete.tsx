"use client";

import Link from "next/link";
import { BookOpen, Map as MapIcon, RotateCcw } from "lucide-react";
import { SessionSummary, type SessionSummaryAction } from "@/components/learn";
import type { CompleteLessonResponse, StartLessonResponse } from "@/lib/lesson/api-types";
import { cn } from "@/lib/utils";
import { TargetText } from "../target-text";

export interface LessonCompleteProps {
  language: string;
  lesson: StartLessonResponse;
  result: CompleteLessonResponse;
  bestCombo: number;
  pathHref: string;
  onReplay: () => void;
}

/** End-of-lesson screen: stars, XP, streak, celebrations, the words added to the deck and what's next. */
export function LessonComplete({ language, lesson, result, bestCombo, pathHref, onReplay }: LessonCompleteProps) {
  const activity = result.activity;
  const passed = result.stars >= 1;
  const unitHref = (unitId: string) => `/learn/journey?lang=${encodeURIComponent(language)}&unit=${encodeURIComponent(unitId)}`;
  const chatHref = `/learn/${encodeURIComponent(language)}?unit=${encodeURIComponent(lesson.unit.id)}`;
  const missed = result.words.filter((word) => word.missed).length;

  const primary: SessionSummaryAction = !passed
    ? { label: "Try again", onClick: onReplay }
    : result.nextUnit && result.nextUnit.id !== lesson.unit.id
      ? { label: `Next: ${result.nextUnit.emoji} ${result.nextUnit.title}`, href: unitHref(result.nextUnit.id) }
      : { label: "Back to your path", href: pathHref };

  const title = !passed ? "Good effort!" : result.stars === 3 ? "Perfect lesson!" : "Lesson complete!";
  const subtitle = !passed
    ? `${result.correctCount} of ${result.totalCount} right first time — get half right to pass this unit.`
    : result.alreadyCompleted
      ? "You already finished this lesson."
      : `${lesson.unit.emoji} ${lesson.unit.title} · ${result.correctCount}/${result.totalCount} right first time`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-2">
      <SessionSummary
        title={title}
        subtitle={subtitle}
        stars={result.stars}
        accuracy={result.accuracy}
        xpGained={result.xpAwarded}
        streak={activity?.streak.current}
        leveledUp={activity?.leveledUp}
        level={activity?.level}
        goalJustReached={activity?.goalJustReached}
        dailyXp={activity?.dailyXp}
        dailyGoal={activity?.dailyGoal}
        stats={bestCombo >= 3 ? [{ label: "Best combo", value: `🔥 ${bestCombo}` }] : []}
        primaryAction={primary}
        secondaryAction={{ label: "Practise in chat", href: chatHref }}
      >
        {result.words.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-slate-700">
              {result.words.length} words added to your review deck
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {result.words.map((word) => (
                <li
                  key={word.word}
                  title={word.missed ? `${word.translation} — due for review now` : word.translation}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                    word.missed ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"
                  )}
                >
                  <TargetText text={word.word} language={language} showRomanization={false} className="font-bold text-slate-900" />
                  <span className="text-slate-500">{word.translation}</span>
                </li>
              ))}
            </ul>
            {missed > 0 && <p className="mt-2 text-xs text-amber-700">Highlighted words come up for review first.</p>}
          </div>
        )}
      </SessionSummary>

      <div className="mt-4 w-full max-w-md space-y-4">
        {lesson.plan.culture && (
          <div className="rounded-3xl bg-white/10 p-4 text-left backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Did you know?</p>
            <p className="mt-1 text-sm leading-relaxed text-white/90">{lesson.plan.culture}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-2 text-sm font-semibold text-white/90">
          <Link href={`/flashcards?lang=${encodeURIComponent(language)}`} className="inline-flex items-center gap-1 hover:underline">
            <BookOpen aria-hidden className="h-4 w-4" />
            {missed > 0 ? `Review ${missed} tricky word${missed === 1 ? "" : "s"}` : "Review words"}
          </Link>
          {passed && (
            <button type="button" onClick={onReplay} className="inline-flex items-center gap-1 hover:underline">
              <RotateCcw aria-hidden className="h-4 w-4" />
              Replay unit
            </button>
          )}
          <Link href={pathHref} className="inline-flex items-center gap-1 hover:underline">
            <MapIcon aria-hidden className="h-4 w-4" />
            Your path
          </Link>
        </div>
      </div>
    </div>
  );
}
