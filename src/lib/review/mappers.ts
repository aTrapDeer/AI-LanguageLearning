import type { VocabularyItem } from "../db/vocabulary";
import { cardDirection } from "./plan";
import type { ReviewCardData, VocabularyListItem } from "./types";

export function toReviewCard(item: VocabularyItem, imageUrl: string | null = null): ReviewCardData {
  return {
    id: item.id,
    word: item.word,
    translation: item.translation,
    romanization: item.romanization,
    exampleSentence: item.exampleSentence,
    exampleTranslation: item.exampleTranslation,
    imageUrl,
    maturity: item.maturity,
    direction: cardDirection(item.maturity),
    srs: { intervalDays: item.intervalDays, ease: item.ease, repetitions: item.repetitions, lapses: item.lapses },
  };
}

export function toVocabularyListItem(item: VocabularyItem): VocabularyListItem {
  return {
    id: item.id,
    word: item.word,
    translation: item.translation,
    romanization: item.romanization,
    exampleSentence: item.exampleSentence,
    maturity: item.maturity,
    source: item.source,
    nextReview: item.nextReview,
    lapses: item.lapses,
  };
}
