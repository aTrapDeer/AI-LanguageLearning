import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The lesson screen's chrome in miniature — gradient, exit button, progress bar — so vignettes look like
 * the real lesson player rather than an illustration of one. Decorative: hidden from assistive tech.
 */
export function LessonFrame({ progress, children, footer, className }: { progress: number; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative isolate flex select-none flex-col overflow-hidden rounded-[1.9rem] border border-white/10 text-white shadow-[0_40px_80px_-30px_rgb(8_5_30/0.85)]",
        className
      )}
    >
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,rgb(15,23,72)_0%,rgb(49,24,122)_45%,rgb(96,20,150)_100%)]" />
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <X className="h-5 w-5 shrink-0 text-white/70" />
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">{children}</div>
      {footer}
    </div>
  );
}

export function PromptBadge({ tone }: { tone: "review" | "new" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tone === "review" ? "bg-amber-300/20 text-amber-200" : "bg-fuchsia-300/20 text-fuchsia-200"
      )}
    >
      {tone === "review" ? "Review" : "New word"}
    </span>
  );
}

const OPTION_STATE = {
  idle: "border-white/20 bg-white/[0.08]",
  selected: "border-sky-300 bg-sky-400/20 ring-2 ring-sky-300/60",
  correct: "border-emerald-300 bg-emerald-400/25 ring-2 ring-emerald-300/60",
  dimmed: "border-white/10 bg-white/[0.04] opacity-50",
} as const;

export type OptionLook = keyof typeof OPTION_STATE;

export function OptionRow({ state, children, lang }: { state: OptionLook; children: ReactNode; lang?: string }) {
  return (
    <div
      lang={lang}
      className={cn("flex min-h-[3.25rem] items-center rounded-2xl border-2 px-4 text-[17px] font-semibold transition-all duration-300", OPTION_STATE[state])}
    >
      <span className="flex-1">{children}</span>
      {state === "correct" && (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </div>
  );
}
