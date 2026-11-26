"use client";

import Link from "next/link";
import { BookOpen, Loader2, MessageCircle, PartyPopper, PlusCircle, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { formatDueIn } from "@/lib/review/intervals";
import { SESSION_MAX_CARDS } from "@/lib/review/plan";
import type { ReviewStatusResponse } from "@/lib/review/types";
import { cn } from "@/lib/utils";

export interface ReviewLobbyProps {
  language: string;
  languageName: string;
  status: ReviewStatusResponse | null;
  error: string | null;
  starting: "due" | "new" | null;
  /** Message from the last start attempt (e.g. generation failed). */
  notice: string | null;
  onStart: (mode: "due" | "new") => void;
  onAddWords: () => void;
}

function PrimaryButton({ children, onClick, busy, disabled }: { children: ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 text-lg font-extrabold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-500 hover:to-purple-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 active:scale-[0.98] disabled:opacity-70"
    >
      {busy && <Loader2 aria-hidden className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}

function WaysToAdd({ language, onAddWords }: { language: string; onAddWords: () => void }) {
  const lang = encodeURIComponent(language);
  const itemClass =
    "flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-3 text-left text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50";

  return (
    <div className="grid gap-2">
      <Link href={`/learn/journey?lang=${lang}`} className={itemClass}>
        <BookOpen aria-hidden className="h-5 w-5 shrink-0 text-indigo-500" />
        <span>
          <span className="block font-bold text-slate-900">Finish a lesson</span>
          New words from every lesson land here automatically.
        </span>
      </Link>
      <Link href={`/learn/${lang}`} className={itemClass}>
        <MessageCircle aria-hidden className="h-5 w-5 shrink-0 text-purple-500" />
        <span>
          <span className="block font-bold text-slate-900">Save words from the tutor</span>
          Chat with your tutor and keep the words you want to remember.
        </span>
      </Link>
      <button type="button" onClick={onAddWords} className={itemClass}>
        <PlusCircle aria-hidden className="h-5 w-5 shrink-0 text-emerald-500" />
        <span>
          <span className="block font-bold text-slate-900">Add your own</span>
          Type in any word with its meaning.
        </span>
      </button>
    </div>
  );
}

export function ReviewLobby({ language, languageName, status, error, starting, notice, onStart, onAddWords }: ReviewLobbyProps) {
  const cardClass = "rounded-3xl bg-white p-6 shadow-xl shadow-indigo-950/10 sm:p-8";

  if (error && !status) {
    return (
      <div className={cardClass} role="alert">
        <p className="font-semibold text-slate-900">We couldn&apos;t load your review deck.</p>
        <p className="mt-1 text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={cn(cardClass, "animate-pulse")} aria-busy="true" aria-label="Loading your deck">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="mt-4 h-14 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const noticeBanner = notice ? (
    <p role="status" className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {notice}
    </p>
  ) : null;

  if (status.deckSize === 0) {
    return (
      <div className={cardClass}>
        {noticeBanner}
        <h2 className="text-2xl font-extrabold text-slate-900">Your {languageName} deck is empty — for now</h2>
        <p className="mt-2 text-slate-600">
          Review brings back each word right before you&apos;d forget it. Here&apos;s how words get into your deck:
        </p>
        <div className="mt-5">
          <WaysToAdd language={language} onAddWords={onAddWords} />
        </div>
        {status.canAddNewWords && (
          <div className="mt-5">
            <PrimaryButton onClick={() => onStart("new")} busy={starting === "new"} disabled={starting !== null}>
              <Sparkles aria-hidden className="h-5 w-5" />
              {starting === "new" ? "Writing your starter words…" : "Get 10 starter words"}
            </PrimaryButton>
          </div>
        )}
      </div>
    );
  }

  if (status.dueCount === 0) {
    const nextDue = formatDueIn(status.nextDueAt, new Date());
    return (
      <div className={cn(cardClass, "text-center")}>
        {noticeBanner}
        <PartyPopper aria-hidden className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900">All caught up!</h2>
        <p className="mt-2 text-slate-600">
          {nextDue ? `Your next cards are due ${nextDue}.` : "Nothing is due right now."} Spaced review works best on schedule, so this is
          a great moment to learn something new.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            href={`/learn/journey?lang=${encodeURIComponent(language)}`}
            className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-lg font-extrabold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-500 hover:to-purple-500"
          >
            Continue your path
          </Link>
          {status.canAddNewWords && (
            <button
              type="button"
              onClick={() => onStart("new")}
              disabled={starting !== null}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
            >
              {starting === "new" ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4 text-indigo-500" />}
              {starting === "new" ? "Writing new words…" : "Learn 10 new words"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const sessionSize = Math.min(status.dueCount, SESSION_MAX_CARDS);
  const minutes = Math.max(1, Math.round((sessionSize * 8) / 60));

  return (
    <div className={cardClass}>
      {noticeBanner}
      <p className="text-sm font-bold uppercase tracking-wide text-indigo-500">Ready to review</p>
      <h2 className="mt-1 text-3xl font-extrabold text-slate-900">
        {status.dueCount} {status.dueCount === 1 ? "card" : "cards"} due
      </h2>
      <p className="mt-2 text-slate-600">
        {status.dueCount > SESSION_MAX_CARDS ? `This session covers the ${sessionSize} most overdue. ` : ""}
        About {minutes} {minutes === 1 ? "minute" : "minutes"}. Grade honestly: missed words come back sooner, easy ones later.
      </p>
      <div className="mt-6">
        <PrimaryButton onClick={() => onStart("due")} busy={starting === "due"} disabled={starting !== null}>
          {starting === "due" ? "Shuffling your cards…" : "Start review"}
        </PrimaryButton>
      </div>
      <p className="mt-3 hidden text-center text-xs text-slate-500 sm:block">
        Keyboard: Space to reveal, 1–4 to grade
      </p>
    </div>
  );
}
