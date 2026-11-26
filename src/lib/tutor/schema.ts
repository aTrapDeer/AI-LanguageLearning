import { z } from "zod";

/**
 * Structured tutor turn. Strict structured outputs require every property to be present, so optional
 * values are `.nullable()`; length limits are applied after parsing by {@link normalizeTutorReply}
 * rather than in the JSON schema.
 */

export const MAX_CORRECTIONS = 2;
export const MAX_SUGGESTIONS = 3;
export const MAX_VOCABULARY = 3;

/** Mirrors MISTAKE_KINDS in db/mistakes (kept separate so this module stays client-safe; a test keeps them equal). */
export const TUTOR_MISTAKE_KINDS = ["grammar", "vocabulary", "spelling", "word_order", "pronunciation", "other"] as const;

// A refinement rather than .min(1): it is enforced locally (triggering generateJson's retry) without
// adding a minLength keyword that strict structured outputs may reject. A factory, not a shared
// instance, so the JSON schema inlines each field instead of emitting $ref definitions.
const nonEmpty = () => z.string().refine((value) => value.trim().length > 0, "must not be empty");

export const TutorCorrectionSchema = z.object({
  original: nonEmpty().describe("The learner's wrong words, quoted exactly from their latest message."),
  corrected: nonEmpty().describe("The corrected version of that phrase."),
  explanation: nonEmpty().describe("One short, friendly sentence in English explaining why."),
  kind: z.enum(TUTOR_MISTAKE_KINDS),
});

export const TutorSuggestionSchema = z.object({
  text: nonEmpty().describe("Something short the learner could say next, in the target language."),
  translation: nonEmpty().describe("English meaning."),
  romanization: z.string().nullable(),
});

export const TutorVocabularySchema = z.object({
  word: nonEmpty().describe("A useful word or short phrase from the reply, in dictionary form."),
  translation: nonEmpty().describe("English meaning."),
  romanization: z.string().nullable(),
});

export const TutorReplySchema = z.object({
  reply: nonEmpty().describe("Your conversational reply, written only in the target language."),
  romanization: z.string().nullable(),
  translation: nonEmpty().describe("Natural English translation of `reply`."),
  tip: z.string().nullable().describe("Optional short coaching note in English, or null."),
  praise: z.string().nullable().describe("Short English praise when the learner's latest message was correct, else null."),
  corrections: z.array(TutorCorrectionSchema),
  suggestions: z.array(TutorSuggestionSchema),
  vocabulary: z.array(TutorVocabularySchema),
});

export type TutorCorrection = z.infer<typeof TutorCorrectionSchema>;
export type TutorSuggestion = z.infer<typeof TutorSuggestionSchema>;
export type TutorVocabulary = z.infer<typeof TutorVocabularySchema>;
export type TutorReply = z.infer<typeof TutorReplySchema>;

function cleanNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sameText(a: string, b: string) {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * Enforces the limits the schema can't: caps list lengths, drops no-op corrections and duplicate
 * words, and strips romanization for languages written in Latin script (models sometimes echo the
 * text there). Praise and corrections are mutually exclusive.
 */
export function normalizeTutorReply(reply: TutorReply, options: { needsRomanization: boolean }): TutorReply {
  const romanize = (value: string | null) => (options.needsRomanization ? cleanNullable(value) : null);

  const corrections = reply.corrections
    .filter((correction) => !sameText(correction.original, correction.corrected))
    .slice(0, MAX_CORRECTIONS);

  const seenWords = new Set<string>();
  const vocabulary = reply.vocabulary
    .filter((item) => {
      const key = item.word.trim().toLocaleLowerCase();
      if (seenWords.has(key)) return false;
      seenWords.add(key);
      return true;
    })
    .slice(0, MAX_VOCABULARY)
    .map((item) => ({ ...item, romanization: romanize(item.romanization) }));

  return {
    reply: reply.reply.trim(),
    romanization: romanize(reply.romanization),
    translation: reply.translation.trim(),
    tip: cleanNullable(reply.tip),
    praise: corrections.length > 0 ? null : cleanNullable(reply.praise),
    corrections,
    suggestions: reply.suggestions
      .slice(0, MAX_SUGGESTIONS)
      .map((suggestion) => ({ ...suggestion, romanization: romanize(suggestion.romanization) })),
    vocabulary,
  };
}

/** Defensive read of a stored payload (rows written by older code may be missing fields). */
export function readTutorPayload(value: unknown): TutorReply | null {
  const parsed = TutorReplySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
