import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonFrame, PromptBadge } from "./lesson-frame";

/** A stand-in for a word's picture: a small drawn coffee cup, in the square the real picture fills. */
function CupPicture() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200">
      <path d="M38 22c-3 4 3 7 0 11M50 20c-3 4 3 7 0 11M62 22c-3 4 3 7 0 11" fill="none" stroke="#b45309" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <path d="M24 42h46v14a20 20 0 0 1-20 20h-6a20 20 0 0 1-20-20z" fill="#fff" stroke="#7c2d12" strokeWidth="3" />
      <path d="M70 48h4a8 8 0 0 1 0 16h-5" fill="none" stroke="#7c2d12" strokeWidth="3" />
      <ellipse cx="47" cy="44" rx="20" ry="3.5" fill="#92400e" />
      <path d="M18 80h60" stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** The "learn this word" card that opens every new word: picture, sound, meaning and an example. */
export function WordIntro({ className }: { className?: string }) {
  return (
    <LessonFrame progress={0.15} className={className}>
      <div className="flex items-center gap-2">
        <PromptBadge tone="new" />
        <p className="text-lg font-extrabold">Learn this word</p>
      </div>
      <div className="mt-4 rounded-3xl bg-white p-5 text-center text-slate-900">
        <div className="flex justify-center">
          <CupPicture />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2.5">
          <p lang="de" className="text-3xl font-extrabold text-indigo-700">
            der Kaffee
          </p>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Volume2 className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-xl font-bold">coffee</p>
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-left text-sm">
          <p lang="de" className="font-medium text-slate-800">
            Einen Kaffee, bitte.
          </p>
          <p className="text-xs text-slate-500">A coffee, please.</p>
        </div>
      </div>
    </LessonFrame>
  );
}

export const EXERCISE_KINDS = ["Choose", "Match", "Listen", "Fill the gap", "Build the sentence", "Type it"];

export function ExerciseKinds({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Exercise types">
      {EXERCISE_KINDS.map((kind) => (
        <li key={kind} className="rounded-full border border-ink-900/10 bg-white px-3 py-1 text-xs font-semibold text-ink-700">
          {kind}
        </li>
      ))}
    </ul>
  );
}
