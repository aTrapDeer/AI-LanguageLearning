"use client";

import Link from "next/link";
import { Lock, MessageCircle, Play, RotateCcw } from "lucide-react";
import { StarRating } from "@/components/learn";
import type { PathUnit } from "@/lib/lesson/api-types";
import { cn } from "@/lib/utils";

export interface UnitPanelProps {
  unit: PathUnit;
  language: string;
  learnerLevel: number;
  previousTitle: string | null;
}

/** The selected unit's goal and the single primary action for it. */
export function UnitPanel({ unit, language, learnerLevel, previousTitle }: UnitPanelProps) {
  const lessonHref = `/learn/journey?lang=${encodeURIComponent(language)}&unit=${encodeURIComponent(unit.id)}`;
  const chatHref = `/learn/${encodeURIComponent(language)}?unit=${encodeURIComponent(unit.id)}`;
  const locked = !unit.unlocked;
  const lockReason =
    unit.level > learnerLevel ? `Reach level ${unit.level} to unlock` : previousTitle ? `Finish “${previousTitle}” to unlock` : "Locked";

  const label = unit.inProgress !== null ? "Continue lesson" : unit.completed ? "Replay with a new lesson" : "Start lesson";
  const Icon = unit.completed && unit.inProgress === null ? RotateCcw : Play;

  return (
    <section aria-labelledby="unit-panel-title" className="rounded-3xl bg-white p-4 text-slate-900 shadow-2xl sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
          {unit.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h2 id="unit-panel-title" className="text-lg font-extrabold leading-tight">
              {unit.title}
            </h2>
            {unit.completed && <StarRating stars={unit.stars} size="sm" />}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{unit.goal}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {locked ? (
          <span className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-500">
            <Lock aria-hidden className="h-4 w-4" />
            {lockReason}
          </span>
        ) : (
          <Link
            href={lessonHref}
            className={cn(
              "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-base font-extrabold text-white shadow-md transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300",
              "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
            )}
          >
            <Icon aria-hidden className="h-5 w-5" />
            {label}
          </Link>
        )}
        {!locked && (
          <Link
            href={chatHref}
            aria-label={`Practise ${unit.title} in chat`}
            title="Practise in chat"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
          >
            <MessageCircle aria-hidden className="h-5 w-5" />
          </Link>
        )}
      </div>
    </section>
  );
}
