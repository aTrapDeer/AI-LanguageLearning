"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { LanguageSelect } from "@/components/ui/language-select";
import { useLanguage } from "@/contexts/language-context";
import { notifyLearnSummaryChanged, useLearnSummary } from "@/hooks/use-learn-summary";
import { DAILY_XP_GOAL_OPTIONS } from "@/lib/gamification";
import { CelebrationBanner } from "./celebration-banner";
import { ContinueCard } from "./continue-card";
import { LevelDialog } from "./level-dialog";
import { PracticeModes } from "./practice-modes";
import { GoalCard, ReviewDueCard, StreakCard } from "./stat-cards";
import { UnitsStrip } from "./units-strip";
import { useDailyGoal } from "./use-daily-goal";
import { WeekStrip } from "./week-strip";

function greeting(name: string | null | undefined) {
  const hour = new Date().getHours();
  const part = hour < 5 ? "Hi" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading your dashboard">
      <div className="h-72 animate-pulse rounded-3xl bg-indigo-200/60" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200/70" />
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200/70" />
        <div className="col-span-2 h-36 animate-pulse rounded-3xl bg-slate-200/70 lg:col-span-1" />
      </div>
    </div>
  );
}

export function DashboardView() {
  const { data: session } = useSession();
  const { selectedLanguage } = useLanguage();
  const language = selectedLanguage?.code ?? null;
  const { summary, error, refresh } = useLearnSummary(language, { enabled: Boolean(language), refreshOnFocus: true });
  const goal = useDailyGoal();
  const [levelOpen, setLevelOpen] = useState(false);
  const [greetingText, setGreetingText] = useState("Welcome back");
  const name = session?.user?.name;

  // Computed after mount so the server and first client render agree.
  useEffect(() => setGreetingText(greeting(name)), [name]);

  const isNewLearner = Boolean(summary && summary.totalXp === 0 && summary.levelProgress.completed === 0 && summary.streak.longest === 0);

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-12 pt-20 md:pt-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{isNewLearner ? "Welcome to Laingfy!" : greetingText}</h1>
            <p className="text-sm text-slate-600">
              {isNewLearner
                ? "Your path starts with one short lesson. We'll take it from there."
                : summary
                  ? `${summary.totalXp.toLocaleString()} XP in ${summary.languageName}`
                  : "Loading your progress…"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white lg:hidden">
            <LanguageSelect />
          </div>
        </div>

        {error && !summary && (
          <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
            We couldn&apos;t load your progress. <button type="button" onClick={() => void refresh()} className="font-bold underline">Try again</button>
          </div>
        )}

        {!summary ? (
          !error && <DashboardSkeleton />
        ) : !summary.hasProgress ? (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900">Set up {summary.languageName}</h2>
            <p className="mt-2 text-slate-600">Tell us roughly where you are and we&apos;ll start you at the right level.</p>
            <Link
              href={`/account-setup?mode=add-language&lang=${encodeURIComponent(summary.language)}&redirect=/dashboard`}
              className="mt-4 inline-flex h-12 items-center justify-center rounded-2xl bg-indigo-600 px-6 font-bold text-white hover:bg-indigo-500"
            >
              Start {summary.languageName}
            </Link>
          </section>
        ) : (
          <>
            <CelebrationBanner summary={summary} />
            <ContinueCard summary={summary} isNewLearner={isNewLearner} onChangeLevel={() => setLevelOpen(true)} />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StreakCard streak={summary.streak} />
              <GoalCard
                today={summary.today}
                options={goal.data?.options ?? [...DAILY_XP_GOAL_OPTIONS]}
                saving={goal.saving}
                onSetGoal={goal.setGoal}
              />
              <div className="col-span-2 lg:col-span-1">
                <ReviewDueCard language={summary.language} dueCount={summary.review.dueCount} deckSize={summary.vocabulary.total} />
              </div>
            </div>

            <UnitsStrip summary={summary} />
            <WeekStrip history={goal.data?.history ?? null} goal={summary.today.goal} />
            <PracticeModes language={summary.language} />

            <LevelDialog
              open={levelOpen}
              onOpenChange={setLevelOpen}
              language={summary.language}
              languageName={summary.languageName}
              currentLevel={summary.level}
              onChanged={notifyLearnSummaryChanged}
            />
          </>
        )}
      </div>
    </div>
  );
}
