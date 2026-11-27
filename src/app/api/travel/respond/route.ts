import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceAiQuota, requireUser } from "@/lib/api-auth";
import { generateJson, isOpenAIConfigured, StructuredOutputError } from "@/lib/openai";
import { getSupportedLanguageName, isSupportedLanguageCode } from "@/lib/language-config";

const TravelResponseSchema = z.object({
  language: z.string().min(1),
  message: z.string().min(1).max(400),
});

const ResponseOptionsSchema = z.object({
  options: z.array(
    z.object({
      label: z.string(),
      tone: z.string(),
      translation: z.string(),
      backTranslation: z.string(),
      pronunciation: z.string(),
      usageNote: z.string(),
    })
  ),
});

const unavailable = () =>
  NextResponse.json({ error: "Travel mode isn't available right now.", code: "tutor_unavailable" }, { status: 503 });

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsedBody = TravelResponseSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const { language, message } = parsedBody.data;
    if (!isSupportedLanguageCode(language)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }

    if (!isOpenAIConfigured()) {
      return unavailable();
    }

    const limited = await enforceAiQuota(auth.userId, "text");
    if (limited) return limited;

    const languageName = getSupportedLanguageName(language);
    const parsedResponse = await generateJson({
      schema: ResponseOptionsSchema,
      schemaName: "travel_reply_options",
      temperature: 0.7,
      system: `You help travelers reply naturally in ${languageName}.

Return the replies in "options"; each one has:
- "label": e.g. "Natural", "Polite" or "Direct".
- "tone": e.g. "friendly and natural".
- "translation": the sentence in ${languageName}.
- "backTranslation": its natural English meaning.
- "pronunciation": pronunciation help when useful, otherwise an empty string.
- "usageNote": a brief note on when to use it.

Rules:
- Provide exactly 3 options.
- The options must be meaningfully different: one natural, one polite, and one concise/direct.
- Keep each translation practical for real travel situations.
- Every "backTranslation" value must be written in natural English only.
- Never return the "backTranslation" in ${languageName} or any other non-English language.
- Do not include markdown, code fences, or extra commentary.
- If the script is Latin-based, pronunciation can be an empty string.
- Preserve important place names, numbers, and times accurately.`,
      user: `Translate this traveler response into ${languageName}: ${message}`,
    });

    const options = parsedResponse.options
      .filter((option) => option.translation.trim() && option.backTranslation.trim())
      .slice(0, 3)
      .map((option, index) => ({
        label: option.label.trim() || ["Natural", "Polite", "Direct"][index] || `Option ${index + 1}`,
        tone: option.tone.trim() || "travel-friendly",
        translation: option.translation.trim(),
        backTranslation: option.backTranslation.trim(),
        pronunciation: option.pronunciation.trim(),
        usageNote: option.usageNote.trim() || "Good for everyday travel conversations.",
      }));

    if (options.length === 0) {
      throw new Error("No usable translation options returned");
    }

    return NextResponse.json({ options });
  } catch (error) {
    if (error instanceof StructuredOutputError) {
      console.error(`[TRAVEL_RESPOND] ${error.kind} after ${error.attempts} attempt(s): ${error.message}`, error.issues);
    } else {
      console.error("[TRAVEL_RESPOND]", error);
    }
    return NextResponse.json({ error: "Failed to generate response options. Please try again." }, { status: 502 });
  }
}
