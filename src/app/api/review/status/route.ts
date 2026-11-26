import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { countDueVocabulary } from "@/lib/database";
import { isSupportedLanguageCode } from "@/lib/language-config";
import { isOpenAIConfigured } from "@/lib/openai";
import { canGenerateMore } from "@/lib/review/plan";
import { countGeneratedWordsSince, countVocabulary, getNextDueAt } from "@/lib/review/store";
import type { ReviewStatusResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/** GET /api/review/status?language=de → ReviewStatusResponse (for the review lobby). */
export async function GET(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const language = new URL(req.url).searchParams.get("language");
    if (!isSupportedLanguageCode(language)) {
      return jsonError(400, "A supported language is required");
    }

    const now = new Date();
    const [dueCount, nextDueAt, deckSize, generated] = await Promise.all([
      countDueVocabulary(auth.userId, language, now),
      getNextDueAt(auth.userId, language, now),
      countVocabulary(auth.userId, language),
      countGeneratedWordsSince(auth.userId, language, new Date(now.getTime() - DAY_MS)),
    ]);

    const body: ReviewStatusResponse = {
      language,
      dueCount,
      nextDueAt,
      deckSize,
      canAddNewWords: canGenerateMore(generated, isOpenAIConfigured()),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[REVIEW_STATUS]", error);
    return jsonError(500, "Failed to load review status");
  }
}
