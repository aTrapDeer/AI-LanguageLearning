"use client";

import { LayoutGroup, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { createRng, seedFromString, shuffle } from "@/lib/lesson/rng";
import type { BuildStep } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";
import { targetDir, targetLang } from "../target-text";
import { PromptHeader } from "./prompt-header";
import type { ExerciseProps } from "./types";

/** Build the sentence from a word bank. Tap to place, tap again to remove; Backspace removes the last. */
export function BuildExercise({ step, language, showRomanization, revealed, retry, onDraft }: ExerciseProps<BuildStep>) {
  const reduceMotion = usePrefersReducedMotion();
  const [placed, setPlaced] = useState<string[]>([]);
  const bank = retry > 0 ? shuffle(step.tiles, createRng(seedFromString(`${step.id}:${retry}`))) : step.tiles;
  const byId = new Map(step.tiles.map((tile) => [tile.id, tile]));
  const dir = targetDir(language);
  const lang = targetLang(language);

  useEffect(() => setPlaced([]), [step.id, retry]);

  const update = (next: string[]) => {
    setPlaced(next);
    onDraft(next.length > 0 ? { type: "build", tileIds: next } : null);
  };

  useEffect(() => {
    if (revealed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Backspace" && placed.length > 0) {
        event.preventDefault();
        const next = placed.slice(0, -1);
        setPlaced(next);
        onDraft(next.length > 0 ? { type: "build", tileIds: next } : null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDraft, placed, revealed]);

  const tileClass =
    "rounded-xl border-2 border-b-4 border-white/25 bg-white px-3 py-2 text-lg font-semibold text-slate-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 disabled:cursor-default";
  const layoutTransition = reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 35 };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PromptHeader>Build the sentence</PromptHeader>
      <p className="text-center text-2xl font-bold">“{step.translation}”</p>

      <LayoutGroup id={`${step.id}-${retry}`}>
        <div
          lang={lang}
          dir={dir}
          aria-label="Your answer"
          className={cn(
            "flex min-h-[4.5rem] flex-wrap content-start items-start gap-2 border-b-2 pb-3",
            revealed ? (revealed.correct ? "border-emerald-300" : "border-rose-300") : "border-white/30"
          )}
        >
          {placed.map((id) => {
            const tile = byId.get(id);
            return tile ? (
              <motion.button
                layout
                layoutId={id}
                transition={layoutTransition}
                key={id}
                type="button"
                disabled={Boolean(revealed)}
                onClick={() => update(placed.filter((placedId) => placedId !== id))}
                className={tileClass}
              >
                {tile.text}
              </motion.button>
            ) : null;
          })}
        </div>

        {revealed && !revealed.correct && (
          <p lang={lang} dir={dir} className="text-center text-lg text-white/85">
            {step.sentence.text}
            {showRomanization && step.sentence.romanization && <span className="block text-sm text-white/70">{step.sentence.romanization}</span>}
          </p>
        )}

        <div lang={lang} dir={dir} role="group" aria-label="Word bank" className="flex flex-wrap justify-center gap-2 pt-2">
          {bank.map((tile) => {
            const used = placed.includes(tile.id);
            return (
              <div key={tile.id} className="relative">
                <span aria-hidden className={cn(tileClass, "invisible block")}>
                  {tile.text}
                </span>
                {!used && (
                  <motion.button
                    layout
                    layoutId={tile.id}
                    transition={layoutTransition}
                    type="button"
                    disabled={Boolean(revealed)}
                    onClick={() => update([...placed, tile.id])}
                    className={cn(tileClass, "absolute inset-0 hover:bg-sky-50")}
                  >
                    {tile.text}
                  </motion.button>
                )}
                {used && <span aria-hidden className="absolute inset-0 rounded-xl bg-white/15" />}
              </div>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
