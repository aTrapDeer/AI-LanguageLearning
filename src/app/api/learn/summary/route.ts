import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { getLearnerSummary, getUserById } from "@/lib/database";
import { isSupportedLanguageCode } from "@/lib/language-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/learn/summary?language=de&localDate=2026-11-26
 * `language` defaults to the learner's active language; `localDate` is the device's local date.
 * Responds with a LearnerSummary.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    let language = searchParams.get("language");

    if (!language) {
      const user = await getUserById(auth.userId);
      language = user?.activeLanguage ?? null;
    }

    if (!language || !isSupportedLanguageCode(language)) {
      return jsonError(400, "A supported language is required");
    }

    const summary = await getLearnerSummary({
      userId: auth.userId,
      language,
      localDate: searchParams.get("localDate"),
    });

    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[LEARN_SUMMARY]", error);
    return jsonError(500, "Failed to load learner summary");
  }
}
