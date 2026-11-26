"use client";

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "dimmed";

export interface OptionButtonProps {
  state: OptionState;
  onClick: () => void;
  disabled?: boolean;
  /** 1-based keyboard shortcut shown in the corner. */
  hotkey?: number;
  children: ReactNode;
  className?: string;
  layout?: "row" | "tile";
}

const STATE_CLASSES: Record<OptionState, string> = {
  idle: "border-white/20 bg-white/[0.08] hover:border-white/40 hover:bg-white/[0.14]",
  selected: "border-sky-300 bg-sky-400/20 ring-2 ring-sky-300/60",
  correct: "border-emerald-300 bg-emerald-400/25 ring-2 ring-emerald-300/60",
  wrong: "border-rose-300 bg-rose-400/25 ring-2 ring-rose-300/60",
  dimmed: "border-white/10 bg-white/[0.04] opacity-50",
};

/** Large, thumb-friendly answer button with selected / correct / wrong states. */
export function OptionButton({ state, onClick, disabled, hotkey, children, className, layout = "row" }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={cn(
        "group relative flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold text-white transition",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 disabled:cursor-default",
        "motion-safe:active:scale-[0.98]",
        layout === "tile" && "justify-center text-center",
        STATE_CLASSES[state],
        className
      )}
    >
      {hotkey !== undefined && layout === "row" && (
        <kbd
          aria-hidden
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/25 text-xs font-bold text-white/70 sm:inline-flex"
        >
          {hotkey}
        </kbd>
      )}
      <span className={cn("min-w-0 flex-1", layout === "tile" && "flex justify-center")}>{children}</span>
      {state === "correct" && <Check aria-hidden className="h-5 w-5 shrink-0 text-emerald-300" />}
      {state === "wrong" && <X aria-hidden className="h-5 w-5 shrink-0 text-rose-300" />}
    </button>
  );
}
