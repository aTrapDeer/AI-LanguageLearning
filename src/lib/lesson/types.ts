/**
 * Shapes shared by the lesson builder, grader, player and API. Everything here is JSON-serialisable:
 * a built plan is stored with the attempt so a resumed lesson is exactly the one that was started.
 */

/** Text in the target language plus an optional Latin reading aid (Pinyin, RR, transliteration). */
export interface TargetText {
  text: string;
  romanization: string | null;
}

/**
 * A word's picture. The plan stores only the concept key (and the description it is generated from);
 * `url` is filled in on each response once a picture exists, so stored plans pick up pictures that
 * finished after the lesson was started.
 */
export interface PlanPicture {
  key: string;
  description: string;
  url?: string | null;
}

/** A new word as the learner meets it in the lesson. */
export interface PlanWord {
  /** Normalised key, stable within the lesson. */
  key: string;
  word: string;
  translation: string;
  romanization: string | null;
  partOfSpeech: string;
  alternatives: string[];
  example: string | null;
  exampleTranslation: string | null;
  exampleRomanization: string | null;
  /** Absent in plans built before pictures existed. */
  picture?: PlanPicture | null;
}

export interface ReviewWordInput {
  /** `learning.id` of the learner's vocabulary item. */
  id: string;
  word: string;
  translation: string;
  romanization: string | null;
  /** Concept key of the word's picture (`learning.image_key`). */
  imageKey?: string | null;
}

export type StepRef =
  | { kind: "word"; key: string }
  | { kind: "review"; vocabId: string; word: string }
  | { kind: "sentence"; index: number };

export interface ChoiceOption {
  id: string;
  text: string;
  romanization: string | null;
  /** True when the text is in the target language (render with lang/dir). */
  isTarget: boolean;
}

interface GradedBase {
  id: string;
  graded: true;
  ref: StepRef;
  /** Short "why" shown after a wrong answer. */
  explanation: string | null;
}

export interface IntroStep {
  id: string;
  kind: "intro";
  graded: false;
  word: PlanWord;
}

export interface TipStep {
  id: string;
  kind: "tip";
  graded: false;
  title: string;
  body: string;
}

export interface ChoiceStep extends GradedBase {
  kind: "choice";
  /** "toEnglish": see the target word, pick its meaning. "toTarget": see English, pick the word. */
  direction: "toEnglish" | "toTarget";
  prompt: TargetText;
  options: ChoiceOption[];
  answerId: string;
  isReview: boolean;
  /** Shown with the English prompt of "toTarget" questions only (it would give a "toEnglish" answer away). */
  picture?: PlanPicture | null;
}

export interface ListenStep extends GradedBase {
  kind: "listen";
  audio: TargetText;
  options: ChoiceOption[];
  answerId: string;
  /** Played instead when the device has no voice for the language. */
  fallback: ChoiceStep;
}

export interface MatchPair {
  id: string;
  target: TargetText;
  english: string;
}

export interface MatchStep extends GradedBase {
  kind: "match";
  pairs: MatchPair[];
  /** Display orders (pair ids) for the two columns. */
  targetOrder: string[];
  englishOrder: string[];
}

export interface FillStep extends GradedBase {
  kind: "fill";
  before: string;
  after: string;
  /** The blanked text exactly as it appears in the sentence. */
  blank: string;
  sentence: TargetText;
  translation: string;
  options: ChoiceOption[];
  answerId: string;
}

export interface BuildTile {
  id: string;
  text: string;
}

export interface BuildStep extends GradedBase {
  kind: "build";
  translation: string;
  sentence: TargetText;
  tiles: BuildTile[];
  /** Accepted orders as normalised token sequences (first is the canonical sentence). */
  solutions: string[][];
}

export interface TypeStep extends GradedBase {
  kind: "type";
  /** English meaning to translate. */
  prompt: string;
  answer: string;
  /** Other spellings accepted as fully correct (e.g. "Obrigada" for "Obrigado"). */
  accepted: string[];
}

export type GradedStep = ChoiceStep | ListenStep | MatchStep | FillStep | BuildStep | TypeStep;
export type LessonStep = IntroStep | TipStep | GradedStep;
export type LessonStepKind = LessonStep["kind"];

export interface LessonPlan {
  version: 1;
  lessonId: string;
  unitId: string;
  language: string;
  title: string;
  steps: LessonStep[];
  newWords: PlanWord[];
  reviewWords: ReviewWordInput[];
  tip: { title: string; body: string } | null;
  culture: string | null;
}

export type LessonAnswer =
  | { type: "choice"; optionId: string; variant?: "fallback" }
  | { type: "match"; attempts: Array<[string, string]> }
  | { type: "build"; tileIds: string[] }
  | { type: "type"; text: string };

export type GradeNote = "accent" | "typo" | "article" | null;

export interface GradeResult {
  correct: boolean;
  /** Correct-but-imperfect ("accent", "typo") or a specific reason for a miss ("article"). */
  note: GradeNote;
  /** The correct answer, for display. */
  expected: string;
  /** What the learner gave, as text (for mistake records). */
  given: string;
}

export function isGradedStep(step: LessonStep): step is GradedStep {
  return step.graded;
}
