/** JSON shapes exchanged between the review API routes and the review UI. Client-safe. */

import type { Maturity, ReviewGrade, SrsState } from "../srs";

/** recognize: show the target word, recall the meaning. produce: show the meaning, recall the word. */
export type CardDirection = "recognize" | "produce";

export interface ReviewCardData {
  id: string;
  word: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  maturity: Maturity;
  direction: CardDirection;
  srs: SrsState;
}

export interface ReviewSessionData {
  sessionId: string;
  language: string;
  cards: ReviewCardData[];
  /** Words generated for this session because the deck was thin. */
  newWordsAdded: number;
}

export type StartSessionResponse =
  | { status: "ready"; session: ReviewSessionData }
  /** The deck has words but none are due. */
  | { status: "caught_up"; nextDueAt: string | null; deckSize: number; canAddNewWords: boolean }
  /** No words in the deck and none could be generated. */
  | { status: "empty"; canAddNewWords: boolean; message: string | null };

export interface GradeResponse {
  itemId: string;
  grade: ReviewGrade;
  /** The server keeps the card in this session (it was graded "again" and has tries left). */
  requeue: boolean;
  srs: SrsState;
  maturity: Maturity;
  nextReview: string;
}

export interface CompleteResponse {
  reviewed: number;
  correct: number;
  /** 0..1 */
  accuracy: number;
  xpGained: number;
  totalXp: number | null;
  streak: { current: number; longest: number; todayDone: boolean } | null;
  /** Today's activity was the one that extended the streak. */
  streakExtended: boolean;
  dailyXp: number | null;
  dailyGoal: number | null;
  goalJustReached: boolean;
  /** Cards due right now after this session. */
  dueCount: number;
  /** Earliest upcoming review (ISO), or null when the deck is empty. */
  nextDueAt: string | null;
}

export interface ReviewStatusResponse {
  language: string;
  dueCount: number;
  nextDueAt: string | null;
  deckSize: number;
  /** New words can be generated right now (AI configured and today's cap not reached). */
  canAddNewWords: boolean;
}

export interface VocabularyListItem {
  id: string;
  word: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  maturity: Maturity;
  source: string;
  nextReview: string;
  lapses: number;
}

export interface VocabularyListResponse {
  counts: { total: number; new: number; learning: number; young: number; mature: number };
  weakest: VocabularyListItem[];
  items: VocabularyListItem[];
  hasMore: boolean;
}

export interface DailyHistoryEntry {
  date: string;
  xp: number;
  goalMet: boolean;
}

export interface GoalResponse {
  goal: number;
  options: number[];
  /** Oldest first, ending today. */
  history: DailyHistoryEntry[];
}
