import { Lightbulb, Sparkles } from "lucide-react";
import type { TutorCorrection } from "@/lib/tutor/schema";

interface FeedbackCardProps {
  corrections: TutorCorrection[];
  praise: string | null;
  rtl: boolean;
}

/** Gentle feedback on the learner's last message: corrections, or praise when it was right. */
export function FeedbackCard({ corrections, praise, rtl }: FeedbackCardProps) {
  if (corrections.length > 0) {
    return (
      <div className="ml-auto w-full max-w-[88%] rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950 shadow-sm sm:max-w-[75%]">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
          <Lightbulb aria-hidden className="h-3.5 w-3.5" />
          {corrections.length === 1 ? "A small fix" : "Small fixes"}
        </p>
        <ul className="space-y-2">
          {corrections.map((correction, index) => (
            <li key={`${correction.original}-${index}`} className="leading-snug">
              <span className="text-amber-800">You wrote </span>
              <span dir={rtl ? "rtl" : undefined} className="rounded bg-rose-100 px-1 text-rose-800 line-through decoration-rose-400">
                {correction.original}
              </span>
              <span aria-hidden className="mx-1 text-amber-700">
                →
              </span>
              <span className="sr-only"> should be </span>
              <span dir={rtl ? "rtl" : undefined} className="rounded bg-emerald-100 px-1 font-semibold text-emerald-800">
                {correction.corrected}
              </span>
              <span className="mt-0.5 block text-[13px] text-amber-900/80">{correction.explanation}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (praise) {
    return (
      <div className="ml-auto inline-flex max-w-[88%] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
        <Sparkles aria-hidden className="h-3.5 w-3.5 text-emerald-500" />
        {praise}
      </div>
    );
  }

  return null;
}
