"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { SpeakButton } from "@/components/learn";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSpeech } from "@/hooks/use-speech";
import { getLanguageConfig } from "@/lib/language-config";
import { cn } from "@/lib/utils";
import type { IntroStep } from "@/lib/lesson/types";
import { hasUserActivation } from "../hooks";
import { TargetText } from "../target-text";
import { PromptHeader } from "./prompt-header";

/** Teaches one new word before it is tested: word, sound, reading aid, meaning and an example. */
export function IntroCard({ step, language, showRomanization }: { step: IntroStep; language: string; showRomanization: boolean }) {
  const { word } = step;
  const reduceMotion = usePrefersReducedMotion();
  const { supported, speak } = useSpeech(language);
  const rtl = Boolean(getLanguageConfig(language)?.rtl);

  useEffect(() => {
    if (supported && hasUserActivation()) {
      speak(word.word);
    }
  }, [supported, speak, word.word]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PromptHeader badge="new">Learn this word</PromptHeader>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12, rotateX: -12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="my-auto rounded-3xl bg-white p-6 text-center text-slate-900 shadow-xl sm:p-8"
      >
        <div className="flex items-center justify-center gap-3">
          <TargetText
            text={word.word}
            language={language}
            romanization={word.romanization}
            showRomanization={showRomanization}
            className="text-4xl font-extrabold text-indigo-700 sm:text-5xl"
            romanizationClassName="mt-1 text-base text-slate-500"
          />
          <SpeakButton text={word.word} language={language} label={`Listen to ${word.word}`} />
        </div>
        <p className="mt-4 text-2xl font-bold">{word.translation}</p>
        {word.partOfSpeech && <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{word.partOfSpeech}</p>}

        {word.example && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left">
            <div className="flex items-start gap-2">
              <div className={cn("flex min-w-0 flex-1 flex-col", rtl ? "items-end text-right" : "items-start")}>
                <TargetText
                  as="div"
                  align="start"
                  text={word.example}
                  language={language}
                  romanization={word.exampleRomanization}
                  showRomanization={showRomanization}
                  className="text-lg font-semibold text-slate-800"
                  romanizationClassName="text-slate-500"
                />
                {word.exampleTranslation && <p className="mt-1 text-sm text-slate-600">{word.exampleTranslation}</p>}
              </div>
              <SpeakButton text={word.example} language={language} size="sm" label="Listen to the example" />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
