"use client";

import Link from "next/link";
import { BookOpen, Map as MapIcon, RotateCcw } from "lucide-react";
import { SessionSummary, SpeakButton, type SessionSummaryAction } from "@/components/learn";
import type { CompleteLessonResponse, StartLessonResponse } from "@/lib/lesson/api-types";
import { TargetText } from "../target-text";

export interface LessonCompleteProps {
  language: string;
  lesson: StartLessonResponse;
  result: CompleteLessonResponse;
  bestCombo: number;
  showRomanization: boolean;
  pathHref: string;
  onReplay: () => void;
}

/** End-of-lesson screen: stars, XP, streak, celebrations, the words added to the deck and what's next. */
export function LessonComplete({ language, lesson, result, bestCombo, showRomanization, pathHref, onReplay }: LessonCompleteProps) {
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
          <div className="rounded-2xl border-2 border-slate-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-800">Added to your review deck</h3>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{result.words.length} words</span>
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {result.words.map((word) => (
                <li key={word.word} className="flex items-center gap-3 py-2">
                  <SpeakButton text={word.word} language={language} size="sm" />
                  <div className="min-w-0 flex-1">
                    <TargetText
                      text={word.word}
                      language={language}
                      romanization={word.romanization}
                      showRomanization={showRomanization}
                      className="font-bold text-slate-900"
                      romanizationClassName="text-xs text-slate-500"
                      as="div"
                    />
                  </div>
                  <span className="text-right text-sm text-slate-600">{word.translation}</span>
                  {word.missed && (
                    <span title="Due for review now" className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      Review
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {lesson.plan.culture && (
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Did you know?</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{lesson.plan.culture}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold">
          <Link href={`/flashcards?lang=${encodeURIComponent(language)}`} className="inline-flex items-center gap-1 text-indigo-700 hover:underline">
            <BookOpen aria-hidden className="h-4 w-4" />
            {missed > 0 ? `Review ${missed} tricky word${missed === 1 ? "" : "s"}` : "Review words"}
          </Link>
          {passed && (
            <button type="button" onClick={onReplay} className="inline-flex items-center gap-1 text-indigo-700 hover:underline">
              <RotateCcw aria-hidden className="h-4 w-4" />
              Replay unit
            </button>
          )}
          <Link href={pathHref} className="inline-flex items-center gap-1 text-slate-600 hover:underline">
            <MapIcon aria-hidden className="h-4 w-4" />
            Your path
          </Link>
        </div>
      </SessionSummary>
    </div>
  );
}
