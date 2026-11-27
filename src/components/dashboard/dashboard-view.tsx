"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { LanguageSelect } from "@/components/ui/language-select";
import { useLanguage } from "@/contexts/language-context";
import { notifyLearnSummaryChanged, useLearnSummary } from "@/hooks/use-learn-summary";
import { DAILY_XP_GOAL_OPTIONS } from "@/lib/gamification";
import { CelebrationBanner } from "./celebration-banner";
import { ContinueCard } from "./continue-card";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { LevelDialog } from "./level-dialog";
import { PracticePanel } from "./practice-panel";
import { ProgressPanel } from "./progress-panel";
import { ReviewPanel } from "./review-panel";
import { SetupLanguage } from "./setup-language";
import { TodayPanel } from "./today-panel";
import { useDailyGoal } from "./use-daily-goal";

function greeting(name: string | null | undefined) {
  const hour = new Date().getHours();
  const part = hour < 5 ? "Hi" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/**
 * The learner's home. On phones it reads top to bottom in priority order (next unit, today, review,
 * progress, practice); from `lg` the same elements sit in a two-column grid — main column for the
 * journey, a rail for today's status — without changing the DOM order.
 */
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

  let subline = "Loading your progress…";
  if (summary && isNewLearner) subline = `Your ${summary.languageName} path starts with one short lesson. We'll take it from there.`;
  else if (summary) subline = `${summary.totalXp.toLocaleString("en")} XP in ${summary.languageName} · ${summary.cefr} ${summary.levelLabel}`;

  return (
    <div className="min-h-[100dvh] bg-paper pb-16 pt-[4.25rem] md:pt-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="-ml-2.5 mb-1 flex items-center gap-1 lg:hidden">
          <span className="pl-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">Learning</span>
          <LanguageSelect showName="always" className="h-11 px-2" />
        </div>
        <h1 className="text-balance font-display text-[2rem] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink-950 [font-stretch:94%] sm:text-[2.6rem]">
          {isNewLearner ? "Welcome to Laingfy" : greetingText}
        </h1>
        <p className="mt-1.5 min-h-[1.25rem] text-sm text-ink-600 sm:text-[15px]">{subline}</p>

        {error && !summary && (
          <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            We couldn&apos;t load your progress.{" "}
            <button type="button" onClick={() => void refresh()} className="font-bold underline underline-offset-2">
              Try again
            </button>
          </div>
        )}

        {!summary ? (
          !error && <DashboardSkeleton />
        ) : !summary.hasProgress ? (
          <SetupLanguage language={summary.language} languageName={summary.languageName} />
        ) : (
          <>
            <CelebrationBanner summary={summary} />
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_368px] lg:gap-5">
              <ContinueCard
                summary={summary}
                isNewLearner={isNewLearner}
                onChangeLevel={() => setLevelOpen(true)}
                className="lg:col-start-1 lg:row-start-1"
              />
              <TodayPanel
                summary={summary}
                options={goal.data?.options ?? [...DAILY_XP_GOAL_OPTIONS]}
                saving={goal.saving}
                onSetGoal={goal.setGoal}
                className="lg:col-start-2 lg:row-start-1"
              />
              <ReviewPanel summary={summary} className="lg:col-start-2 lg:row-start-2" />
              <ProgressPanel
                summary={summary}
                history={goal.data?.history ?? null}
                onChangeLevel={() => setLevelOpen(true)}
                className="lg:col-start-1 lg:row-span-2 lg:row-start-2"
              />
              <PracticePanel language={summary.language} className="lg:col-start-2 lg:row-start-3" />
            </div>

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
