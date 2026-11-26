import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { upsertVocabulary } from "@/lib/database";
import { getLanguageConfig, isSupportedLanguageCode } from "@/lib/language-config";

const SavePhraseSchema = z.object({
  language: z.string(),
  phrase: z.string().trim().min(1).max(300),
  meaning: z.string().trim().min(1).max(300),
  pronunciation: z.string().trim().max(300).nullish(),
});

/** Saves a travel reply option to the learner's review deck. Idempotent. */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = SavePhraseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, "Invalid phrase");
    }

    const { language, phrase, meaning, pronunciation } = parsed.data;
    const config = isSupportedLanguageCode(language) ? getLanguageConfig(language) : null;
    if (!config) {
      return jsonError(400, "Unsupported language");
    }

    // Non-Latin scripts get the pronunciation as their romanization; elsewhere it is a note.
    const result = await upsertVocabulary({
      userId: auth.userId,
      language: config.code,
      source: "manual",
      items: [
        {
          word: phrase,
          translation: meaning,
          romanization: config.needsRomanization ? pronunciation : null,
          notes: !config.needsRomanization && pronunciation ? `Pronunciation: ${pronunciation}` : null,
          tags: ["travel"],
        },
      ],
    });

    if (result.items.length === 0) {
      return jsonError(400, "Invalid phrase");
    }

    return NextResponse.json({ saved: true, alreadySaved: result.existingCount > 0 });
  } catch (error) {
    console.error("[TRAVEL_SAVE_PHRASE]", error);
    return jsonError(500, "Couldn't save that phrase.");
  }
}
