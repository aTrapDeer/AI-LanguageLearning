import type { TutorReply } from "./schema";
import type { TutorScenarioId } from "./scenarios";

/** JSON shapes shared by the tutor API routes and the chat UI. Client-safe. */

export interface TutorSessionMetadata {
  scenarioId: TutorScenarioId;
  unitId: string | null;
}

export interface TutorMessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present on tutor messages. */
  payload: TutorReply | null;
  createdAt: string;
}

export interface TutorSessionDto {
  id: string;
  scenarioId: TutorScenarioId;
  unitId: string | null;
  title: string;
  createdAt: string;
}

export interface TutorUnitDto {
  id: string;
  title: string;
  emoji: string;
  goal: string;
}

export interface TutorStateResponse {
  /** False when no OpenAI key is configured: show the "tutor unavailable" state. */
  available: boolean;
  language: string;
  levelLabel: string;
  currentUnit: TutorUnitDto | null;
  session: TutorSessionDto | null;
  messages: TutorMessageDto[];
  /** Normalised forms of words from these messages that are already in the review deck. */
  savedWords: string[];
  xp: { rewardedTurnsToday: number; dailyTurnCap: number };
}

export interface TutorActivityDto {
  xpGained: number;
  dailyXp: number;
  dailyGoal: number;
  goalJustReached: boolean;
  streak: number;
  /** Today's rewarded chat turns are used up. */
  capReached: boolean;
}

export interface TutorStartResponse {
  session: TutorSessionDto;
  messages: TutorMessageDto[];
}

export interface TutorTurnResponse {
  userMessage: TutorMessageDto;
  assistantMessage: TutorMessageDto;
  activity: TutorActivityDto | null;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}
