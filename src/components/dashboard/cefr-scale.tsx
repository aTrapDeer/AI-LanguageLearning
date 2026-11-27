import { LEVELS, type CefrBand } from "@/lib/levels";
import { cn } from "@/lib/utils";

const BANDS = Array.from(new Set(LEVELS.map((level) => level.cefr))) as CefrBand[];

/** A1 → C2 as six segments: bands behind the learner filled, theirs lit in ember. */
export function CefrScale({ current }: { current: CefrBand }) {
  const currentIndex = BANDS.indexOf(current);

  return (
    <ol className="mt-4 grid grid-cols-6 gap-1" aria-label={`CEFR scale, you are at ${current}`}>
      {BANDS.map((band, index) => {
        const isCurrent = index === currentIndex;
        const passed = index < currentIndex;
        return (
          <li key={band} aria-current={isCurrent ? "step" : undefined} className="flex flex-col gap-1.5">
            <span
              aria-hidden
              className={cn(
                "h-1.5 rounded-full",
                passed ? "bg-ink-800" : isCurrent ? "bg-gradient-to-r from-ember-300 to-ember-500" : "bg-ink-100"
              )}
            />
            <span className={cn("font-mono text-[11px] tabular-nums", isCurrent ? "font-semibold text-ember-700" : passed ? "text-ink-800" : "text-ink-500")}>
              {band}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
