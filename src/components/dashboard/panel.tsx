import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The dashboard's light surface: white on paper with a hairline edge and a long, soft shadow. */
export function Panel({
  children,
  className,
  labelledBy,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={cn(
        "rounded-[1.75rem] border border-ink-900/[0.07] bg-white p-5 shadow-[0_1px_0_rgb(24_18_63/0.04),0_18px_40px_-24px_rgb(24_18_63/0.28)] sm:p-6",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/** Small monospaced label used above numbers and section titles. */
export function Eyebrow({ children, className, id, as: Tag = "p" }: { children: ReactNode; className?: string; id?: string; as?: "p" | "h2" | "h3" | "span" }) {
  return (
    <Tag id={id} className={cn("font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500", className)}>
      {children}
    </Tag>
  );
}
