"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { createRng, seedFromString, shuffle } from "@/lib/lesson/rng";
import type { MatchStep } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";
import { TargetText } from "../target-text";
import { PromptHeader } from "./prompt-header";
import type { ExerciseProps } from "./types";

type Side = "target" | "english";

/** Tap a word, then its meaning. Every tap pair is recorded; a wrong pair flashes and is retried. */
export function MatchExercise({ step, language, showRomanization, revealed, retry, onSubmit }: ExerciseProps<MatchStep>) {
  const reduceMotion = usePrefersReducedMotion();
  const [selection, setSelection] = useState<{ side: Side; id: string } | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ target: string; english: string } | null>(null);
  const attempts = useRef<Array<[string, string]>>([]);
  const submitted = useRef(false);

  const reorder = (ids: string[], side: string) => (retry > 0 ? shuffle(ids, createRng(seedFromString(`${step.id}:${side}:${retry}`))) : ids);
  const targetOrder = reorder(step.targetOrder, "t");
  const englishOrder = reorder(step.englishOrder, "e");
  const byId = new Map(step.pairs.map((pair) => [pair.id, pair]));

  useEffect(() => {
    setSelection(null);
    setMatched(new Set());
    setWrongFlash(null);
    attempts.current = [];
    submitted.current = false;
  }, [step.id, retry]);

  useEffect(() => {
    if (!wrongFlash) return;
    const timeout = window.setTimeout(() => setWrongFlash(null), 600);
    return () => window.clearTimeout(timeout);
  }, [wrongFlash]);

  const tap = (side: Side, id: string) => {
    if (revealed || matched.has(id)) return;
    if (!selection || selection.side === side) {
      setSelection({ side, id });
      return;
    }

    const targetId = side === "target" ? id : selection.id;
    const englishId = side === "english" ? id : selection.id;
    attempts.current.push([targetId, englishId]);
    setSelection(null);

    if (targetId === englishId) {
      const next = new Set(matched).add(targetId);
      setMatched(next);
      if (next.size === step.pairs.length && !submitted.current) {
        submitted.current = true;
        window.setTimeout(() => onSubmit({ type: "match", attempts: [...attempts.current] }), reduceMotion ? 0 : 250);
      }
    } else {
      setWrongFlash({ target: targetId, english: englishId });
    }
  };

  const tileClass = (side: Side, id: string) => {
    const isMatched = matched.has(id);
    const isSelected = selection?.side === side && selection.id === id;
    const isWrong = wrongFlash && (side === "target" ? wrongFlash.target === id : wrongFlash.english === id);
    return cn(
      "flex min-h-16 w-full items-center justify-center rounded-2xl border-2 px-3 py-2 text-center font-semibold text-white transition",
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50",
      isMatched && "border-emerald-300/60 bg-emerald-400/20 text-emerald-100 opacity-60",
      !isMatched && isWrong && "border-rose-300 bg-rose-400/30",
      !isMatched && !isWrong && isSelected && "border-sky-300 bg-sky-400/25 ring-2 ring-sky-300/60",
      !isMatched && !isWrong && !isSelected && "border-white/20 bg-white/[0.08] hover:bg-white/[0.14]"
    );
  };

  const shake = (active: boolean) => (active && !reduceMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PromptHeader>Tap the matching pairs</PromptHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {targetOrder.map((id) => {
            const pair = byId.get(id);
            if (!pair) return null;
            return (
              <motion.button
                key={id}
                type="button"
                animate={shake(wrongFlash?.target === id)}
                transition={{ duration: 0.35 }}
                onClick={() => tap("target", id)}
                disabled={matched.has(id) || Boolean(revealed)}
                aria-pressed={selection?.side === "target" && selection.id === id}
                className={tileClass("target", id)}
              >
                <TargetText
                  text={pair.target.text}
                  language={language}
                  romanization={pair.target.romanization}
                  showRomanization={showRomanization}
                  className="text-lg"
                  romanizationClassName="text-xs"
                />
              </motion.button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          {englishOrder.map((id) => {
            const pair = byId.get(id);
            if (!pair) return null;
            return (
              <motion.button
                key={id}
                type="button"
                animate={shake(wrongFlash?.english === id)}
                transition={{ duration: 0.35 }}
                onClick={() => tap("english", id)}
                disabled={matched.has(id) || Boolean(revealed)}
                aria-pressed={selection?.side === "english" && selection.id === id}
                className={tileClass("english", id)}
              >
                {pair.english}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
