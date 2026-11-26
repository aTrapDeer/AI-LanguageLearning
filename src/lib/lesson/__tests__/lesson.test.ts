import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/language-config";
import { buildLessonPlan, countGradedSteps, MAX_GRADED_EXERCISES, meaningsOverlap, supportsTypedRecall } from "../builder";
import { validateLessonContent, validateStoredContent, type GeneratedLessonContent, type LessonContent } from "../content";
import { gradeStep, gradeTyped } from "../grader";
import { createRng, shuffle } from "../rng";
import {
  applyStepOutcome,
  createInitialProgress,
  firstTryStats,
  isFinished,
  MAX_RETRIES,
  progressRatio,
  sanitizeProgress,
} from "../session";
import { getStarterContent, STARTER_UNIT_ID } from "../starter-content";
import { findPhraseSpans, normalizeForCompare, tokenizeSentence } from "../text";
import type { BuildStep, ChoiceStep, FillStep, GradedStep, LessonAnswer, LessonPlan, ListenStep, MatchStep, TypeStep } from "../types";

function starter(language: string): LessonContent {
  const raw = getStarterContent(language, STARTER_UNIT_ID);
  if (!raw) throw new Error(`no starter for ${language}`);
  const result = validateLessonContent(raw, language);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.content;
}

function plan(language: string, seed = 7, reviewWords: LessonPlan["reviewWords"] = []): LessonPlan {
  return buildLessonPlan(starter(language), { language, lessonId: "lesson-1", unitId: STARTER_UNIT_ID, seed, reviewWords });
}

/** The answer the builder considers correct, as the player would submit it. */
function correctAnswer(step: GradedStep, language: string): LessonAnswer {
  switch (step.kind) {
    case "choice":
    case "fill":
    case "listen":
      return { type: "choice", optionId: step.answerId };
    case "match":
      return { type: "match", attempts: step.pairs.map((pair) => [pair.id, pair.id] as [string, string]) };
    case "build": {
      const remaining = [...step.tiles];
      const tileIds = step.solutions[0].map((norm) => {
        const index = remaining.findIndex((tile) => normalizeForCompare(tile.text, language) === norm);
        const [tile] = remaining.splice(index, 1);
        return tile.id;
      });
      return { type: "build", tileIds };
    }
    case "type":
      return { type: "type", text: step.answer };
  }
}

const REVIEW = [
  { id: "v1", word: "REVIEW_WORD_A", translation: "cat", romanization: null },
  { id: "v2", word: "REVIEW_WORD_B", translation: "dog", romanization: null },
  { id: "v3", word: "REVIEW_WORD_C", translation: "house", romanization: null },
];

const REVIEW_BY_LANGUAGE: Record<string, string[]> = {
  de: ["Katze", "Hund", "Haus"],
  "pt-BR": ["gato", "cachorro", "casa"],
  zh: ["猫", "狗", "房子"],
  no: ["katt", "hund", "hus"],
  ko: ["고양이", "개", "집"],
  ar: ["قطة", "كلب", "بيت"],
};

describe("starter content", () => {
  it.each(SUPPORTED_LANGUAGE_CODES)("%s validates without dropping anything", (language) => {
    const raw = getStarterContent(language, STARTER_UNIT_ID)!;
    const result = validateLessonContent(raw, language);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.content.vocabulary.length).toBe(raw.vocabulary.length);
    expect(result.content.sentences.length).toBe(raw.sentences.length);
    expect(result.content.tip).not.toBeNull();
    expect(result.content.culture).toBeTruthy();
  });

  it.each(SUPPORTED_LANGUAGE_CODES)("%s focus words are found exactly once in their sentence", (language) => {
    for (const sentence of starter(language).sentences) {
      const tokens = tokenizeSentence(sentence.text, language, sentence.words);
      expect(findPhraseSpans(tokens, sentence.focusWord!, language), `${sentence.text} / ${sentence.focusWord}`).toHaveLength(1);
    }
  });

  it("romanises the languages that need it", () => {
    for (const language of ["zh", "ko", "ar"]) {
      for (const item of starter(language).vocabulary) {
        expect(item.romanization, item.word).toBeTruthy();
      }
    }
    expect(starter("de").vocabulary.every((item) => item.romanization === null)).toBe(true);
  });

  it("only exists for the first unit", () => {
    expect(getStarterContent("de", "l1-introductions")).toBeNull();
    expect(getStarterContent("fr", STARTER_UNIT_ID)).toBeNull();
  });
});

describe("validateLessonContent", () => {
  const base = getStarterContent("de", STARTER_UNIT_ID)!;

  it("rejects content that is not the schema", () => {
    expect(validateLessonContent({ vocabulary: "nope" }, "de").ok).toBe(false);
    expect(validateLessonContent(null, "de").ok).toBe(false);
  });

  it("drops wrong-script, duplicate and duplicate-meaning items", () => {
    const content: GeneratedLessonContent = {
      ...base,
      vocabulary: [
        ...base.vocabulary,
        { ...base.vocabulary[0] },
        { ...base.vocabulary[1], word: "Moin", translation: "good morning" },
        { ...base.vocabulary[2], word: "你好", translation: "hello there" },
      ],
    };
    const result = validateLessonContent(content, "de");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.vocabulary.map((item) => item.word)).toEqual(base.vocabulary.map((item) => item.word));
    expect(result.warnings.length).toBe(3);
  });

  it("splits slash forms into alternatives and strips notes", () => {
    const content = {
      ...getStarterContent("pt-BR", STARTER_UNIT_ID)!,
    };
    content.vocabulary = [{ ...content.vocabulary[4], word: "Obrigado / Obrigada (m/f)", alternatives: [] }, ...content.vocabulary.slice(0, 4)];
    const result = validateLessonContent(content, "pt-BR");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.vocabulary[0].word).toBe("Obrigado");
    expect(result.content.vocabulary[0].alternatives).toEqual(["Obrigada"]);
  });

  it("fails when too little usable content remains", () => {
    const result = validateLessonContent({ ...base, vocabulary: base.vocabulary.slice(0, 2) }, "de");
    expect(result.ok).toBe(false);
    const noSentences = validateLessonContent({ ...base, sentences: base.sentences.map((s) => ({ ...s, text: "Hello there" + "!" })).slice(0, 1) }, "de");
    expect(noSentences.ok).toBe(false);
  });

  it("rejects English or romanisation placed in the target field for non-Latin languages", () => {
    const zh = getStarterContent("zh", STARTER_UNIT_ID)!;
    const content = { ...zh, vocabulary: zh.vocabulary.map((item, index) => (index === 0 ? { ...item, word: "ni hao" } : item)) };
    const result = validateLessonContent(content, "zh");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.vocabulary.some((item) => item.word === "ni hao")).toBe(false);
  });

  it("drops a romanisation that is not Latin and clears it for Latin-script languages", () => {
    const ko = getStarterContent("ko", STARTER_UNIT_ID)!;
    const content = { ...ko, vocabulary: ko.vocabulary.map((item, index) => (index === 0 ? { ...item, romanization: "안녕" } : item)) };
    const result = validateLessonContent(content, "ko");
    expect(result.ok && result.content.vocabulary[0].romanization).toBeNull();
    const de = validateLessonContent({ ...base, vocabulary: base.vocabulary.map((item) => ({ ...item, romanization: "x" })) }, "de");
    expect(de.ok && de.content.vocabulary.every((item) => item.romanization === null)).toBe(true);
  });

  it("round-trips stored content", () => {
    const content = starter("ar");
    expect(validateStoredContent(content, "ar")).toEqual(content);
    expect(validateStoredContent({ junk: true }, "ar")).toBeNull();
  });
});

describe("text helpers", () => {
  it("tokenises Chinese with the content's word list and keeps offsets", () => {
    const tokens = tokenizeSentence("王老师，早上好！", "zh", ["王", "老师", "早上好"]);
    expect(tokens.map((token) => token.core)).toEqual(["王", "老师", "早上好"]);
    expect("王老师，早上好！".slice(tokens[2].start, tokens[2].end)).toBe("早上好");
  });

  it("falls back when the word list does not line up", () => {
    const tokens = tokenizeSentence("你好，请喝茶。", "zh", ["你好", "咖啡"]);
    expect(tokens.map((token) => token.core).join("")).toBe("你好请喝茶");
  });

  it("finds multi-word phrases and ignores case and punctuation", () => {
    const tokens = tokenizeSentence("Guten Morgen, Frau Schmidt!", "de");
    expect(findPhraseSpans(tokens, "guten morgen", "de")).toEqual([[0, 1]]);
    expect(findPhraseSpans(tokens, "Morgen Frau", "de")).toEqual([[1, 2]]);
  });

  it("normalises Arabic diacritics and alef forms", () => {
    expect(normalizeForCompare("شكرًا", "ar")).toBe(normalizeForCompare("شكرا", "ar"));
    expect(normalizeForCompare("أحمد", "ar")).toBe(normalizeForCompare("احمد", "ar"));
  });

  it("treats one meaning containing another as too close", () => {
    expect(meaningsOverlap("hello", "hello (polite)")).toBe(true);
    expect(meaningsOverlap("thank you", "thank you very much")).toBe(true);
    expect(meaningsOverlap("tea", "teacher")).toBe(false);
    expect(meaningsOverlap("bye (casual)", "goodbye (formal)")).toBe(false);
  });
});

describe("buildLessonPlan", () => {
  it.each(SUPPORTED_LANGUAGE_CODES)("%s: 12–16 graded exercises, every one answerable", (language) => {
    const reviewWords = REVIEW.map((review, index) => ({ ...review, word: REVIEW_BY_LANGUAGE[language][index] }));
    const lesson = plan(language, 11, reviewWords);
    const graded = lesson.steps.filter((step): step is GradedStep => step.graded);
    expect(graded.length).toBeGreaterThanOrEqual(12);
    expect(graded.length).toBeLessThanOrEqual(MAX_GRADED_EXERCISES);
    expect(new Set(lesson.steps.map((step) => step.id)).size).toBe(lesson.steps.length);

    for (const step of graded) {
      const result = gradeStep(step, correctAnswer(step, language), language);
      expect(result.correct, `${step.id}`).toBe(true);
    }
  });

  it.each(SUPPORTED_LANGUAGE_CODES)("%s: options are unique and never two plausible answers", (language) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const lesson = plan(language, seed);
      for (const step of lesson.steps) {
        if (step.kind !== "choice" && step.kind !== "fill" && step.kind !== "listen") continue;
        const texts = step.options.map((option) => normalizeForCompare(option.text, option.isTarget ? language : "en"));
        expect(new Set(texts).size, step.id).toBe(texts.length);
        expect(step.options.length).toBeGreaterThanOrEqual(3);
        expect(step.options.filter((option) => option.id === step.answerId)).toHaveLength(1);
      }
    }
  });

  it("teaches each word before testing it", () => {
    const lesson = plan("de");
    const introduced = new Set<string>();
    for (const step of lesson.steps) {
      if (step.kind === "intro") introduced.add(step.word.key);
      if (step.graded && step.ref.kind === "word") {
        expect(introduced.has(step.ref.key), step.id).toBe(true);
      }
    }
    expect(lesson.steps[0].kind).toBe("intro");
  });

  it("fill-in-the-blank blanks text that is really in the sentence, and distractors are not in it", () => {
    for (const language of SUPPORTED_LANGUAGE_CODES) {
      for (const seed of [1, 2, 3]) {
        const fills = plan(language, seed).steps.filter((step): step is FillStep => step.kind === "fill");
        expect(fills.length).toBeGreaterThan(0);
        for (const fill of fills) {
          expect(fill.before + fill.blank + fill.after).toBe(fill.sentence.text);
          for (const option of fill.options) {
            if (option.id === fill.answerId) {
              expect(normalizeForCompare(option.text, language)).toBe(normalizeForCompare(fill.blank, language));
            } else {
              expect(normalizeForCompare(fill.sentence.text, language)).not.toContain(normalizeForCompare(option.text, language));
            }
          }
        }
      }
    }
  });

  it("build-the-sentence tiles contain the sentence plus distractors, shuffled", () => {
    const builds = plan("ar", 3).steps.filter((step): step is BuildStep => step.kind === "build");
    expect(builds.length).toBeGreaterThan(0);
    for (const build of builds) {
      expect(build.tiles.length).toBeGreaterThan(build.solutions[0].length);
      const order = build.tiles.slice(0, build.solutions[0].length).map((tile) => normalizeForCompare(tile.text, "ar"));
      expect(order).not.toEqual(build.solutions[0]);
    }
  });

  it("is deterministic for a seed and varies between seeds", () => {
    expect(plan("ko", 42)).toEqual(plan("ko", 42));
    expect(JSON.stringify(plan("ko", 42).steps)).not.toEqual(JSON.stringify(plan("ko", 43).steps));
  });

  it("offers typing only for Latin-script languages", () => {
    expect(supportsTypedRecall("de")).toBe(true);
    expect(supportsTypedRecall("zh")).toBe(false);
    expect(supportsTypedRecall("ar")).toBe(false);
    expect(plan("de").steps.some((step) => step.kind === "type")).toBe(true);
    for (const language of ["zh", "ko", "ar"]) {
      expect(plan(language).steps.some((step) => step.kind === "type")).toBe(false);
    }
  });

  it("mixes in due review words, skipping ones that clash with the lesson", () => {
    const reviewWords = [
      { id: "r1", word: "Hallo", translation: "hello", romanization: null },
      { id: "r2", word: "Katze", translation: "cat", romanization: null },
      { id: "r3", word: "Hund", translation: "dog", romanization: null },
    ];
    const lesson = plan("de", 5, reviewWords);
    const reviewSteps = lesson.steps.filter((step): step is ChoiceStep => step.kind === "choice" && step.isReview);
    expect(lesson.reviewWords.map((word) => word.id)).toEqual(["r2", "r3"]);
    expect(reviewSteps.map((step) => (step.ref.kind === "review" ? step.ref.vocabId : null)).sort()).toEqual(["r2", "r3"]);
  });

  it("gives listening exercises a non-audio fallback", () => {
    const listen = plan("no", 2).steps.find((step): step is ListenStep => step.kind === "listen");
    expect(listen).toBeDefined();
    expect(listen!.fallback.kind).toBe("choice");
    expect(gradeStep(listen!, { type: "choice", optionId: listen!.fallback.answerId, variant: "fallback" }, "no").correct).toBe(true);
  });

  it("respects a smaller budget", () => {
    expect(countGradedSteps(buildLessonPlan(starter("zh"), { language: "zh", lessonId: "x", unitId: STARTER_UNIT_ID, seed: 1, maxGraded: 12 }))).toBeLessThanOrEqual(12);
  });
});

describe("grader", () => {
  const typeStep: Pick<TypeStep, "answer" | "accepted"> = { answer: "Tschüss", accepted: ["Tschüs"] };

  it("ignores case, punctuation and spacing", () => {
    expect(gradeTyped(typeStep, "  tschüss! ", "de")).toMatchObject({ correct: true, note: null });
    expect(gradeTyped(typeStep, "Tschüs", "de")).toMatchObject({ correct: true, note: null });
  });

  it("accepts a missing accent with a note", () => {
    expect(gradeTyped(typeStep, "tschuss", "de")).toMatchObject({ correct: true, note: "accent" });
    expect(gradeTyped({ answer: "Café", accepted: [] }, "cafe", "pt-BR")).toMatchObject({ correct: true, note: "accent" });
    expect(gradeTyped({ answer: "Straße", accepted: [] }, "strasse", "de")).toMatchObject({ correct: true, note: "accent" });
    expect(gradeTyped({ answer: "Smørbrød", accepted: [] }, "smorbrod", "no")).toMatchObject({ correct: true, note: "accent" });
  });

  it("allows one typo in longer words only", () => {
    expect(gradeTyped({ answer: "Entschuldigung", accepted: [] }, "Entschuldigun", "de")).toMatchObject({ correct: true, note: "typo" });
    expect(gradeTyped({ answer: "Hallo", accepted: [] }, "Halo", "de")).toMatchObject({ correct: false });
    expect(gradeTyped({ answer: "Bitte", accepted: [] }, "Danke", "de").correct).toBe(false);
    expect(gradeTyped({ answer: "Bitte", accepted: [] }, "", "de").correct).toBe(false);
  });

  it("flags a missing article", () => {
    expect(gradeTyped({ answer: "die Katze", accepted: [] }, "Katze", "de")).toMatchObject({ correct: false, note: "article" });
  });

  it("grades matching on every attempt, not just the end state", () => {
    const step = plan("de").steps.find((candidate): candidate is MatchStep => candidate.kind === "match")!;
    const perfect = step.pairs.map((pair) => [pair.id, pair.id] as [string, string]);
    expect(gradeStep(step, { type: "match", attempts: perfect }, "de").correct).toBe(true);
    expect(gradeStep(step, { type: "match", attempts: [["p1", "p2"], ...perfect] }, "de").correct).toBe(false);
    expect(gradeStep(step, { type: "match", attempts: perfect.slice(1) }, "de").correct).toBe(false);
  });

  it("rejects unknown or duplicated tiles and wrong answer types", () => {
    const step = plan("de").steps.find((candidate): candidate is BuildStep => candidate.kind === "build")!;
    expect(gradeStep(step, { type: "build", tileIds: ["nope"] }, "de").correct).toBe(false);
    expect(gradeStep(step, { type: "build", tileIds: [step.tiles[0].id, step.tiles[0].id] }, "de").correct).toBe(false);
    expect(gradeStep(step, { type: "type", text: "x" }, "de").correct).toBe(false);
    expect(gradeStep(step, null, "de").correct).toBe(false);
  });

  it("accepts an alternative word order when the content lists one", () => {
    const content = starter("de");
    content.sentences = [
      { text: "Ich trinke heute Kaffee.", translation: "I'm drinking coffee today.", romanization: null, words: [], focusWord: null, alternatives: ["Heute trinke ich Kaffee."] },
      ...content.sentences,
    ];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const lesson = buildLessonPlan(content, { language: "de", lessonId: "x", unitId: STARTER_UNIT_ID, seed });
      const build = lesson.steps.find((step): step is BuildStep => step.kind === "build" && step.sentence.text.startsWith("Ich trinke"));
      if (!build) continue;
      expect(build.solutions).toHaveLength(2);
      const ids = ["heute", "trinke", "ich", "kaffee"].map((word) => build.tiles.find((tile) => tile.text.toLowerCase() === word)!.id);
      expect(gradeStep(build, { type: "build", tileIds: ids }, "de").correct).toBe(true);
      return;
    }
    throw new Error("sentence never chosen for building");
  });
});

describe("lesson session", () => {
  const lesson = plan("de");

  it("re-queues misses at the end and scores first tries only", () => {
    let progress = createInitialProgress(lesson);
    const firstGraded = lesson.steps.findIndex((step) => step.graded);
    for (let index = 0; index < firstGraded; index += 1) {
      progress = applyStepOutcome(progress, { stepId: progress.queue[0], graded: false });
    }

    const missed = progress.queue[0];
    progress = applyStepOutcome(progress, { stepId: missed, graded: true, correct: false, answer: { type: "choice", optionId: "o1" } });
    expect(progress.queue[progress.queue.length - 1]).toBe(missed);
    expect(progress.combo).toBe(0);

    while (!isFinished(progress)) {
      const id = progress.queue[0];
      const step = lesson.steps.find((candidate) => candidate.id === id)!;
      progress = applyStepOutcome(progress, { stepId: id, graded: step.graded, correct: true, answer: { type: "choice", optionId: "x" } });
    }

    const stats = firstTryStats(lesson, progress);
    expect(stats.total).toBe(countGradedSteps(lesson));
    expect(stats.correct).toBe(stats.total - 1);
    expect(progress.results[missed].correct).toBe(false);
    expect(progressRatio(progress)).toBe(1);
    expect(progress.bestCombo).toBe(stats.total);
  });

  it("stops re-queuing after the retry cap", () => {
    const single: Pick<LessonPlan, "steps"> = { steps: lesson.steps.filter((step) => step.graded).slice(0, 1) };
    let progress = createInitialProgress(single);
    for (let index = 0; index <= MAX_RETRIES; index += 1) {
      progress = applyStepOutcome(progress, { stepId: progress.queue[0], graded: true, correct: false, answer: { type: "choice", optionId: "o1" } });
    }
    expect(isFinished(progress)).toBe(true);
  });

  it("ignores outcomes for anything but the current step", () => {
    const progress = createInitialProgress(lesson);
    expect(applyStepOutcome(progress, { stepId: "not-current", graded: false })).toBe(progress);
  });

  it("sanitises resume state from the client", () => {
    const progress = createInitialProgress(lesson);
    expect(sanitizeProgress(lesson, progress)).toEqual(progress);
    expect(sanitizeProgress(lesson, { ...progress, queue: ["evil"] })).toBeNull();
    expect(sanitizeProgress(lesson, { ...progress, results: { [lesson.steps[0].id]: { correct: true, answer: { type: "choice", optionId: "o1" } } } })).toBeNull();
    expect(sanitizeProgress(lesson, { ...progress, done: -1 })).toBeNull();
    expect(sanitizeProgress(lesson, "garbage")).toBeNull();
  });
});

describe("rng", () => {
  it("shuffles deterministically without losing items", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffle(items, createRng(3))).toEqual(shuffle(items, createRng(3)));
    expect([...shuffle(items, createRng(3))].sort()).toEqual(items);
  });
});
