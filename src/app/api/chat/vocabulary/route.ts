import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { upsertVocabulary } from "@/lib/database";
import { isCurriculumUnitId } from "@/lib/curriculum";
import { parseLanguage } from "@/lib/tutor/route-helpers";

const SaveWordSchema = z.object({
  language: z.string(),
  word: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1).max(200),
  romanization: z.string().trim().max(200).nullish(),
  exampleSentence: z.string().trim().max(600).nullish(),
  exampleTranslation: z.string().trim().max(600).nullish(),
  unitId: z.string().max(64).nullish(),
});

/** Saves a word the tutor used to the learner's review deck. Idempotent. */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = SaveWordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, "Invalid word");
    }

    const language = parseLanguage(parsed.data.language);
    if (!language) {
      return jsonError(400, "Unsupported language");
    }

    const { word, translation, romanization, exampleSentence, exampleTranslation, unitId } = parsed.data;
    const result = await upsertVocabulary({
      userId: auth.userId,
      language: language.code,
      source: "chat",
      items: [
        {
          word,
          translation,
          romanization: language.needsRomanization ? romanization : null,
          exampleSentence,
          exampleTranslation,
          unitId: unitId && isCurriculumUnitId(unitId) ? unitId : null,
          tags: ["tutor"],
        },
      ],
    });

    const item = result.items[0];
    if (!item) {
      return jsonError(400, "Invalid word");
    }

    return NextResponse.json({
      saved: true,
      alreadySaved: result.existingCount > 0,
      word: item.word,
      normalizedWord: item.normalizedWord,
    });
  } catch (error) {
    console.error("[CHAT_VOCABULARY]", error);
    return jsonError(500, "Couldn't save that word.");
  }
}
