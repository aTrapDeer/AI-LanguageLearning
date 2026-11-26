"use client";

import { FeedbackBanner, SpeakButton } from "@/components/learn";
import { seedFromString } from "@/lib/lesson/rng";
import type { GradeResult, GradedStep } from "@/lib/lesson/types";
import { TargetText } from "../target-text";

const PRAISE = ["Nice!", "Correct!", "You got it!", "Great job!", "Spot on!", "Excellent!"];

/** What to show and read aloud as the correct answer for each exercise type. */
function answerDisplay(step: GradedStep, result: GradeResult, variant: "fallback" | undefined) {
  switch (step.kind) {
    case "choice":
      return step.direction === "toTarget"
        ? { text: result.expected, isTarget: true, speak: result.expected }
        : { text: result.expected, isTarget: false, speak: step.prompt.text };
    case "listen":
      return variant === "fallback"
        ? { text: result.expected, isTarget: true, speak: result.expected }
        : { text: result.expected, isTarget: false, speak: step.audio.text };
    case "fill":
    case "build":
      return { text: step.sentence.text, isTarget: true, speak: step.sentence.text, romanization: step.sentence.romanization };
    case "type":
      return { text: step.answer, isTarget: true, speak: step.answer };
    case "match":
      return { text: "", isTarget: false, speak: null };
  }
}

export interface StepFeedbackProps {
  step: GradedStep;
  result: GradeResult | null;
  language: string;
  showRomanization: boolean;
  variant?: "fallback";
  willRepeat: boolean;
  isRetry: boolean;
  onContinue: () => void;
}

export function StepFeedback({ step, result, language, showRomanization, variant, willRepeat, isRetry, onContinue }: StepFeedbackProps) {
  if (!result) {
    return <FeedbackBanner status={null} onContinue={onContinue} />;
  }

  const display = answerDisplay(step, result, variant);
  const answerNode = display.text ? (
    display.isTarget ? (
      <TargetText text={display.text} language={language} romanization={display.romanization ?? null} showRomanization={showRomanization} className="font-bold" />
    ) : (
      <span className="font-bold">{display.text}</span>
    )
  ) : null;
  const speak = display.speak ? <SpeakButton text={display.speak} language={language} size="sm" label="Listen to the answer" /> : null;

  if (result.correct) {
    const title =
      result.note === "accent" ? "Almost — watch the accent!" : result.note === "typo" ? "Almost — check the spelling!" : isRetry ? "Got it this time!" : PRAISE[seedFromString(step.id) % PRAISE.length];
    return (
      <FeedbackBanner
        status="correct"
        title={title}
        message={
          result.note ? (
            <span>
              Correct spelling: {answerNode}
            </span>
          ) : step.kind === "fill" || step.kind === "build" ? (
            answerNode
          ) : undefined
        }
        extra={speak}
        onContinue={onContinue}
      />
    );
  }

  const why = [result.note === "article" ? "Don't forget the article — it's part of the word." : null, step.explanation]
    .filter(Boolean)
    .join(" ");

  return (
    <FeedbackBanner
      status="incorrect"
      correctAnswer={step.kind === "match" ? undefined : answerNode}
      message={
        <span>
          {why}
          {willRepeat && <span className="mt-1 block font-semibold">You&apos;ll get another go at this one in a moment.</span>}
        </span>
      }
      extra={speak}
      onContinue={onContinue}
    />
  );
}
