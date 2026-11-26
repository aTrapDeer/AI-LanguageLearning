/**
 * Server-only: generates new review words for the learner's level and current curriculum unit,
 * skipping words already in their deck, and saves them to the deck.
 */

import { z } from "zod";
import { describeUnitForPrompt } from "../curriculum";
import { getProgress, listKnownWords, upsertVocabulary, type VocabularyItem } from "../database";
import { getUnitProgress } from "../db/unit-progress";
import { normalizeVocabularyKey } from "../exercise-text";
import { getLevelProgress } from "../gamification";
import { getLanguageConfig } from "../language-config";
import { clampLevel, describeLevelForPrompt } from "../levels";
import { generateJson } from "../openai";

const GeneratedWordsSchema = z.object({
  words: z
    .array(
      z.object({
        word: z.string().min(1).max(80),
        translation: z.string().min(1).max(160),
        romanization: z.string().max(120).nullable(),
        exampleSentence: z.string().min(1).max(240),
        exampleTranslation: z.string().min(1).max(240),
      })
    )
    .min(1)
    .max(20),
});

export type GeneratedWord = z.infer<typeof GeneratedWordsSchema>["words"][number];

export function buildWordPrompt(params: {
  languageName: string;
  levelDescription: string;
  unitDescription: string | null;
  count: number;
  romanizationName: string | null;
  avoid: string[];
}): { system: string; user: string } {
  const system = [
    `You write vocabulary flashcards for an English speaker learning ${params.languageName}.`,
    "Pick useful, high-frequency words or short fixed phrases a learner at this level should learn next.",
    "Each card: the word in its dictionary form (with article or gender marker if the language uses one), a short English meaning,",
    "one natural example sentence at the learner's level that uses the word, and its English translation.",
    params.romanizationName
      ? `Always give the ${params.romanizationName} reading in "romanization" for the word (not the sentence).`
      : 'Set "romanization" to null.',
    "Never repeat a word the learner already knows.",
  ].join(" ");

  const user = [
    `Learner level: ${params.levelDescription}`,
    params.unitDescription ? `Current lesson topic (prefer words for this):\n${params.unitDescription}` : null,
    `Write exactly ${params.count} new cards.`,
    params.avoid.length > 0 ? `Words the learner already has (do not use these): ${params.avoid.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

/** Removes words the learner already has and duplicates within the batch. */
export function filterNewWords(words: GeneratedWord[], known: readonly string[]): GeneratedWord[] {
  const seen = new Set(known.map(normalizeVocabularyKey));
  return words.filter((entry) => {
    const key = normalizeVocabularyKey(entry.word);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function generateReviewWords(params: {
  userId: string;
  language: string;
  count: number;
}): Promise<VocabularyItem[]> {
  const config = getLanguageConfig(params.language);
  if (!config || params.count <= 0) {
    return [];
  }

  const [progress, unitProgress, known] = await Promise.all([
    getProgress(params.userId, params.language),
    getUnitProgress(params.userId, params.language),
    listKnownWords(params.userId, params.language, 300),
  ]);

  const level = clampLevel(progress?.level ?? 1);
  const unit = getLevelProgress(level, unitProgress.completedUnitIds).nextUnit;
  const prompt = buildWordPrompt({
    languageName: config.name,
    levelDescription: describeLevelForPrompt(level),
    unitDescription: unit ? describeUnitForPrompt(unit) : null,
    count: params.count,
    romanizationName: config.needsRomanization ? config.romanizationName : null,
    avoid: known.slice(0, 200),
  });

  const generated = await generateJson({
    schema: GeneratedWordsSchema,
    schemaName: "review_words",
    system: prompt.system,
    user: prompt.user,
    temperature: 0.7,
  });

  const fresh = filterNewWords(generated.words, known).slice(0, params.count);
  if (fresh.length === 0) {
    return [];
  }

  const saved = await upsertVocabulary({
    userId: params.userId,
    language: params.language,
    source: "flashcards",
    items: fresh.map((entry) => ({
      word: entry.word,
      translation: entry.translation,
      romanization: config.needsRomanization ? entry.romanization : null,
      exampleSentence: entry.exampleSentence,
      exampleTranslation: entry.exampleTranslation,
      unitId: unit?.id ?? null,
    })),
  });

  return saved.items;
}
