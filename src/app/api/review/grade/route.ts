import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { applyReviewGrade } from "@/lib/database";
import { claimGrade, closeSessionItem } from "@/lib/review/store";
import type { GradeResponse } from "@/lib/review/types";
import { REVIEW_GRADES, type ReviewGrade } from "@/lib/srs";

export const dynamic = "force-dynamic";

const GradeSchema = z.object({
  sessionId: z.string().min(1).max(64),
  itemId: z.string().min(1).max(64),
  grade: z.enum(REVIEW_GRADES as unknown as [ReviewGrade, ...ReviewGrade[]]),
});

/**
 * POST /api/review/grade { sessionId, itemId, grade } → GradeResponse.
 * The card must have been served in this open session and not already be finished in it.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = GradeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const { sessionId, itemId, grade } = parsed.data;
    const now = new Date();
    const claim = await claimGrade({ userId: auth.userId, sessionId, itemId, grade, now });
    if (!claim.ok) {
      return jsonError(409, "This card can't be graded in this session", { code: "grade_not_allowed" });
    }

    const item = await applyReviewGrade({ userId: auth.userId, itemId, grade, now });
    if (!item) {
      await closeSessionItem(sessionId, itemId);
      return jsonError(404, "This word is no longer in your deck", { code: "item_missing" });
    }

    const body: GradeResponse = {
      itemId,
      grade,
      requeue: claim.requeue,
      srs: { intervalDays: item.intervalDays, ease: item.ease, repetitions: item.repetitions, lapses: item.lapses },
      maturity: item.maturity,
      nextReview: item.nextReview,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[REVIEW_GRADE]", error);
    return jsonError(500, "Failed to save this grade");
  }
}
