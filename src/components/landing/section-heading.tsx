import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Eyebrow + display headline + optional lede, left-aligned by default. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
  tone = "light",
  className,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className={cn("font-mono text-xs font-medium uppercase tracking-[0.18em]", tone === "dark" ? "text-ember-300" : "text-ember-700")}>{eyebrow}</p>
      <h2
        id={id}
        className={cn(
          "mt-3 text-balance font-display text-[2.4rem] font-extrabold leading-[0.98] tracking-[-0.025em] [font-stretch:90%] sm:text-6xl",
          tone === "dark" ? "text-white" : "text-ink-950"
        )}
      >
        {title}
      </h2>
      {lede && <p className={cn("mt-4 text-pretty text-lg leading-relaxed", tone === "dark" ? "text-white/75" : "text-ink-600")}>{lede}</p>}
    </div>
  );
}
