"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandBackground } from "./brand-background";
import { ProgressBar } from "./progress-bar";

export interface LessonShellProps {
  children: ReactNode;
  /** Exit control: a link target, or a handler (e.g. to confirm before leaving). One is required. */
  exitHref?: string;
  onExit?: () => void;
  exitLabel?: string;
  /** 0..1. Omit to hide the progress bar. */
  progress?: number;
  progressLabel?: string;
  /** Content to the right of the progress bar (XpPill, StreakBadge, hearts…). */
  topBarEnd?: ReactNode;
  /** Replaces the progress bar area (e.g. a title for non-linear screens). */
  topBarCenter?: ReactNode;
  /** Pinned to the bottom, above the safe area (FeedbackBanner, primary action). */
  footer?: ReactNode;
  /**
   * true (default): covers the whole viewport including the global site header, for a focused,
   * distraction-free session. false: fills its parent instead.
   */
  immersive?: boolean;
  /** "brand" (default) draws the gradient backdrop; "none" lets the parent provide one. */
  background?: "brand" | "none";
  className?: string;
  contentClassName?: string;
}

/** Full-height frame for lessons, reviews and tutor sessions: top bar, scrollable body, pinned footer. */
export function LessonShell({
  children,
  exitHref,
  onExit,
  exitLabel = "Exit",
  progress,
  progressLabel = "Session progress",
  topBarEnd,
  topBarCenter,
  footer,
  immersive = true,
  background = "brand",
  className,
  contentClassName,
}: LessonShellProps) {
  const exitClasses =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

  const exitControl = onExit ? (
    <button type="button" onClick={onExit} aria-label={exitLabel} className={exitClasses}>
      <X className="h-6 w-6" aria-hidden />
    </button>
  ) : exitHref ? (
    <Link href={exitHref} aria-label={exitLabel} className={exitClasses}>
      <X className="h-6 w-6" aria-hidden />
    </Link>
  ) : null;

  return (
    <div
      className={cn(
        "isolate flex flex-col overflow-hidden text-white",
        immersive ? "fixed inset-0 z-40 h-[100dvh]" : "relative min-h-full",
        className
      )}
    >
      {background === "brand" && <BrandBackground className="-z-10" />}

      <header className="mx-auto flex w-full max-w-3xl items-center gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        {exitControl}
        <div className="min-w-0 flex-1">
          {topBarCenter ?? (progress !== undefined ? <ProgressBar value={progress} label={progressLabel} size="md" /> : null)}
        </div>
        {topBarEnd && <div className="flex shrink-0 items-center gap-2">{topBarEnd}</div>}
      </header>

      {/* A div, not <main>: the root layout already provides the page's main landmark. */}
      <div className={cn("mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6", contentClassName)}>
        {children}
      </div>

      {footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">{footer}</div>}
    </div>
  );
}
