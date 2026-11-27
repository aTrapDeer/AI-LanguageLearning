"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DailyGoalRing } from "@/components/learn";

/** The daily goal ring filling up once it scrolls into view (instantly with reduced motion). */
export function GoalRingDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [xp, setXp] = useState(30);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    setXp(0);
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        window.setTimeout(() => setXp(30), 300);
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className="flex h-[6.5rem] items-center gap-4">
      <DailyGoalRing
        xp={xp}
        goal={30}
        size={96}
        strokeWidth={10}
        surface="light"
        center={xp >= 30 ? <Check className="h-9 w-9 text-emerald-500" strokeWidth={3} /> : <span className="font-display text-xl font-extrabold text-ink-950">{xp}</span>}
      />
      <div>
        <p className="font-display text-3xl font-extrabold tabular-nums text-ink-950">
          30<span className="text-lg font-bold text-ink-500">/30 XP</span>
        </p>
        <p className="text-sm font-semibold text-emerald-700">Goal reached</p>
      </div>
    </div>
  );
}
