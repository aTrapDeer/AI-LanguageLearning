import { XP_REWARDS, xpForChatTurns, xpForVoiceSession } from "@/lib/gamification";

/**
 * XP rules for chat and voice that live outside gamification.ts: daily caps so practice can't be
 * farmed, and what counts as a real turn. Pure.
 */

/** Rewarded learner turns per language per local day (2 XP each → 30 XP, one default daily goal). */
export const CHAT_XP_DAILY_TURN_CAP = 15;
/** Voice XP per language per local day, across sessions. */
export const VOICE_XP_DAILY_CAP = 60;
/** A voice session can't be credited for longer than this, however long it stayed open. */
export const VOICE_SESSION_MAX_MINUTES = XP_REWARDS.voiceSessionMax / XP_REWARDS.voicePerMinute;

const LETTER = /\p{L}/gu;

/**
 * A turn earns XP when it has at least two letters and is not a repeat of the learner's previous
 * message (so "a", "??" or pasting the same line again do not count).
 */
export function isMeaningfulTurn(message: string, previousLearnerMessage: string | null): boolean {
  const letters = message.match(LETTER)?.length ?? 0;
  if (letters < 2) {
    return false;
  }

  if (previousLearnerMessage && previousLearnerMessage.trim().toLocaleLowerCase() === message.trim().toLocaleLowerCase()) {
    return false;
  }

  return true;
}

export interface ChatTurnXp {
  xp: number;
  /** The learner has used up today's rewarded turns (including this one). */
  capReached: boolean;
  rewardedTurnsToday: number;
}

/** XP for one learner turn given how many turns were already counted today. */
export function chatTurnXp(turnsCountedBefore: number, meaningful: boolean): ChatTurnXp {
  const before = Math.max(0, Math.floor(turnsCountedBefore));
  if (!meaningful) {
    return { xp: 0, capReached: before >= CHAT_XP_DAILY_TURN_CAP, rewardedTurnsToday: Math.min(before, CHAT_XP_DAILY_TURN_CAP) };
  }

  const rewarded = before < CHAT_XP_DAILY_TURN_CAP;
  const after = Math.min(before + 1, CHAT_XP_DAILY_TURN_CAP);
  return {
    xp: rewarded ? xpForChatTurns(1) : 0,
    capReached: before + 1 >= CHAT_XP_DAILY_TURN_CAP,
    rewardedTurnsToday: after,
  };
}

export interface VoiceSessionXpInput {
  /** When the server started the session (SDP exchange succeeded). */
  startedAt: Date;
  /** When the server received the end request. */
  endedAt: Date;
  /** What the client says it was connected for; only ever lowers the credited time. */
  clientActiveSeconds?: number | null;
  /** Voice XP already awarded today for this language. */
  xpAwardedToday: number;
}

export interface VoiceSessionXp {
  xp: number;
  /** Credited duration in seconds. */
  seconds: number;
  capReached: boolean;
}

/** Voice XP from server-measured duration, capped per session and per day. */
export function voiceSessionXp(input: VoiceSessionXpInput): VoiceSessionXp {
  const serverSeconds = Math.max(0, (input.endedAt.getTime() - input.startedAt.getTime()) / 1000);
  const client = input.clientActiveSeconds;
  const clientSeconds = typeof client === "number" && Number.isFinite(client) && client >= 0 ? client : serverSeconds;
  const seconds = Math.min(serverSeconds, clientSeconds, VOICE_SESSION_MAX_MINUTES * 60);

  const remaining = Math.max(0, VOICE_XP_DAILY_CAP - Math.max(0, input.xpAwardedToday));
  const xp = Math.min(remaining, xpForVoiceSession(seconds / 60));

  return { xp, seconds: Math.round(seconds), capReached: remaining - xp <= 0 };
}
