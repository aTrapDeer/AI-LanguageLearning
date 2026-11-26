"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

const LINES: Record<number, string> = { 3: "3 in a row!", 5: "5 in a row — on fire!" };

/** A little celebration when the learner strings correct answers together. */
export function ComboBurst({ combo }: { combo: number | null }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center" aria-live="polite">
      <AnimatePresence>
        {combo !== null && (
          <motion.div
            key={combo}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: [0.6, 1.15, 1] }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45 }}
            className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-sm font-extrabold text-white shadow-lg shadow-orange-900/30"
          >
            🔥 {LINES[combo] ?? `${combo} in a row — unstoppable!`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
