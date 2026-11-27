import { getUtcDateString } from "../local-date";
import { asNumber, execute, getFirstRow, nowIso } from "./client";

/**
 * Per-user daily caps on paid AI calls. Counted per UTC day (this protects spend, not streaks).
 * Override a default with AI_DAILY_LIMIT_<KIND>, e.g. AI_DAILY_LIMIT_TEXT=1000; a value <= 0 disables
 * the cap for that kind.
 */

export const AI_QUOTA_KINDS = ["text", "speech", "transcription", "realtime", "image"] as const;
export type AiQuotaKind = (typeof AI_QUOTA_KINDS)[number];

export const DEFAULT_AI_DAILY_LIMITS: Readonly<Record<AiQuotaKind, number>> = {
  /** Chat completions: lesson generation, tutor replies, translations. */
  text: 400,
  /** Text-to-speech generations. */
  speech: 300,
  /** Uploaded-audio transcriptions. */
  transcription: 300,
  /** Realtime voice sessions started. */
  realtime: 30,
  /** Vocabulary pictures generated (each picture is generated once and then shared by everyone). */
  image: 40,
};

/** Effective limit for `kind`, or null when uncapped. */
export function getAiDailyLimit(kind: AiQuotaKind, env: Record<string, string | undefined> = process.env): number | null {
  const raw = env[`AI_DAILY_LIMIT_${kind.toUpperCase()}`]?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      return parsed <= 0 ? null : parsed;
    }
  }

  return DEFAULT_AI_DAILY_LIMITS[kind];
}

export interface AiQuotaResult {
  allowed: boolean;
  kind: AiQuotaKind;
  used: number;
  /** null = uncapped */
  limit: number | null;
  remaining: number | null;
  /** UTC date the counter belongs to. */
  usageDate: string;
}

export async function getAiUsage(userId: string, kind: AiQuotaKind, now: Date = new Date()): Promise<number> {
  const row = await getFirstRow(
    "SELECT count FROM ai_usage WHERE user_id = ? AND usage_date = ? AND kind = ? LIMIT 1",
    [userId, getUtcDateString(now), kind]
  );
  return asNumber(row?.count, 0);
}

/**
 * Atomically reserves `cost` units of today's quota. When the cap would be exceeded nothing is
 * consumed and `allowed` is false. Call this before spending money on an API call.
 */
export async function consumeAiQuota(params: {
  userId: string;
  kind: AiQuotaKind;
  cost?: number;
  now?: Date;
}): Promise<AiQuotaResult> {
  const now = params.now ?? new Date();
  const usageDate = getUtcDateString(now);
  const cost = Math.max(1, Math.round(params.cost ?? 1));
  const limit = getAiDailyLimit(params.kind);

  if (limit !== null && cost > limit) {
    const used = await getAiUsage(params.userId, params.kind, now);
    return { allowed: false, kind: params.kind, used, limit, remaining: Math.max(0, limit - used), usageDate };
  }

  const result = await execute(
    `INSERT INTO ai_usage (user_id, usage_date, kind, count, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, usage_date, kind) DO UPDATE SET
        count = ai_usage.count + excluded.count,
        updated_at = excluded.updated_at
      WHERE ? IS NULL OR ai_usage.count + excluded.count <= ?
      RETURNING count`,
    [params.userId, usageDate, params.kind, cost, nowIso(now), limit, limit]
  );

  if (result.rows.length > 0) {
    const used = asNumber((result.rows[0] as Record<string, unknown>).count, cost);
    return {
      allowed: true,
      kind: params.kind,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      usageDate,
    };
  }

  const used = await getAiUsage(params.userId, params.kind, now);
  return { allowed: false, kind: params.kind, used, limit, remaining: limit === null ? null : Math.max(0, limit - used), usageDate };
}
