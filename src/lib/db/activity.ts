import {
  computeStreak,
  DEFAULT_DAILY_XP_GOAL,
  didReachGoal,
  type ActivityKind,
  type StreakInfo,
} from "../gamification";
import { clampLevel } from "../levels";
import { resolveLocalDate } from "../local-date";
import { asNumber, createId, executeBatch, getFirstRow, getRows, nowIso } from "./client";
import { advanceLevelIfEligible } from "./unit-progress";

/**
 * Streaks and the daily goal are per learner across all languages (practising any language keeps the
 * streak alive); XP and level are per language.
 */

const COUNT_COLUMN: Record<ActivityKind, string> = {
  lesson: "lessons",
  review: "reviews",
  chat: "chat_messages",
  voice: "voice_sessions",
  flashcards: "flashcards",
};

export interface RecordActivityInput {
  userId: string;
  language: string;
  kind: ActivityKind;
  /** XP earned by this activity; negative values are treated as 0. */
  xp: number;
  /** The client's local `YYYY-MM-DD`; validated with `resolveLocalDate`, falls back to UTC today. */
  localDate?: string | null;
  /** How many units of `kind` to add to today's counters (lessons, review items, messages…). Default 1. */
  count?: number;
  /** Check the curriculum level-up rule after recording. Default: true for lessons only. */
  evaluateLevelUp?: boolean;
  now?: Date;
}

export interface ActivityResult {
  xpGained: number;
  /** Cumulative XP for this language after the gain. */
  totalXp: number;
  level: number;
  previousLevel: number;
  leveledUp: boolean;
  streak: StreakInfo;
  /** XP earned today across all languages. */
  dailyXp: number;
  dailyGoal: number;
  /** This call crossed the daily goal. */
  goalJustReached: boolean;
  localDate: string;
}

export async function getDailyXpGoal(userId: string): Promise<number> {
  const row = await getFirstRow("SELECT daily_xp_goal FROM users WHERE id = ? LIMIT 1", [userId]);
  const goal = asNumber(row?.daily_xp_goal, 0);
  return goal > 0 ? goal : DEFAULT_DAILY_XP_GOAL;
}

export async function getDailyXp(userId: string, localDate: string): Promise<number> {
  const row = await getFirstRow(
    "SELECT COALESCE(SUM(xp), 0) AS xp FROM daily_activity WHERE user_id = ? AND local_date = ?",
    [userId, localDate]
  );
  return asNumber(row?.xp, 0);
}

/** Streak for `today` (a validated local date), computed from every active day on record. */
export async function getStreak(userId: string, today: string): Promise<StreakInfo> {
  const rows = await getRows(
    `SELECT DISTINCT local_date FROM daily_activity
      WHERE user_id = ? AND local_date <= ?
        AND (xp > 0 OR lessons > 0 OR reviews > 0 OR chat_messages > 0 OR voice_sessions > 0 OR flashcards > 0)
      ORDER BY local_date DESC
      LIMIT 3660`,
    [userId, today]
  );

  return computeStreak(
    rows.map((row) => String(row.local_date)),
    today
  );
}

/**
 * The single write path for learning activity: atomically adds XP to `progress` (creating the row at
 * level 1 if needed) and to today's `daily_activity` row, then reports streak, daily goal and level-up.
 */
export async function recordActivity(input: RecordActivityInput): Promise<ActivityResult> {
  const now = input.now ?? new Date();
  const timestamp = nowIso(now);
  const localDate = resolveLocalDate(input.localDate, now);
  const xp = Math.max(0, Math.round(Number.isFinite(input.xp) ? input.xp : 0));
  const count = Math.max(0, Math.round(input.count ?? 1));
  const column = COUNT_COLUMN[input.kind];

  const [beforeResult, , , progressResult, afterResult] = await executeBatch([
    {
      sql: "SELECT COALESCE(SUM(xp), 0) AS xp FROM daily_activity WHERE user_id = ? AND local_date = ?",
      args: [input.userId, localDate],
    },
    {
      sql: `INSERT INTO progress (id, user_id, language, level, xp, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(user_id, language) DO UPDATE SET xp = progress.xp + excluded.xp, updated_at = excluded.updated_at`,
      args: [createId(), input.userId, input.language, xp, timestamp, timestamp],
    },
    {
      sql: `INSERT INTO daily_activity (id, user_id, language, local_date, xp, ${column}, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, language, local_date) DO UPDATE SET
          xp = daily_activity.xp + excluded.xp,
          ${column} = daily_activity.${column} + excluded.${column},
          updated_at = excluded.updated_at`,
      args: [createId(), input.userId, input.language, localDate, xp, count, timestamp, timestamp],
    },
    {
      sql: "SELECT level, xp FROM progress WHERE user_id = ? AND language = ? LIMIT 1",
      args: [input.userId, input.language],
    },
    {
      sql: "SELECT COALESCE(SUM(xp), 0) AS xp FROM daily_activity WHERE user_id = ? AND local_date = ?",
      args: [input.userId, localDate],
    },
  ]);

  const dailyXpBefore = asNumber(beforeResult.rows[0]?.xp, 0);
  const dailyXp = asNumber(afterResult.rows[0]?.xp, 0);
  const progressRow = progressResult.rows[0] as Record<string, unknown> | undefined;
  const totalXp = asNumber(progressRow?.xp, xp);
  let level = clampLevel(asNumber(progressRow?.level, 1));
  const previousLevel = level;
  let leveledUp = false;

  if (input.evaluateLevelUp ?? input.kind === "lesson") {
    const levelUp = await advanceLevelIfEligible(input.userId, input.language);
    leveledUp = levelUp.leveledUp;
    level = levelUp.level;
  }

  const [streak, dailyGoal] = await Promise.all([getStreak(input.userId, localDate), getDailyXpGoal(input.userId)]);

  return {
    xpGained: xp,
    totalXp,
    level,
    previousLevel,
    leveledUp,
    streak,
    dailyXp,
    dailyGoal,
    goalJustReached: didReachGoal(dailyXpBefore, dailyXp, dailyGoal),
    localDate,
  };
}
