import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The instruction line above every exercise, with an optional "Review" / "New" badge. */
export function PromptHeader({ children, badge, className }: { children: ReactNode; badge?: "review" | "new"; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {badge && (
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
            badge === "review" ? "bg-amber-300/20 text-amber-200" : "bg-fuchsia-300/20 text-fuchsia-200"
          )}
        >
          {badge === "review" ? "Review" : "New word"}
        </span>
      )}
      <h2 className="text-xl font-extrabold text-white sm:text-2xl">{children}</h2>
    </div>
  );
}
