"use client";

import { SpeakButton } from "@/components/learn";
import type { ChoiceStep } from "@/lib/lesson/types";
import { TargetText } from "../target-text";
import { OptionList } from "./option-list";
import { PromptHeader } from "./prompt-header";
import type { ExerciseProps } from "./types";

/** Meaning multiple choice in either direction. `variant` marks answers given to a listening fallback. */
export function ChoiceExercise({
  step,
  language,
  showRomanization,
  revealed,
  retry,
  onDraft,
  variant,
}: ExerciseProps<ChoiceStep> & { variant?: "fallback" }) {
  const toEnglish = step.direction === "toEnglish";

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PromptHeader badge={step.isReview ? "review" : undefined}>
        {toEnglish ? "What does this mean?" : "How do you say this?"}
      </PromptHeader>

      <div className="flex flex-1 items-center justify-center gap-3 py-2">
        {toEnglish ? (
          <>
            <TargetText
              text={step.prompt.text}
              language={language}
              romanization={step.prompt.romanization}
              showRomanization={showRomanization}
              className="text-4xl font-extrabold sm:text-5xl"
              romanizationClassName="mt-1 text-base text-white/80"
            />
            <SpeakButton text={step.prompt.text} language={language} surface="dark" />
          </>
        ) : (
          <p className="text-center text-3xl font-extrabold sm:text-4xl">“{step.prompt.text}”</p>
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
        onSelect={(optionId) => onDraft(optionId ? { type: "choice", optionId, ...(variant ? { variant } : {}) } : null)}
      />
    </div>
  );
}
