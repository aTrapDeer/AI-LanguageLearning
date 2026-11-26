"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { ROLE_PLAY_SCENARIOS, getTutorScenario, type TutorScenarioId } from "@/lib/tutor/scenarios";
import type { TutorUnitDto } from "@/lib/tutor/types";
import { cn } from "@/lib/utils";

interface ScenarioPickerProps {
  languageName: string;
  levelLabel: string;
  currentUnit: TutorUnitDto | null;
  starting: TutorScenarioId | null;
  onPick: (scenarioId: TutorScenarioId) => void;
  /** Shown when there is a conversation to go back to. */
  onBack?: () => void;
}

function ScenarioCard({
  emoji,
  title,
  description,
  busy,
  disabled,
  featured = false,
  onClick,
}: {
  emoji: string;
  title: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className={cn(
        "group flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait",
        featured
          ? "bg-gradient-to-br from-amber-300 to-orange-400 text-slate-900 shadow-lg hover:brightness-105 focus-visible:ring-amber-200"
          : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15 focus-visible:ring-white/50",
        disabled && !busy && "opacity-60"
      )}
    >
      <span aria-hidden className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl", featured ? "bg-white/40" : "bg-white/10")}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : emoji}
      </span>
      <span className="min-w-0">
        <span className="block font-bold leading-tight">{title}</span>
        <span className={cn("mt-0.5 block text-sm leading-snug", featured ? "text-slate-800" : "text-indigo-100/80")}>{description}</span>
      </span>
    </button>
  );
}

/** How a conversation starts: unit practice, free chat, or a role-play the tutor opens in character. */
export function ScenarioPicker({ languageName, levelLabel, currentUnit, starting, onPick, onBack }: ScenarioPickerProps) {
  const busy = starting !== null;
  const free = getTutorScenario("free");

  return (
    <section aria-labelledby="scenario-title" className="flex flex-col gap-5 pb-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-indigo-100 hover:bg-white/10"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back to conversation
        </button>
      )}

      <header>
        <h1 id="scenario-title" className="text-2xl font-extrabold tracking-tight">
          Chat with your {languageName} tutor
        </h1>
        <p className="mt-1 text-sm text-indigo-100/80">
          Pitched at <span className="font-semibold text-white">{levelLabel}</span>. Pick how to start.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {currentUnit && (
          <ScenarioCard
            featured
            emoji={currentUnit.emoji}
            title={`Practise “${currentUnit.title}”`}
            description={currentUnit.goal}
            busy={starting === "unit"}
            disabled={busy}
            onClick={() => onPick("unit")}
          />
        )}
        <ScenarioCard
          emoji={free.emoji}
          title={free.title}
          description={free.description}
          busy={starting === "free"}
          disabled={busy}
          onClick={() => onPick("free")}
        />
      </div>

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-100/70">Role-plays</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLE_PLAY_SCENARIOS.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              emoji={scenario.emoji}
              title={scenario.title}
              description={scenario.description}
              busy={starting === scenario.id}
              disabled={busy}
              onClick={() => onPick(scenario.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
