import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel } from "./panel";

/** A small fanned stack of cards; the top card carries the due count. */
function DeckStack({ count, empty }: { count: number; empty: boolean }) {
  return (
    <div aria-hidden className="relative h-[5.5rem] w-[4.5rem] shrink-0">
      <span className="absolute inset-0 translate-x-2 rotate-[9deg] rounded-xl border border-ink-900/10 bg-ink-100" />
      <span className="absolute inset-0 translate-x-1 rotate-[4deg] rounded-xl border border-ink-900/10 bg-ink-50" />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-xl border font-display text-3xl font-extrabold tabular-nums shadow-md",
          empty ? "border-dashed border-ink-200 bg-white text-ink-200" : count > 0 ? "border-ink-800 bg-ink-900 text-white" : "border-ink-900/10 bg-white text-emerald-600"
        )}
      >
        {count > 0 ? count : empty ? "?" : <Check className="h-8 w-8" strokeWidth={3} />}
      </span>
    </div>
  );
}

/** Words grouped by how well they're known, as one segmented bar. */
function DeckMaturity({ vocabulary }: { vocabulary: LearnerSummary["vocabulary"] }) {
  const known = vocabulary.young + vocabulary.mature;
  const segments = [
    { label: "New", value: vocabulary.new, className: "bg-ink-200" },
    { label: "Learning", value: vocabulary.learning, className: "bg-ink-500" },
    { label: "Known", value: known, className: "bg-emerald-500" },
  ];

  return (
    <div className="mt-5">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-ink-50" aria-hidden>
        {segments.map((segment) =>
          segment.value > 0 ? <span key={segment.label} className={segment.className} style={{ flexGrow: segment.value }} /> : null
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", segment.className)} />
            <span className="font-semibold tabular-nums text-ink-900">{segment.value}</span> {segment.label.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What's waiting: cards due for review today, and the state of the learner's deck. */
export function ReviewPanel({ summary, className }: { summary: LearnerSummary; className?: string }) {
  const dueCount = summary.review.dueCount;
  const deckSize = summary.vocabulary.total;
  const hasDue = dueCount > 0;
  const href = `/flashcards?lang=${encodeURIComponent(summary.language)}${!hasDue && deckSize > 0 ? "&tab=words" : ""}`;

  let title: string;
  let body: string;
  if (deckSize === 0) {
    title = "Your deck is empty";
    body = "Every word you learn in a lesson lands here, ready to come back right before you'd forget it.";
  } else if (hasDue) {
    title = `${dueCount} ${dueCount === 1 ? "card is" : "cards are"} ready`;
    body = "A few minutes now saves relearning later.";
  } else {
    title = "All caught up";
    body = `All ${deckSize} ${deckSize === 1 ? "word is" : "words are"} scheduled. They'll be back when it's time.`;
  }

  return (
    <Panel labelledBy="review-title" className={cn(hasDue && "bg-gradient-to-br from-ink-50 via-white to-white", className)}>
      <Eyebrow as="h2" id="review-title">
        Review
      </Eyebrow>
      <div className="mt-3 flex items-center gap-5">
        <DeckStack count={dueCount} empty={deckSize === 0} />
        <div className="min-w-0">
          <p className="font-display text-2xl font-bold leading-tight tracking-tight text-ink-950">{title}</p>
          <p className="mt-1 text-sm leading-snug text-ink-600">{body}</p>
        </div>
      </div>
      {deckSize > 0 && <DeckMaturity vocabulary={summary.vocabulary} />}
      <Link
        href={href}
        className={cn(
          "group mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-300",
          hasDue ? "bg-ink-900 text-white hover:bg-ink-800" : "border border-ink-900/15 text-ink-900 hover:bg-ink-50"
        )}
      >
        {hasDue ? `Review ${dueCount} ${dueCount === 1 ? "card" : "cards"}` : deckSize === 0 ? "How review works" : "See my words"}
        <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Panel>
  );
}
