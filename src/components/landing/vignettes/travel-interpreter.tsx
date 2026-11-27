import { Ear, Hand } from "lucide-react";
import { cn } from "@/lib/utils";

/** The interpreter: what was heard, what it means, and replies the learner can say back. */
export function TravelInterpreter({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("select-none text-sm", className)}>
      <div className="rounded-2xl bg-white p-3.5 shadow-sm">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-700">
          <Ear className="h-3.5 w-3.5" /> They said
        </p>
        <p lang="de" className="mt-1 font-semibold text-ink-950">
          Der Zug nach Berlin fährt von Gleis vier.
        </p>
        <p className="mt-0.5 text-ink-600">The train to Berlin leaves from platform four.</p>
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-sky-800">You could say</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span lang="de" className="rounded-full bg-sky-700 px-3 py-1.5 font-semibold text-white">
          Danke schön!
        </span>
        <span lang="de" className="rounded-full bg-sky-700 px-3 py-1.5 font-semibold text-white">
          Wo ist Gleis vier?
        </span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 rounded-full bg-sky-900 py-2.5 text-xs font-bold text-white">
        <Hand className="h-4 w-4" /> Hold to talk
      </div>
    </div>
  );
}
