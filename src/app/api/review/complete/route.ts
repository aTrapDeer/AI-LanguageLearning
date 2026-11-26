import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { countDueVocabulary } from "@/lib/database";
import { completeReviewSession, getNextDueAt } from "@/lib/review/store";
import type { CompleteResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";

const CompleteSchema = z.object({
  sessionId: z.string().min(1).max(64),
  localDate: z.string().max(10).nullish(),
});

/**
 * POST /api/review/complete { sessionId, localDate } → CompleteResponse.
 * Idempotent: XP is awarded the first time only. Also accepts navigator.sendBeacon bodies.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const raw = await req.text().catch(() => "");
    let json: unknown = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    const parsed = CompleteSchema.safeParse(json);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const completed = await completeReviewSession({
      userId: auth.userId,
      sessionId: parsed.data.sessionId,
      localDate: parsed.data.localDate,
    });

    if (!completed.ok) {
      return completed.reason === "not_found"
        ? jsonError(404, "Review session not found")
        : jsonError(409, "This session is still being saved", { code: "in_progress" });
    }

    const now = new Date();
    const [dueCount, nextDueAt] = await Promise.all([
      countDueVocabulary(auth.userId, completed.language, now),
      getNextDueAt(auth.userId, completed.language, now),
    ]);

    const body: CompleteResponse = { ...completed.result, dueCount, nextDueAt };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[REVIEW_COMPLETE]", error);
    return jsonError(500, "Failed to finish this review session");
  }
}
