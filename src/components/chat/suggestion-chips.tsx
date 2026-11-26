import type { TutorSuggestion } from "@/lib/tutor/schema";

interface SuggestionChipsProps {
  suggestions: TutorSuggestion[];
  rtl: boolean;
  onPick: (text: string) => void;
}

/**
 * Ideas for what to say next, always with their meaning (the beginner's lifeline). Tapping one fills
 * the input so the learner can adapt it before sending.
 */
export function SuggestionChips({ suggestions, rtl, onPick }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" aria-label="Suggested replies">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.text}
          type="button"
          onClick={() => onPick(suggestion.text)}
          title={suggestion.translation}
          className="flex max-w-[78%] shrink-0 flex-col items-start rounded-2xl border border-white/20 bg-white/10 px-3 py-1.5 text-left text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:max-w-[45%]"
        >
          <span dir={rtl ? "rtl" : undefined} className="w-full truncate text-sm font-semibold">
            {suggestion.text}
          </span>
          <span className="w-full truncate text-[11px] text-indigo-100/80">
            {[suggestion.romanization, suggestion.translation].filter(Boolean).join(" · ")}
          </span>
        </button>
      ))}
    </div>
  );
}
