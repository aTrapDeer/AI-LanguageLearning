"use client";

import type { LessonStep } from "@/lib/lesson/types";
import { BuildExercise } from "./build-exercise";
import { ChoiceExercise } from "./choice-exercise";
import { FillExercise } from "./fill-exercise";
import { IntroCard } from "./intro-card";
import { ListenExercise } from "./listen-exercise";
import { MatchExercise } from "./match-exercise";
import { TipCard } from "./tip-card";
import { TypeExercise } from "./type-exercise";
import type { ExerciseProps } from "./types";

export function StepView({ step, ...props }: Omit<ExerciseProps<never>, "step"> & { step: LessonStep }) {
  switch (step.kind) {
    case "intro":
      return <IntroCard step={step} language={props.language} showRomanization={props.showRomanization} />;
    case "tip":
      return <TipCard step={step} />;
    case "choice":
      return <ChoiceExercise step={step} {...props} />;
    case "listen":
      return <ListenExercise step={step} {...props} />;
    case "match":
      return <MatchExercise step={step} {...props} />;
    case "fill":
      return <FillExercise step={step} {...props} />;
    case "build":
      return <BuildExercise step={step} {...props} />;
    case "type":
      return <TypeExercise step={step} {...props} />;
    default:
      return null;
  }
}
