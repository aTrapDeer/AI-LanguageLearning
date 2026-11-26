import { BookmarkCheck, BookmarkPlus, Loader2 } from "lucide-react";
import type { TutorVocabulary } from "@/lib/tutor/schema";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface VocabChipProps {
  item: TutorVocabulary;
  state: SaveState;
  rtl: boolean;
  onSave: () => void;
}

/** A word from the tutor's reply; tap to add it to the review deck. */
export function VocabChip({ item, state, rtl, onSave }: VocabChipProps) {
  const saved = state === "saved";
  const label = saved ? `${item.word} is in your review deck` : `Save ${item.word} (${item.translation}) to your review deck`;

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saved || state === "saving"}
      aria-label={label}
      title={saved ? "Saved to your review deck" : "Save to your review deck"}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
        saved
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : state === "error"
            ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
            : "border-indigo-100 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
      )}
    >
      {state === "saving" ? (
        <Loader2 aria-hidden className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : saved ? (
        <BookmarkCheck aria-hidden className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <BookmarkPlus aria-hidden className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 truncate">
        <span dir={rtl ? "rtl" : undefined} className="font-semibold">
          {item.word}
        </span>
        {item.romanization && <span className="text-[11px] opacity-70"> {item.romanization}</span>}
        <span className="opacity-70"> · {item.translation}</span>
      </span>
      {saved && <span className="sr-only">Saved</span>}
    </button>
  );
}
