"use client";

import { SpeakButton, VocabPicture } from "@/components/learn";
import type { ChoiceStep } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";
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
  // Never next to the target word: there the picture would give the meaning away.
  const pictureUrl = toEnglish ? null : step.picture?.url;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PromptHeader badge={step.isReview ? "review" : undefined}>
        {toEnglish ? "What does this mean?" : "How do you say this?"}
      </PromptHeader>

      <div className={cn("flex flex-1 items-center justify-center gap-3 py-2", pictureUrl && "flex-col gap-4")}>
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
          <>
            {pictureUrl && <VocabPicture url={pictureUrl} className="h-28 w-28 shadow-lg shadow-indigo-950/30 sm:h-36 sm:w-36" />}
            <p className="text-center text-3xl font-extrabold sm:text-4xl">“{step.prompt.text}”</p>
          </>
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
