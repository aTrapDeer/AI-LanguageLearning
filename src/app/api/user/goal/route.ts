import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { getDailyXpGoal, setDailyXpGoal } from "@/lib/database";
import { DAILY_XP_GOAL_OPTIONS } from "@/lib/gamification";
import { resolveLocalDate } from "@/lib/local-date";
import { listDailyHistory } from "@/lib/review/store";
import type { GoalResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";

async function buildResponse(userId: string, localDate: string | null): Promise<GoalResponse> {
  const goal = await getDailyXpGoal(userId);
  const history = await listDailyHistory({ userId, today: resolveLocalDate(localDate), days: 7, goal });
  return { goal, options: [...DAILY_XP_GOAL_OPTIONS], history };
}

/** GET /api/user/goal?localDate=2026-11-26 → GoalResponse (daily goal plus the last 7 days of XP). */
export async function GET(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const localDate = new URL(req.url).searchParams.get("localDate");
    return NextResponse.json(await buildResponse(auth.userId, localDate), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GOAL_GET]", error);
    return jsonError(500, "Failed to load your daily goal");
  }
}

const SetGoalSchema = z.object({
  goal: z
    .number()
    .int()
    .refine((value) => (DAILY_XP_GOAL_OPTIONS as readonly number[]).includes(value), "Pick one of the goal options"),
  localDate: z.string().max(10).nullish(),
});

/** PUT /api/user/goal { goal, localDate? } → GoalResponse. */
export async function PUT(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = SetGoalSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }

    await setDailyXpGoal(auth.userId, parsed.data.goal);
    return NextResponse.json(await buildResponse(auth.userId, parsed.data.localDate ?? null));
  } catch (error) {
    console.error("[GOAL_PUT]", error);
    return jsonError(500, "Failed to update your daily goal");
  }
}
