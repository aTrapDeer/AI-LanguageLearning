import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceAiQuota, requireUser } from "@/lib/api-auth";
import { getOpenAIClient, getTextModel, OpenAIConfigError } from "@/lib/openai";
import { getSupportedLanguageName, isSupportedLanguageCode } from "@/lib/language-config";

const TravelTranslateSchema = z.object({
  language: z.string().min(1),
  transcript: z.string().min(1).max(600),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsedBody = TravelTranslateSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const { language, transcript } = parsedBody.data;
    if (!isSupportedLanguageCode(language)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }

    const limited = await enforceAiQuota(auth.userId, "text");
    if (limited) return limited;

    const languageName = getSupportedLanguageName(language);
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: getTextModel(),
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You translate short travel transcripts from ${languageName} into English.

Return valid JSON only using this exact structure:
{
  "translation": "natural English translation"
}

Rules:
- The translation must always be English.
- Never answer the speaker or continue the conversation.
- Never write the final translation in ${languageName}.
- Keep the translation concise and practical.
- Preserve names, numbers, addresses, and times accurately.
- If the transcript is fragmentary or unclear, give the closest short English meaning.
- If there is not enough signal to translate, return exactly: "I couldn't clearly hear that."`,
        },
        {
          role: "user",
          content: `Source language: ${languageName}
Transcript: ${transcript}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("No translation returned");
    }

    const parsedResponse = JSON.parse(rawContent) as { translation?: string };
    const translation = parsedResponse.translation?.trim();

    if (!translation) {
      throw new Error("No usable translation returned");
    }

    return NextResponse.json({ translation });
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      return NextResponse.json({ error: "Travel mode isn't available right now.", code: "tutor_unavailable" }, { status: 503 });
    }

    console.error("[TRAVEL_TRANSLATE]", error);
    return NextResponse.json({ error: "Failed to translate transcript. Please try again." }, { status: 502 });
  }
}
