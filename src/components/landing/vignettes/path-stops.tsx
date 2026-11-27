import { Lock, Star } from "lucide-react";
import { LEVELS } from "@/lib/levels";
import { cn } from "@/lib/utils";

const BANDS = Array.from(new Set(LEVELS.map((level) => level.cefr)));

const STOPS = [
  { emoji: "👋", title: "Hello & Goodbye", state: "done" as const, offset: "-translate-x-10" },
  { emoji: "🙋", title: "Nice to Meet You", state: "done" as const, offset: "translate-x-2" },
  { emoji: "☕", title: "At the Café", state: "current" as const, offset: "translate-x-12", goal: "I can order a drink and a snack." },
  { emoji: "🎨", title: "Colours & Things", state: "locked" as const, offset: "translate-x-0" },
];

/** A slice of the lesson path: the CEFR scale on top, then stops in the path's zig-zag. */
export function PathStops({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative isolate select-none overflow-hidden rounded-[1.9rem] p-5 text-white shadow-[0_40px_80px_-36px_rgb(8_5_30/0.8)]", className)}>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,rgb(15,23,72)_0%,rgb(49,24,122)_45%,rgb(96,20,150)_100%)]" />
      <div className="grid grid-cols-6 gap-1">
        {BANDS.map((band, index) => (
          <div key={band} className={cn("rounded-lg py-1.5 text-center font-mono text-[11px] font-semibold", index === 0 ? "bg-amber-300 text-ink-950" : "bg-white/10 text-white/70")}>
            {band}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm font-bold">
        Level 1 · <span className="text-amber-300">A1</span> First Steps
      </p>
      <div className="mt-5 flex flex-col items-center gap-4">
        {STOPS.map((stop) => (
          <div key={stop.title} className={cn("flex flex-col items-center", stop.offset)}>
            {stop.state === "current" && (
              <span className="mb-1.5 rounded-lg bg-white px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-indigo-700 shadow">Start</span>
            )}
            <span
              className={cn(
                "relative flex h-14 w-14 items-center justify-center rounded-full border-b-[5px] text-2xl",
                stop.state === "done" && "border-orange-700 bg-gradient-to-br from-amber-300 to-orange-500",
                stop.state === "current" && "border-indigo-300 bg-white ring-4 ring-white/40",
                stop.state === "locked" && "border-black/30 bg-white/10"
              )}
            >
              <span className={cn(stop.state === "locked" && "opacity-40 grayscale")}>{stop.emoji}</span>
              {stop.state === "locked" && (
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700">
                  <Lock className="h-2.5 w-2.5" />
                </span>
              )}
            </span>
            {stop.state === "done" && (
              <span className="mt-1 flex gap-0.5">
                {[0, 1, 2].map((index) => (
                  <Star key={index} className="h-3 w-3 fill-amber-400 text-amber-400" />
                ))}
              </span>
            )}
            <span className={cn("mt-0.5 text-xs font-semibold", stop.state === "locked" ? "text-white/50" : "text-white/90")}>{stop.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
