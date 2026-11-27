import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const BARS = [0.35, 0.7, 0.5, 0.95, 0.6, 0.85, 0.4, 0.75, 0.55, 0.9, 0.45, 0.65];

/** Live voice: a pulsing mic, a moving waveform and the last two lines of the conversation. */
export function VoiceLive({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("select-none", className)}>
      <div className="flex items-center gap-3">
        <span className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-ink-950/25 motion-safe:animate-soft-ping" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-ink-950 text-ember-300">
            <Mic className="h-5 w-5" />
          </span>
        </span>
        <div className="flex h-10 flex-1 items-center gap-[3px]">
          {BARS.map((height, index) => (
            <span
              key={index}
              className="w-full rounded-full bg-ink-950/70 motion-safe:animate-wave"
              style={{ height: `${height * 100}%`, animationDelay: `${index * 90}ms` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-1.5 text-sm">
        <p className="rounded-xl bg-white/45 px-3 py-2 text-ink-950">
          <span lang="de" className="font-semibold">
            Ich hätte gern einen Tisch für zwei.
          </span>
        </p>
        <p className="rounded-xl bg-ink-950/85 px-3 py-2 text-white">
          <span lang="de">Gern! Drinnen oder draußen?</span>
        </p>
      </div>
    </div>
  );
}
