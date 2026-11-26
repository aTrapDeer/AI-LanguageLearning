"use client";

import { Layers, ListChecks } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BrandBackground } from "@/components/learn";
import { notifyLearnSummaryChanged } from "@/hooks/use-learn-summary";
import { getLanguageConfig } from "@/lib/language-config";
import type { ReviewSessionData, ReviewStatusResponse } from "@/lib/review/types";
import { cn } from "@/lib/utils";
import { fetchReviewStatus, startReviewSession } from "./api";
import { MyWords } from "./my-words";
import { ReviewLobby } from "./review-lobby";
import { ReviewSession, type SessionOutcome } from "./review-session";
import { ReviewSummary } from "./review-summary";

export type ReviewTab = "review" | "words";

export interface ReviewExperienceProps {
  language: string;
  initialTab?: ReviewTab;
}

type Phase =
  | { kind: "lobby" }
  | { kind: "session"; session: ReviewSessionData }
  | { kind: "summary"; outcome: SessionOutcome };

export function ReviewExperience({ language, initialTab = "review" }: ReviewExperienceProps) {
  const config = getLanguageConfig(language);
  const languageName = config?.name ?? language;
  const [tab, setTab] = useState<ReviewTab>(initialTab);
  const [phase, setPhase] = useState<Phase>({ kind: "lobby" });
  const [status, setStatus] = useState<ReviewStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [starting, setStarting] = useState<"due" | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingFromEmpty, setAddingFromEmpty] = useState(false);

  const loadStatus = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await fetchReviewStatus(language, signal);
        setStatus(next);
        setStatusError(null);
      } catch (caught) {
        if (!signal?.aborted) {
          setStatusError(caught instanceof Error ? caught.message : "Couldn't load your deck");
        }
      }
    },
    [language]
  );

  useEffect(() => {
    const controller = new AbortController();
    setStatus(null);
    setPhase({ kind: "lobby" });
    void loadStatus(controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  const start = useCallback(
    async (mode: "due" | "new") => {
      setStarting(mode);
      setNotice(null);
      try {
        const response = await startReviewSession(language, mode);
        if (response.status === "ready") {
          setPhase({ kind: "session", session: response.session });
          if (response.session.newWordsAdded > 0) notifyLearnSummaryChanged();
        } else {
          setNotice(
            response.status === "empty"
              ? response.message ?? "There are no words to review yet."
              : "Nothing is due right now. Nice work!"
          );
          setPhase({ kind: "lobby" });
          await loadStatus();
        }
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : "Couldn't start a review session");
        setPhase({ kind: "lobby" });
      } finally {
        setStarting(null);
      }
    },
    [language, loadStatus]
  );

  const handleFinish = useCallback((outcome: SessionOutcome) => {
    setPhase({ kind: "summary", outcome });
    notifyLearnSummaryChanged();
  }, []);

  const backToLobby = useCallback(() => {
    setPhase({ kind: "lobby" });
    void loadStatus();
  }, [loadStatus]);

  if (phase.kind === "session") {
    return <ReviewSession session={phase.session} onFinish={handleFinish} onAbandon={backToLobby} />;
  }

  if (phase.kind === "summary") {
    return <ReviewSummary outcome={phase.outcome} language={language} onReviewMore={() => void start("due")} />;
  }

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition",
      active ? "bg-white text-indigo-700 shadow" : "text-white/80 hover:bg-white/10 hover:text-white"
    );

  return (
    <div className="relative isolate min-h-[100dvh] pb-10 pt-20 md:pt-24">
      <BrandBackground className="-z-10 fixed" />
      <div className="mx-auto w-full max-w-xl px-4">
        <div className="mb-4 flex items-center gap-3 text-white">
          <span aria-hidden className="text-3xl">
            {config?.flag}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">{languageName} review</h1>
            <p className="text-sm text-white/70">Spaced repetition: each word returns right before you&apos;d forget it.</p>
          </div>
        </div>

        <div role="tablist" aria-label="Review sections" className="mb-4 flex gap-1 rounded-2xl bg-white/10 p-1">
          <button type="button" role="tab" aria-selected={tab === "review"} onClick={() => setTab("review")} className={tabClass(tab === "review")}>
            <Layers aria-hidden className="h-4 w-4" />
            Review
            {status && status.dueCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 text-xs font-extrabold text-white tabular-nums">{status.dueCount}</span>
            )}
          </button>
          <button type="button" role="tab" aria-selected={tab === "words"} onClick={() => setTab("words")} className={tabClass(tab === "words")}>
            <ListChecks aria-hidden className="h-4 w-4" />
            My words
          </button>
        </div>

        {tab === "review" ? (
          <ReviewLobby
            language={language}
            languageName={languageName}
            status={status}
            error={statusError}
            starting={starting}
            notice={notice}
            onStart={(mode) => void start(mode)}
            onAddWords={() => {
              setAddingFromEmpty(true);
              setTab("words");
            }}
          />
        ) : (
          <MyWords language={language} startAdding={addingFromEmpty} onDeckChanged={() => void loadStatus()} />
        )}
      </div>
    </div>
  );
}
