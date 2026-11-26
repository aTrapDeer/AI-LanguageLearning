"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export interface StarRatingProps {
  stars: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  /** Pop the earned stars in one after another (end-of-lesson). */
  animate?: boolean;
  surface?: "dark" | "light";
  className?: string;
}

const ICON = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" } as const;

export function StarRating({ stars, max = 3, size = "md", animate = false, surface = "light", className }: StarRatingProps) {
  const reduceMotion = usePrefersReducedMotion();
  const earned = Math.min(max, Math.max(0, Math.floor(stars)));

  return (
    <div role="img" aria-label={`${earned} of ${max} stars`} className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: max }, (_, index) => {
        const filled = index < earned;
        const icon = (
          <Star
            aria-hidden
            className={cn(
              ICON[size],
              filled ? "fill-amber-400 text-amber-400" : surface === "dark" ? "text-white/30" : "text-slate-300"
            )}
          />
        );

        if (!animate || reduceMotion || !filled) {
          return <span key={index}>{icon}</span>;
        }

        return (
          <motion.span
            key={index}
            initial={{ scale: 0, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.25 + index * 0.25 }}
          >
            {icon}
          </motion.span>
        );
      })}
    </div>
  );
}
