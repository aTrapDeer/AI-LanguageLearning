import type { GradeResult, LessonAnswer } from "@/lib/lesson/types";

export interface ExerciseProps<TStep> {
  step: TStep;
  language: string;
  showRomanization: boolean;
  /** Set once the answer has been checked: inputs lock and the answer is revealed. */
  revealed: GradeResult | null;
  /** How many times this step has been retried (re-shuffles options on a retry). */
  retry: number;
  /** The current answer, or null while it is incomplete. */
  onDraft: (answer: LessonAnswer | null) => void;
  /** Submits immediately (exercises without a Check button, e.g. matching). */
  onSubmit: (answer: LessonAnswer) => void;
}
