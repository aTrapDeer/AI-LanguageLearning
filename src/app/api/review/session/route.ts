import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import { listDueVocabulary, type VocabularyItem } from "@/lib/database";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/language-config";
import { isOpenAIConfigured } from "@/lib/openai";
import { generateReviewWords } from "@/lib/review/generate-words";
import { toReviewCard } from "@/lib/review/mappers";
import { canGenerateMore, planSession, topUpCount } from "@/lib/review/plan";
import { countGeneratedWordsSince, countVocabulary, createReviewSession, getNextDueAt } from "@/lib/review/store";
import type { StartSessionResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const StartSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGE_CODES),
  /** "due": due cards, topped up when thin. "new": the learner asked for new words. */
  mode: z.enum(["due", "new"]).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/review/session { language, mode? } → StartSessionResponse.
 * Starts a server-tracked review session: only the cards returned here can be graded in it.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = StartSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const { language } = parsed.data;
    const mode = parsed.data.mode ?? "due";
    const userId = auth.userId;
    const now = new Date();

    const [due, deckSize, generatedLast24h] = await Promise.all([
      listDueVocabulary({ userId, language, limit: 200, now }),
      countVocabulary(userId, language),
      countGeneratedWordsSince(userId, language, new Date(now.getTime() - DAY_MS)),
    ]);

    const aiAvailable = isOpenAIConfigured();
    let cards: VocabularyItem[] = planSession(due);
    let newWordsAdded = 0;
    let generationFailed = false;

    const wanted = topUpCount({
      plannedCards: cards.length,
      deckSize,
      generatedLast24h,
      aiAvailable,
      requested: mode === "new",
    });

    if (wanted > 0 && !(await enforceAiQuota(userId, "text"))) {
      try {
        const generated = await generateReviewWords({ userId, language, count: wanted });
        const plannedIds = new Set(cards.map((card) => card.id));
        const added = generated.filter((item) => !plannedIds.has(item.id) && item.maturity === "new");
        newWordsAdded = added.length;
        cards = [...cards, ...added];
      } catch (error) {
        generationFailed = true;
        console.error("[REVIEW_SESSION_GENERATE]", error);
      }
    }

    let body: StartSessionResponse;
    if (cards.length > 0) {
      const sessionId = await createReviewSession({ userId, language, itemIds: cards.map((card) => card.id), now });
      body = { status: "ready", session: { sessionId, language, cards: cards.map(toReviewCard), newWordsAdded } };
    } else {
      const canAddNewWords = canGenerateMore(generatedLast24h + newWordsAdded, aiAvailable) && !generationFailed;
      if (deckSize > 0) {
        body = { status: "caught_up", nextDueAt: await getNextDueAt(userId, language, now), deckSize, canAddNewWords };
      } else {
        body = {
          status: "empty",
          canAddNewWords,
          message: generationFailed ? "We couldn't fetch new words just now. Please try again in a moment." : null,
        };
      }
    }

    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[REVIEW_SESSION]", error);
    return jsonError(500, "Failed to start a review session");
  }
}
