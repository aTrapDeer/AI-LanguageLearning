import { describeUnitForPrompt, type CurriculumUnit } from "@/lib/curriculum";
import { getLanguageConfig } from "@/lib/language-config";
import { describeLevelForPrompt } from "@/lib/levels";
import { MAX_SENTENCES, MAX_VOCABULARY } from "./content";

/** Prompt for one lesson's content. The model writes material; the builder makes the exercises. */

const LANGUAGE_NOTES: Record<string, string> = {
  de: "Standard German. Give nouns with their article (der/die/das) in `word`. Capitalise nouns correctly.",
  "pt-BR": "Brazilian Portuguese (not European): Brazilian vocabulary, spelling and você.",
  zh: "Mandarin in Simplified characters. `romanization` is Hanyu Pinyin with tone marks (nǐ hǎo). `words` must split the sentence into words (not single characters, unless the word is one character), in order, without punctuation.",
  no: "Norwegian Bokmål.",
  ko: "Standard Seoul Korean in polite 해요체 unless the unit is about casual speech. `romanization` is Revised Romanization.",
  ar: "Modern Standard Arabic, not a dialect. Do not add full vowel marks; tanween on common words (شكرًا) is fine. `romanization` is a simple readable transliteration (marhaban, shukran).",
};

export interface LessonPromptInput {
  language: string;
  unit: CurriculumUnit;
  /** Words the learner already has, to reuse in sentences (not to teach again). */
  knownWords: string[];
  /** Words the learner keeps getting wrong. */
  weakWords: string[];
  /** Recent corrections, e.g. "ich bin gehen → ich gehe". */
  recentMistakes: string[];
  /** Feedback from a failed validation, for the second try. */
  retryFeedback?: string[];
}

export function buildLessonPrompt(input: LessonPromptInput): { system: string; user: string } {
  const config = getLanguageConfig(input.language);
  const languageName = config?.name ?? input.language;
  const needsRomanization = Boolean(config?.needsRomanization);

  const system = [
    `You are an expert ${languageName} teacher writing the material for one short lesson for an adult English speaker.`,
    "Write content only — the app builds the exercises from it. Everything must be correct, natural and level-appropriate; a learner will be graded against it.",
    "",
    "Rules:",
    `- vocabulary: ${MAX_VOCABULARY - 2}–${MAX_VOCABULARY} NEW items for this unit. \`word\` is one headword or fixed phrase exactly as written in ${languageName} — no slashes, brackets or notes. Put other accepted spellings or gender forms in \`alternatives\` (usually empty).`,
    "- `translation`: short English meaning (1–4 words). Every item must have a clearly different meaning; when two items differ only in politeness, label it, e.g. \"thank you (polite)\" and \"thanks (casual)\".",
    `- \`romanization\`/\`exampleRomanization\`/sentence \`romanization\`: ${needsRomanization ? "always provide it." : "always null."}`,
    "- `partOfSpeech`: noun, verb, adjective, adverb, phrase, interjection, pronoun, number…",
    "- `example`: a short sentence using the word, with `exampleTranslation`.",
    "- `picture`: only when the word can be shown clearly in a simple drawing with no writing — a concrete object, food, animal, place, person or simple action — a short English description of that drawing (3–12 words, e.g. \"a red apple\", \"a woman drinking a cup of coffee\"). It must show exactly the `translation`, nothing that needs letters or numbers. Otherwise null: greetings, polite phrases, function words, pronouns, numbers, time words, feelings and other abstract meanings are always null.",
    `- sentences: ${MAX_SENTENCES - 2}–${MAX_SENTENCES} short sentences (2–8 words), each using at least one of the new words, built from the new words and words the learner knows. One natural word order — avoid sentences whose words could just as well be arranged differently. Names and simple everyday words are fine.`,
    "- `focusWord`: one vocabulary `word` that appears in the sentence spelled exactly the same, or null.",
    "- `words`: the sentence split into words in order, without punctuation.",
    "- `alternatives`: other equally correct orderings of exactly the same words (usually empty).",
    "- tip: one grammar or usage point tied to the unit's grammar focus, 1–2 sentences, with an example from the lesson.",
    "- culture: one short, accurate culture note related to the unit (1–2 sentences). No stereotypes.",
    config ? `- ${LANGUAGE_NOTES[config.code] ?? ""}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const lines = [
    `Language: ${languageName}`,
    describeUnitForPrompt(input.unit),
    `Learner level: ${describeLevelForPrompt(input.unit.level)}`,
  ];

  if (input.knownWords.length > 0) {
    lines.push(`Words the learner already knows (reuse some in sentences; do not teach them as new): ${input.knownWords.join(", ")}`);
  }
  if (input.weakWords.length > 0) {
    lines.push(`Words the learner struggles with (recycle one or two in sentences if natural): ${input.weakWords.join(", ")}`);
  }
  if (input.recentMistakes.length > 0) {
    lines.push(`Recent mistakes (let a sentence model the correct form if it fits): ${input.recentMistakes.join("; ")}`);
  }
  if (input.retryFeedback && input.retryFeedback.length > 0) {
    lines.push(`Your previous attempt was rejected: ${input.retryFeedback.join("; ")}. Fix these problems.`);
  }

  return { system, user: lines.join("\n") };
}
