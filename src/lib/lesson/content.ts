import { z } from "zod";
import { getLanguageConfig } from "@/lib/language-config";
import { collapseSpaces, isInTargetScript, isLatinText, normalizeForCompare, tokenizeSentence } from "./text";

/**
 * Lesson content: what the model (or a hand-written starter) provides. Content only — no indices,
 * distractors or answer keys; the builder derives exercises from it deterministically.
 */

export const LESSON_CONTENT_VERSION = 1;

export const MIN_VOCABULARY = 4;
export const MAX_VOCABULARY = 8;
export const MIN_SENTENCES = 3;
export const MAX_SENTENCES = 8;
const MAX_SENTENCE_TOKENS = 14;

/** Strict-structured-output compatible: every property required, nullables instead of optionals. */
export const generatedLessonContentSchema = z.object({
  title: z.string(),
  vocabulary: z.array(
    z.object({
      word: z.string(),
      translation: z.string(),
      romanization: z.string().nullable(),
      partOfSpeech: z.string(),
      alternatives: z.array(z.string()),
      example: z.string(),
      exampleTranslation: z.string(),
      exampleRomanization: z.string().nullable(),
    })
  ),
  sentences: z.array(
    z.object({
      text: z.string(),
      translation: z.string(),
      romanization: z.string().nullable(),
      words: z.array(z.string()),
      focusWord: z.string().nullable(),
      alternatives: z.array(z.string()),
    })
  ),
  tip: z.object({ title: z.string(), body: z.string() }),
  culture: z.string(),
});

export type GeneratedLessonContent = z.infer<typeof generatedLessonContentSchema>;

export interface LessonVocabularyItem {
  word: string;
  translation: string;
  romanization: string | null;
  partOfSpeech: string;
  alternatives: string[];
  example: string | null;
  exampleTranslation: string | null;
  exampleRomanization: string | null;
}

export interface LessonSentence {
  text: string;
  translation: string;
  romanization: string | null;
  /** Word segmentation from the content; only used where the script has no spaces. */
  words: string[];
  focusWord: string | null;
  /** Other correct orderings of the same words. */
  alternatives: string[];
}

/** Validated, cleaned content as stored in `lessons.content`. */
export interface LessonContent {
  title: string;
  vocabulary: LessonVocabularyItem[];
  sentences: LessonSentence[];
  tip: { title: string; body: string } | null;
  culture: string | null;
}

export type ContentValidation =
  | { ok: true; content: LessonContent; warnings: string[] }
  | { ok: false; errors: string[] };

function clean(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const collapsed = collapseSpaces(value);
  return collapsed && collapsed.length <= maxLength ? collapsed : null;
}

/** "Obrigado / Obrigada" or "Tschüss (informal)" → a single headword plus alternatives. */
function splitHeadword(raw: string): { word: string; extra: string[] } {
  const withoutNotes = raw.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const parts = withoutNotes
    .split(/\s*\/\s*/)
    .map((part) => collapseSpaces(part))
    .filter(Boolean);
  return { word: parts[0] ?? "", extra: parts.slice(1) };
}

function cleanRomanization(value: string | null | undefined, needsRomanization: boolean): string | null {
  if (!needsRomanization) {
    return null;
  }

  const cleaned = clean(value, 120);
  return cleaned && isLatinText(cleaned) ? cleaned : null;
}

/**
 * Checks and cleans content for a language. Items that could produce a broken exercise (wrong script,
 * duplicate words or meanings, overlong sentences) are dropped; content with too little left fails.
 */
export function validateLessonContent(raw: unknown, language: string): ContentValidation {
  const parsed = generatedLessonContentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 6).map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }

  const config = getLanguageConfig(language);
  if (!config) {
    return { ok: false, errors: [`unsupported language ${language}`] };
  }

  const needsRomanization = config.needsRomanization;
  const warnings: string[] = [];
  const data = parsed.data;

  const vocabulary: LessonVocabularyItem[] = [];
  const seenWords = new Set<string>();
  const seenMeanings = new Set<string>();

  for (const item of data.vocabulary) {
    const { word, extra } = splitHeadword(item.word ?? "");
    const translation = clean(item.translation, 60);
    if (!word || word.length > 40 || !translation) {
      warnings.push(`vocabulary "${item.word}": missing or too long`);
      continue;
    }

    if (!isInTargetScript(word, language) || !isLatinText(translation)) {
      warnings.push(`vocabulary "${word}": wrong script`);
      continue;
    }

    const wordKey = normalizeForCompare(word, language);
    const meaningKey = normalizeForCompare(translation, "en");
    if (!wordKey || seenWords.has(wordKey) || seenMeanings.has(meaningKey)) {
      warnings.push(`vocabulary "${word}": duplicate word or meaning`);
      continue;
    }

    const alternatives = Array.from(
      new Set(
        [...extra, ...(item.alternatives ?? [])]
          .map((alternative) => clean(alternative, 40))
          .filter((alternative): alternative is string => Boolean(alternative))
          .filter((alternative) => isInTargetScript(alternative, language))
          .filter((alternative) => normalizeForCompare(alternative, language) !== wordKey)
      )
    ).slice(0, 4);

    const example = clean(item.example, 200);
    const exampleOk = Boolean(example && isInTargetScript(example, language));
    const exampleTranslation = exampleOk ? clean(item.exampleTranslation, 200) : null;

    seenWords.add(wordKey);
    seenMeanings.add(meaningKey);
    vocabulary.push({
      word,
      translation,
      romanization: cleanRomanization(item.romanization, needsRomanization),
      partOfSpeech: clean(item.partOfSpeech, 30)?.toLowerCase() ?? "phrase",
      alternatives,
      example: exampleOk ? example : null,
      exampleTranslation,
      exampleRomanization: exampleOk ? cleanRomanization(item.exampleRomanization, needsRomanization) : null,
    });

    if (vocabulary.length >= MAX_VOCABULARY) {
      break;
    }
  }

  const sentences: LessonSentence[] = [];
  const seenSentences = new Set<string>();
  for (const sentence of data.sentences) {
    const text = clean(sentence.text, 160);
    const translation = clean(sentence.translation, 200);
    if (!text || !translation || !isInTargetScript(text, language) || !isLatinText(translation)) {
      warnings.push(`sentence "${sentence.text}": missing text/translation or wrong script`);
      continue;
    }

    const key = normalizeForCompare(text, language);
    if (seenSentences.has(key)) {
      continue;
    }

    const words = (sentence.words ?? []).map((word) => collapseSpaces(word)).filter(Boolean);
    const tokens = tokenizeSentence(text, language, words);
    if (tokens.length === 0 || tokens.length > MAX_SENTENCE_TOKENS) {
      warnings.push(`sentence "${text}": ${tokens.length} words`);
      continue;
    }

    seenSentences.add(key);
    sentences.push({
      text,
      translation,
      romanization: cleanRomanization(sentence.romanization, needsRomanization),
      words,
      focusWord: clean(sentence.focusWord, 40),
      alternatives: (sentence.alternatives ?? [])
        .map((alternative) => clean(alternative, 160))
        .filter((alternative): alternative is string => Boolean(alternative && isInTargetScript(alternative, language)))
        .slice(0, 3),
    });

    if (sentences.length >= MAX_SENTENCES) {
      break;
    }
  }

  const errors: string[] = [];
  if (vocabulary.length < MIN_VOCABULARY) {
    errors.push(`only ${vocabulary.length} usable vocabulary items (need ${MIN_VOCABULARY})`);
  }
  if (sentences.length < MIN_SENTENCES) {
    errors.push(`only ${sentences.length} usable sentences (need ${MIN_SENTENCES})`);
  }
  if (errors.length > 0) {
    return { ok: false, errors: [...errors, ...warnings.slice(0, 6)] };
  }

  const tipTitle = clean(data.tip?.title, 80);
  const tipBody = clean(data.tip?.body, 400);

  return {
    ok: true,
    warnings,
    content: {
      title: clean(data.title, 80) ?? "",
      vocabulary,
      sentences,
      tip: tipTitle && tipBody ? { title: tipTitle, body: tipBody } : null,
      culture: clean(data.culture, 400),
    },
  };
}

/** Stored content round-trips through the generated schema (tip/culture may be null when stored). */
export function validateStoredContent(stored: unknown, language: string): LessonContent | null {
  if (!stored || typeof stored !== "object") {
    return null;
  }

  const value = stored as Partial<LessonContent>;
  const asGenerated = {
    ...value,
    tip: value.tip ?? { title: "", body: "" },
    culture: value.culture ?? "",
    vocabulary: (value.vocabulary ?? []).map((item) => ({
      ...item,
      example: item?.example ?? "",
      exampleTranslation: item?.exampleTranslation ?? "",
    })),
  };
  const result = validateLessonContent(asGenerated, language);
  return result.ok ? result.content : null;
}
