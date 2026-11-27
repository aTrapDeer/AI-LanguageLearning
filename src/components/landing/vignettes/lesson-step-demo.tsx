"use client";

import { CheckCircle2, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import { LessonFrame, OptionRow, type OptionLook } from "./lesson-frame";

type Phase = "idle" | "selected" | "correct";
const OPTIONS = ["the bakery", "the train station", "the bus stop"];
const ANSWER = 1;

/**
 * A lesson question that answers itself: pick, check, "Great job!". Loops gently while motion is
 * allowed; with reduced motion it simply shows the answered state.
 */
export function LessonStepDemo({ className }: { className?: string }) {
  const reduceMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (reduceMotion) {
      setPhase("correct");
      return;
    }
    const timers: number[] = [];
    const run = () => {
      setPhase("idle");
      timers.push(window.setTimeout(() => setPhase("selected"), 1400));
      timers.push(window.setTimeout(() => setPhase("correct"), 2300));
      timers.push(window.setTimeout(run, 6800));
    };
    run();
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reduceMotion]);

  const look = (index: number): OptionLook => {
    if (phase === "idle") return "idle";
    if (index !== ANSWER) return phase === "correct" ? "dimmed" : "idle";
    return phase === "selected" ? "selected" : "correct";
  };

  return (
    <LessonFrame
      progress={0.55}
      className={className}
      footer={
        <div
          className={cn(
            "border-t-2 border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900 transition-transform duration-500 ease-out",
            phase === "correct" ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-500" />
            <p className="flex-1 text-lg font-bold">Great job!</p>
            <span className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white">Continue</span>
          </div>
        </div>
      }
    >
      <p className="text-xl font-extrabold">What does this mean?</p>
      <div className="flex flex-1 items-center justify-center gap-3 py-8">
        <p lang="de" className="text-[2.6rem] font-extrabold leading-none">
          der Bahnhof
        </p>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <Volume2 className="h-5 w-5" />
        </span>
      </div>
      <div className="grid gap-2.5">
        {OPTIONS.map((option, index) => (
          <OptionRow key={option} state={look(index)}>
            {option}
          </OptionRow>
        ))}
      </div>
    </LessonFrame>
  );
}
