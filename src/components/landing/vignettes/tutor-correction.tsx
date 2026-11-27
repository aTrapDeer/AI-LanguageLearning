import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

/** The tutor's correction card, as it appears under a learner's message in the chat. */
export function TutorCorrection({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950 shadow-lg", className)}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
        <Lightbulb className="h-3.5 w-3.5" /> A small fix
      </p>
      <p className="leading-snug">
        <span className="text-amber-800">You wrote </span>
        <span lang="de" className="rounded bg-rose-100 px-1 text-rose-800 line-through decoration-rose-400">
          in die Kino
        </span>
        <span className="mx-1 text-amber-700">→</span>
        <span lang="de" className="rounded bg-emerald-100 px-1 font-semibold text-emerald-800">
          ins Kino
        </span>
      </p>
      <p className="mt-0.5 text-[13px] leading-snug text-amber-900/80">Kino is neuter, so in + das becomes ins.</p>
    </div>
  );
}
