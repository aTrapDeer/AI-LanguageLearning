import { conceptKeyFor } from "@/lib/images/concept";
import { getLanguageConfig } from "@/lib/language-config";
import type { LessonContent, LessonSentence } from "./content";
import { createRng, pickSome, shuffle, type Rng } from "./rng";
import { containsPhrase, findPhraseSpans, normalizeForCompare, tokenizeSentence, type TextToken } from "./text";
import type {
  BuildStep,
  ChoiceOption,
  ChoiceStep,
  FillStep,
  IntroStep,
  LessonPlan,
  LessonStep,
  ListenStep,
  MatchStep,
  PlanPicture,
  PlanWord,
  ReviewWordInput,
  TypeStep,
} from "./types";

/**
 * Turns validated lesson content into the exercise sequence. Pure and deterministic for a given seed:
 * teach (intro cards) → recognise (meaning choice both ways, listening, pairs) → use in context
 * (fill the blank, build the sentence) → recall (typing, Latin-script languages only).
 */

export const MAX_GRADED_EXERCISES = 16;
const MAX_REVIEW_WORDS = 3;
const MAX_MATCH_PAIRS = 5;
const MAX_BUILD_TOKENS = 10;

export interface BuildPlanOptions {
  language: string;
  lessonId: string;
  unitId: string;
  seed: number;
  /** Due words from the learner's review deck to mix in (at most three are used). */
  reviewWords?: ReviewWordInput[];
  maxGraded?: number;
}

type Draft<T extends LessonStep> = Omit<T, "id">;
type DraftStep = LessonStep extends infer S ? (S extends LessonStep ? Draft<S> : never) : never;

function pictureFor(item: LessonContent["vocabulary"][number]): PlanPicture | null {
  const key = item.picture ? conceptKeyFor(item.translation) : null;
  return key && item.picture ? { key, description: item.picture } : null;
}

export function toPlanWord(item: LessonContent["vocabulary"][number], language: string): PlanWord {
  return {
    key: normalizeForCompare(item.word, language),
    word: item.word,
    translation: item.translation,
    romanization: item.romanization,
    partOfSpeech: item.partOfSpeech,
    alternatives: item.alternatives,
    example: item.example,
    exampleTranslation: item.exampleTranslation,
    exampleRomanization: item.exampleRomanization,
    picture: pictureFor(item),
  };
}

/** Typing is offered where learners can type the script on any keyboard. */
export function supportsTypedRecall(language: string): boolean {
  const config = getLanguageConfig(language);
  return Boolean(config && !config.needsRomanization && !config.rtl);
}

function withOptionIds(options: Array<Omit<ChoiceOption, "id">>, answerIndex: number, rng: Rng) {
  const order = shuffle(
    options.map((option, index) => ({ option, index })),
    rng
  );
  const withIds = order.map(({ option }, position) => ({ ...option, id: `o${position + 1}` }));
  const answerPosition = order.findIndex(({ index }) => index === answerIndex);
  return { options: withIds, answerId: `o${answerPosition + 1}` };
}

/** Picks distractors that differ from the answer; prefers ones that do not contain / sit inside it. */
function pickDistractors<T>(params: {
  answerKey: string;
  candidates: T[];
  keyOf: (candidate: T) => string;
  overlaps?: (candidate: T) => boolean;
  count: number;
  rng: Rng;
}): T[] {
  const seen = new Set([params.answerKey]);
  const unique = params.candidates.filter((candidate) => {
    const key = params.keyOf(candidate);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const preferred = unique.filter((candidate) => !params.overlaps?.(candidate));
  const fallback = unique.filter((candidate) => params.overlaps?.(candidate));
  return [...shuffle(preferred, params.rng), ...shuffle(fallback, params.rng)].slice(0, params.count);
}

function overlapsText(a: string, b: string) {
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

/**
 * Two English meanings are too close to be told apart in a multiple-choice question when one contains
 * the other as whole words ("hello" / "hello (polite)", "thank you" / "thank you very much").
 */
export function meaningsOverlap(a: string, b: string): boolean {
  const left = ` ${normalizeForCompare(a, "en")} `;
  const right = ` ${normalizeForCompare(b, "en")} `;
  return left.trim().length > 0 && right.trim().length > 0 && (left.includes(right) || right.includes(left));
}

function explainWord(word: { word: string; romanization: string | null; translation: string }) {
  return `${word.word}${word.romanization ? ` (${word.romanization})` : ""} means “${word.translation}”.`;
}

interface Meaning {
  word: string;
  romanization: string | null;
  translation: string;
  picture?: PlanPicture | null;
}

function choiceToEnglish(params: {
  item: Meaning;
  pool: Meaning[];
  language: string;
  rng: Rng;
  ref: ChoiceStep["ref"];
  isReview: boolean;
}): Draft<ChoiceStep> | null {
  const answerKey = normalizeForCompare(params.item.translation, "en");
  const wordKey = normalizeForCompare(params.item.word, params.language);
  const distractors = pickDistractors({
    answerKey,
    candidates: params.pool.filter((candidate) => !meaningsOverlap(candidate.translation, params.item.translation)),
    keyOf: (candidate) => normalizeForCompare(candidate.translation, "en"),
    overlaps: (candidate) => overlapsText(normalizeForCompare(candidate.word, params.language), wordKey),
    count: 3,
    rng: params.rng,
  });
  if (distractors.length < 2) {
    return null;
  }

  const { options, answerId } = withOptionIds(
    [params.item, ...distractors].map((meaning) => ({ text: meaning.translation, romanization: null, isTarget: false })),
    0,
    params.rng
  );

  return {
    kind: "choice",
    graded: true,
    direction: "toEnglish",
    prompt: { text: params.item.word, romanization: params.item.romanization },
    options,
    answerId,
    isReview: params.isReview,
    ref: params.ref,
    explanation: explainWord(params.item),
  };
}

function choiceToTarget(params: {
  item: Meaning;
  pool: Meaning[];
  language: string;
  rng: Rng;
  ref: ChoiceStep["ref"];
  isReview: boolean;
}): Draft<ChoiceStep> | null {
  const answerKey = normalizeForCompare(params.item.word, params.language);
  const distractors = pickDistractors({
    answerKey,
    candidates: params.pool.filter((candidate) => !meaningsOverlap(candidate.translation, params.item.translation)),
    keyOf: (candidate) => normalizeForCompare(candidate.word, params.language),
    overlaps: (candidate) => overlapsText(normalizeForCompare(candidate.word, params.language), answerKey),
    count: 3,
    rng: params.rng,
  });
  if (distractors.length < 2) {
    return null;
  }

  const { options, answerId } = withOptionIds(
    [params.item, ...distractors].map((meaning) => ({ text: meaning.word, romanization: meaning.romanization, isTarget: true })),
    0,
    params.rng
  );

  return {
    kind: "choice",
    graded: true,
    direction: "toTarget",
    prompt: { text: params.item.translation, romanization: null },
    options,
    answerId,
    isReview: params.isReview,
    ref: params.ref,
    explanation: explainWord(params.item),
    picture: params.item.picture ?? null,
  };
}

function listenStep(word: PlanWord, pool: PlanWord[], language: string, rng: Rng): Draft<ListenStep> | null {
  const heard = choiceToEnglish({ item: word, pool, language, rng, ref: { kind: "word", key: word.key }, isReview: false });
  const fallback = choiceToTarget({ item: word, pool, language, rng, ref: { kind: "word", key: word.key }, isReview: false });
  if (!heard || !fallback) {
    return null;
  }

  return {
    kind: "listen",
    graded: true,
    audio: { text: word.word, romanization: word.romanization },
    options: heard.options,
    answerId: heard.answerId,
    ref: heard.ref,
    explanation: heard.explanation,
    // The id is assigned when the plan is numbered.
    fallback: { ...fallback, id: "" },
  };
}

function matchStep(words: PlanWord[], rng: Rng): Draft<MatchStep> | null {
  const chosen = pickSome(words, MAX_MATCH_PAIRS, rng);
  if (chosen.length < 3) {
    return null;
  }

  const pairs = chosen.map((word, index) => ({
    id: `p${index + 1}`,
    target: { text: word.word, romanization: word.romanization },
    english: word.translation,
  }));
  const ids = pairs.map((pair) => pair.id);

  return {
    kind: "match",
    graded: true,
    pairs,
    targetOrder: shuffle(ids, rng),
    englishOrder: shuffle(ids, rng),
    ref: { kind: "word", key: chosen[0].key },
    explanation: chosen.map((word) => `${word.word} = ${word.translation}`).join(" · "),
  };
}

/** Gives a distractor the same initial case as the blank so capitalisation is not a clue. */
function matchCase(text: string, reference: string) {
  const first = reference.charAt(0);
  if (!first || first.toLocaleLowerCase() === first.toLocaleUpperCase()) {
    return text;
  }

  const head = first === first.toLocaleUpperCase() ? text.charAt(0).toLocaleUpperCase() : text.charAt(0).toLocaleLowerCase();
  return head + text.slice(1);
}

interface SentenceInfo {
  index: number;
  sentence: LessonSentence;
  tokens: TextToken[];
}

function fillStep(info: SentenceInfo, words: PlanWord[], language: string, rng: Rng): Draft<FillStep> | null {
  const { sentence, tokens } = info;
  const focusKey = sentence.focusWord ? normalizeForCompare(sentence.focusWord, language) : null;
  const ordered = [...words].sort((a, b) => Number(b.key === focusKey) - Number(a.key === focusKey));

  for (const word of ordered) {
    const spans = findPhraseSpans(tokens, word.word, language);
    if (spans.length !== 1) {
      continue;
    }

    const [startIndex, endIndex] = spans[0];
    if (endIndex - startIndex + 1 >= tokens.length) {
      continue;
    }

    const answerKey = word.key;
    const distractors = pickDistractors({
      answerKey,
      candidates: words.filter(
        (candidate) =>
          !containsPhrase(sentence.text, candidate.word, language) && !meaningsOverlap(candidate.translation, word.translation)
      ),
      keyOf: (candidate) => candidate.key,
      overlaps: (candidate) => overlapsText(candidate.key, answerKey),
      count: 3,
      rng,
    });
    if (distractors.length < 2) {
      continue;
    }

    const start = tokens[startIndex].start;
    const end = tokens[endIndex].end;
    const blank = sentence.text.slice(start, end);
    // German capitalises nouns mid-sentence, so case would give the answer away: show dictionary forms.
    const dictionaryForms = language === "de";
    const { options, answerId } = withOptionIds(
      [
        { text: dictionaryForms ? word.word : blank, romanization: word.romanization, isTarget: true },
        ...distractors.map((candidate) => ({
          text: dictionaryForms ? candidate.word : matchCase(candidate.word, blank),
          romanization: candidate.romanization,
          isTarget: true,
        })),
      ],
      0,
      rng
    );

    return {
      kind: "fill",
      graded: true,
      before: sentence.text.slice(0, start),
      after: sentence.text.slice(end),
      blank,
      sentence: { text: sentence.text, romanization: sentence.romanization },
      translation: sentence.translation,
      options,
      answerId,
      ref: { kind: "word", key: word.key },
      explanation: explainWord({ ...word, word: blank }),
    };
  }

  return null;
}

function sameMultiset(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

function buildStep(info: SentenceInfo, all: SentenceInfo[], words: PlanWord[], language: string, rng: Rng): Draft<BuildStep> | null {
  const { sentence, tokens } = info;
  if (tokens.length < 2 || tokens.length > MAX_BUILD_TOKENS) {
    return null;
  }

  const answerNorms = tokens.map((token) => token.norm);
  const inSentence = new Set(answerNorms);
  const wordTokens = words.flatMap((word) => {
    const parts = tokenizeSentence(word.word, language);
    return parts.length === 1 ? parts : [];
  });
  const otherTokens = all.filter((other) => other.index !== info.index).flatMap((other) => other.tokens);
  const distractorCount = tokens.length >= 7 ? 1 : 2;
  const distractors = pickDistractors({
    answerKey: "",
    candidates: [...shuffle(wordTokens, rng), ...shuffle(otherTokens, rng)].filter((token) => !inSentence.has(token.norm)),
    keyOf: (token) => token.norm,
    count: distractorCount,
    rng,
  });

  const tiles = [...tokens, ...distractors].map((token) => token.core);
  let order = shuffle(
    tiles.map((text, index) => ({ text, index })),
    rng
  );
  for (let tries = 0; tries < 5 && order.slice(0, tokens.length).every((tile, position) => tile.index === position); tries += 1) {
    order = shuffle(order, rng);
  }

  const solutions = [answerNorms];
  for (const alternative of sentence.alternatives) {
    const norms = tokenizeSentence(alternative, language).map((token) => token.norm);
    if (sameMultiset(norms, answerNorms) && !solutions.some((solution) => solution.join(" ") === norms.join(" "))) {
      solutions.push(norms);
    }
  }

  return {
    kind: "build",
    graded: true,
    translation: sentence.translation,
    sentence: { text: sentence.text, romanization: sentence.romanization },
    tiles: order.map((tile, position) => ({ id: `t${position + 1}`, text: tile.text })),
    solutions,
    ref: { kind: "sentence", index: info.index },
    explanation: null,
  };
}

function typeStep(word: PlanWord): Draft<TypeStep> {
  return {
    kind: "type",
    graded: true,
    prompt: word.translation,
    answer: word.word,
    accepted: word.alternatives,
    ref: { kind: "word", key: word.key },
    explanation: explainWord(word),
  };
}

type Quota = "listen" | "review" | "fill" | "build" | "type";

/** Shrinks optional sections (keeping at least one of each first) until the lesson fits the budget. */
function fitQuotas(fixed: number, available: Record<Quota, number>, max: number): Record<Quota, number> {
  const quotas = { ...available };
  const total = () => fixed + Object.values(quotas).reduce((sum, value) => sum + value, 0);
  const softOrder: Quota[] = ["listen", "fill", "build", "type", "review"];
  const hardOrder: Quota[] = ["listen", "type", "review", "fill", "build"];

  let changed = true;
  while (total() > max && changed) {
    changed = false;
    for (const key of softOrder) {
      if (total() > max && quotas[key] > 1) {
        quotas[key] -= 1;
        changed = true;
      }
    }
  }

  for (const key of hardOrder) {
    while (total() > max && quotas[key] > 0) {
      quotas[key] -= 1;
    }
  }

  return quotas;
}

function interleave<T>(...lists: T[][]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      if (index < list.length) {
        result.push(list[index]);
      }
    }
  }
  return result;
}

export function buildLessonPlan(content: LessonContent, options: BuildPlanOptions): LessonPlan {
  const { language } = options;
  const rng = createRng(options.seed);
  const words = content.vocabulary.map((item) => toPlanWord(item, language));
  const lessonKeys = new Set(words.map((word) => word.key));
  const lessonMeanings = new Set(words.map((word) => normalizeForCompare(word.translation, "en")));

  const reviewWords = (options.reviewWords ?? [])
    .filter(
      (review) =>
        !lessonKeys.has(normalizeForCompare(review.word, language)) &&
        !lessonMeanings.has(normalizeForCompare(review.translation, "en"))
    )
    .slice(0, MAX_REVIEW_WORDS);

  const half = Math.ceil(words.length / 2);
  const groupA = words.slice(0, half);
  const groupB = words.slice(half);
  const reviewMeanings: Meaning[] = reviewWords.map((review) => ({
    word: review.word,
    translation: review.translation,
    romanization: review.romanization,
    // Review words have no description here; the picture already exists if it has a key.
    picture: review.imageKey ? { key: review.imageKey, description: "" } : null,
  }));

  const recognitionA = shuffle(groupA, rng)
    .map((word) => choiceToEnglish({ item: word, pool: [...words, ...reviewMeanings], language, rng, ref: { kind: "word", key: word.key }, isReview: false }))
    .filter((step): step is Draft<ChoiceStep> => Boolean(step));
  const recognitionB = shuffle(groupB, rng)
    .map((word) => choiceToTarget({ item: word, pool: words, language, rng, ref: { kind: "word", key: word.key }, isReview: false }))
    .filter((step): step is Draft<ChoiceStep> => Boolean(step));

  const match = matchStep(words, rng);

  const listenCandidates = shuffle(groupA, rng)
    .map((word) => listenStep(word, words, language, rng))
    .filter((step): step is Draft<ListenStep> => Boolean(step));

  const reviewCandidates = reviewWords
    .map((review, index) => {
      const ref = { kind: "review" as const, vocabId: review.id, word: review.word };
      return index % 2 === 0
        ? choiceToEnglish({ item: review, pool: [...words, ...reviewMeanings], language, rng, ref, isReview: true })
        : choiceToTarget({ item: reviewMeanings[index], pool: [...words, ...reviewMeanings], language, rng, ref, isReview: true });
    })
    .filter((step): step is Draft<ChoiceStep> => Boolean(step));

  const sentences: SentenceInfo[] = content.sentences.map((sentence, index) => ({
    index,
    sentence,
    tokens: tokenizeSentence(sentence.text, language, sentence.words),
  }));

  // Alternate sentences between fill and build so the two exercises rarely reuse a sentence.
  const fillCandidates: Draft<FillStep>[] = [];
  const buildCandidates: Draft<BuildStep>[] = [];
  for (const info of shuffle(sentences, rng)) {
    if (fillCandidates.length <= buildCandidates.length) {
      const fill = fillStep(info, words, language, rng);
      if (fill) {
        fillCandidates.push(fill);
        continue;
      }
    }

    const build = buildStep(info, sentences, words, language, rng);
    if (build) {
      buildCandidates.push(build);
    }
  }
  if (buildCandidates.length < 2) {
    for (const info of sentences) {
      if (buildCandidates.length >= 3) break;
      if (buildCandidates.some((step) => step.ref.kind === "sentence" && step.ref.index === info.index)) continue;
      const build = buildStep(info, sentences, words, language, rng);
      if (build) buildCandidates.push(build);
    }
  }

  const typeCandidates = supportsTypedRecall(language)
    ? shuffle(
        [...groupB, ...groupA].filter((word) => Array.from(word.word).length <= 24),
        rng
      )
        .slice(0, 2)
        .map(typeStep)
    : [];

  const fixed = recognitionA.length + recognitionB.length + (match ? 1 : 0);
  const quotas = fitQuotas(
    fixed,
    {
      listen: Math.min(2, listenCandidates.length),
      review: Math.min(MAX_REVIEW_WORDS, reviewCandidates.length),
      fill: Math.min(3, fillCandidates.length),
      build: Math.min(3, buildCandidates.length),
      type: Math.min(2, typeCandidates.length),
    },
    options.maxGraded ?? MAX_GRADED_EXERCISES
  );

  const intro = (word: PlanWord): Draft<IntroStep> => ({ kind: "intro", graded: false, word });
  const reviews = reviewCandidates.slice(0, quotas.review);
  const drafts: DraftStep[] = [
    ...groupA.map(intro),
    ...recognitionA,
    ...groupB.map(intro),
    ...recognitionB,
    ...(match ? [match] : []),
    ...reviews.slice(0, 1),
    ...listenCandidates.slice(0, quotas.listen),
    ...(content.tip ? [{ kind: "tip" as const, graded: false as const, title: content.tip.title, body: content.tip.body }] : []),
    ...interleave<DraftStep>(fillCandidates.slice(0, quotas.fill), buildCandidates.slice(0, quotas.build), reviews.slice(1)),
    ...typeCandidates.slice(0, quotas.type),
  ];

  const steps = drafts.map((draft, index) => {
    const id = `s${index + 1}-${draft.kind}`;
    if (draft.kind === "listen") {
      return { ...draft, id, fallback: { ...draft.fallback, id: `${id}-alt` } } as LessonStep;
    }
    return { ...draft, id } as LessonStep;
  });

  return {
    version: 1,
    lessonId: options.lessonId,
    unitId: options.unitId,
    language,
    title: content.title,
    steps,
    newWords: words,
    reviewWords: reviewWords.filter((review) => reviews.some((step) => step.ref.kind === "review" && step.ref.vocabId === review.id)),
    tip: content.tip,
    culture: content.culture,
  };
}

export function countGradedSteps(plan: Pick<LessonPlan, "steps">): number {
  return plan.steps.filter((step) => step.graded).length;
}
