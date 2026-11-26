"use client";

import { Loader2, Snail, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSpeech } from "@/hooks/use-speech";
import type { ListenStep } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";
import { hasUserActivation } from "../hooks";
import { TargetText } from "../target-text";
import { ChoiceExercise } from "./choice-exercise";
import { OptionList } from "./option-list";
import { PromptHeader } from "./prompt-header";
import type { ExerciseProps } from "./types";

/**
 * Hear the word, pick its meaning. Devices without a voice for the language get the step's
 * fallback (a written meaning question) instead, decided once per showing.
 */
export function ListenExercise(props: ExerciseProps<ListenStep>) {
  const { step, language, showRomanization, revealed, retry, onDraft } = props;
  const { supported, ready, speaking, speak } = useSpeech(language);
  const [mode, setMode] = useState<"pending" | "audio" | "fallback">("pending");
  const autoPlayed = useRef(false);

  useEffect(() => {
    if (mode === "pending" && ready) {
      setMode(supported ? "audio" : "fallback");
    } else if (mode === "pending" && supported) {
      setMode("audio");
    }
  }, [mode, ready, supported]);

  useEffect(() => {
    if (mode === "audio" && !autoPlayed.current && hasUserActivation()) {
      autoPlayed.current = true;
      speak(step.audio.text);
    }
  }, [mode, speak, step.audio.text]);

  if (mode === "pending") {
    return (
      <div className="flex flex-1 items-center justify-center" aria-live="polite">
        <Loader2 aria-hidden className="h-8 w-8 animate-spin text-white/70" />
        <span className="sr-only">Loading audio…</span>
      </div>
    );
  }

  if (mode === "fallback") {
    return <ChoiceExercise {...props} step={step.fallback} variant="fallback" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PromptHeader>What did you hear?</PromptHeader>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => speak(step.audio.text)}
            aria-label="Play the audio"
            className={cn(
              "inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-sky-400 text-white shadow-lg shadow-sky-900/40 transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60",
              speaking && "motion-safe:animate-pulse"
            )}
          >
            <Volume2 aria-hidden className="h-11 w-11" />
          </button>
          <button
            type="button"
            onClick={() => speak(step.audio.text, { rate: 0.55 })}
            aria-label="Play slowly"
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
          >
            <Snail aria-hidden className="h-6 w-6" />
          </button>
        </div>
        {revealed && (
          <TargetText
            text={step.audio.text}
            language={language}
            romanization={step.audio.romanization}
            showRomanization={showRomanization}
            className="text-3xl font-extrabold"
            romanizationClassName="text-white/80"
          />
        )}
      </div>

      <OptionList
        stepId={step.id}
        options={step.options}
        answerId={step.answerId}
        language={language}
        showRomanization={showRomanization}
        revealed={revealed}
        retry={retry}
        onSelect={(optionId) => onDraft(optionId ? { type: "choice", optionId } : null)}
      />
    </div>
  );
}
