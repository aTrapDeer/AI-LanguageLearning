"use client";

import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { TipStep } from "@/lib/lesson/types";

/** The unit's grammar/usage point, shown just before the sentence exercises that use it. */
export function TipCard({ step }: { step: TipStep }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <div className="flex flex-1 flex-col justify-center">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 text-slate-900 shadow-xl"
      >
        <div className="flex items-center gap-2 text-amber-700">
          <Lightbulb aria-hidden className="h-6 w-6" />
          <span className="text-sm font-bold uppercase tracking-wide">Quick tip</span>
        </div>
        <h2 className="mt-3 text-2xl font-extrabold">{step.title}</h2>
        <p className="mt-2 text-lg leading-relaxed text-slate-700">{step.body}</p>
      </motion.div>
    </div>
  );
}
