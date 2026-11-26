import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { countVocabularyByMaturity, listWeakestVocabulary, upsertVocabulary } from "@/lib/database";
import { isSupportedLanguageCode, SUPPORTED_LANGUAGE_CODES } from "@/lib/language-config";
import { toVocabularyListItem } from "@/lib/review/mappers";
import { searchVocabulary } from "@/lib/review/store";
import type { VocabularyListResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

/** GET /api/vocabulary?language=de&q=haus&offset=0 → VocabularyListResponse ("My words"). */
export async function GET(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const language = searchParams.get("language");
    if (!isSupportedLanguageCode(language)) {
      return jsonError(400, "A supported language is required");
    }

    const query = (searchParams.get("q") ?? "").slice(0, 80);
    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    const [counts, weakest, page] = await Promise.all([
      countVocabularyByMaturity(auth.userId, language),
      query || offset > 0 ? Promise.resolve([]) : listWeakestVocabulary(auth.userId, language, 5),
      searchVocabulary({ userId: auth.userId, language, query, limit: PAGE_SIZE, offset }),
    ]);

    const body: VocabularyListResponse = {
      counts,
      // Only words that have actually been forgotten count as "weak".
      weakest: weakest.filter((item) => item.lapses > 0 || item.failureCount > 0).map(toVocabularyListItem),
      items: page.items.map(toVocabularyListItem),
      hasMore: page.hasMore,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[VOCABULARY_GET]", error);
    return jsonError(500, "Failed to load your words");
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

const AddWordSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGE_CODES),
  word: z.string().trim().min(1, "Enter a word").max(80, "That word is too long"),
  translation: z.string().trim().min(1, "Add what it means in English").max(160, "That meaning is too long"),
  romanization: optionalText(120),
  exampleSentence: optionalText(240),
});

/** POST /api/vocabulary { language, word, translation, romanization?, exampleSentence? } — add a word by hand. */
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = AddWordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const { language, word, translation, romanization, exampleSentence } = parsed.data;
    const result = await upsertVocabulary({
      userId: auth.userId,
      language,
      source: "manual",
      items: [{ word, translation, romanization, exampleSentence }],
    });

    const item = result.items[0];
    if (!item) {
      return jsonError(400, "That word couldn't be saved");
    }

    return NextResponse.json(
      { item: toVocabularyListItem(item), created: result.insertedCount > 0 },
      { status: result.insertedCount > 0 ? 201 : 200 }
    );
  } catch (error) {
    console.error("[VOCABULARY_POST]", error);
    return jsonError(500, "Failed to save this word");
  }
}
