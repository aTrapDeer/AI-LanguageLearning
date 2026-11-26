"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * `prefers-reduced-motion`, but false until after hydration so server and first client render match
 * (framer's hook returns the real value immediately on the client, which causes hydration errors).
 */
export function usePrefersReducedMotion(): boolean {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return mounted && Boolean(prefersReduced);
}
