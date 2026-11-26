"use client";

import { useEffect, useState } from "react";
import type { FillStep } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";
import { targetDir, targetLang } from "../target-text";
import { OptionList } from "./option-list";
import { PromptHeader } from "./prompt-header";
import type { ExerciseProps } from "./types";

/** Pick the word that completes the sentence; the English meaning makes the answer unambiguous. */
export function FillExercise({ step, language, showRomanization, revealed, retry, onDraft }: ExerciseProps<FillStep>) {
  const [selectedText, setSelectedText] = useState<string | null>(null);

  useEffect(() => setSelectedText(null), [step.id, retry]);

  const slotText = revealed ? step.blank : selectedText;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PromptHeader>Complete the sentence</PromptHeader>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2 text-center">
        <p lang={targetLang(language)} dir={targetDir(language)} className="text-2xl font-bold leading-relaxed sm:text-3xl">
          {step.before}
          <span
            className={cn(
              "mx-1 inline-block min-w-[4.5rem] rounded-xl border-b-4 px-2 align-baseline transition",
              !slotText && "border-white/50 bg-white/10 text-transparent",
              slotText && !revealed && "border-sky-300 bg-sky-400/20",
              revealed?.correct && "border-emerald-300 bg-emerald-400/25",
              revealed && !revealed.correct && "border-rose-300 bg-rose-400/20"
            )}
          >
            {slotText ?? " "}
          </span>
          {step.after}
        </p>
        {revealed && showRomanization && step.sentence.romanization && <p className="text-white/80">{step.sentence.romanization}</p>}
        <p className="text-base text-white/75">“{step.translation}”</p>
      </div>

      <OptionList
        stepId={step.id}
        options={step.options}
        answerId={step.answerId}
        language={language}
        showRomanization={showRomanization}
        revealed={revealed}
        retry={retry}
        layout="grid"
        onSelect={(optionId) => {
          setSelectedText(step.options.find((option) => option.id === optionId)?.text ?? null);
          onDraft(optionId ? { type: "choice", optionId } : null);
        }}
      />
    </div>
  );
}
