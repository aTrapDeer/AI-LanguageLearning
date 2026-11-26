"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/** Animates an integer from `from` to `target` (ease-out). Jumps straight to `target` with reduced motion. */
export function useCountUp(target: number, options: { from?: number; durationMs?: number; delayMs?: number } = {}): number {
  const { from = 0, durationMs = 900, delayMs = 0 } = options;
  const reduceMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (reduceMotion || durationMs <= 0 || from === target) {
      setValue(target);
      return;
    }

    let frame = 0;
    let start: number | null = null;
    const timeout = window.setTimeout(() => {
      const step = (time: number) => {
        start ??= time;
        const progress = Math.min(1, (time - start) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(from + (target - from) * eased));
        if (progress < 1) {
          frame = requestAnimationFrame(step);
        }
      };
      frame = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [delayMs, durationMs, from, reduceMotion, target]);

  return value;
}
