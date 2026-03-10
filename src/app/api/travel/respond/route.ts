import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getSupportedLanguageName, isSupportedLanguageCode } from "@/lib/language-config";

const TravelResponseSchema = z.object({
  language: z.string().min(1),
  message: z.string().min(1).max(400),
});

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const languageName = getSupportedLanguageName(language);
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You help travelers reply naturally in ${languageName}.

Return valid JSON only using this exact structure:
{
  "options": [
    {
      "label": "Natural",
      "tone": "friendly and natural",
      "translation": "translated sentence in ${languageName}",
      "backTranslation": "natural English meaning",
      "pronunciation": "pronunciation help when useful, otherwise empty string",
      "usageNote": "brief note on when to use it"
    }
  ]
}

Rules:
- Provide exactly 3 options.
- The options must be meaningfully different: one natural, one polite, and one concise/direct.
- Keep each translation practical for real travel situations.
- Every "backTranslation" value must be written in natural English only.
- Never return the "backTranslation" in ${languageName} or any other non-English language.
- Do not include markdown, code fences, or extra commentary.
- If the script is Latin-based, pronunciation can be an empty string.
- Preserve important place names, numbers, and times accurately.`,
        },
        {
          role: "user",
          content: `Translate this traveler response into ${languageName}: ${message}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("No translation options returned");
    }

    const parsedResponse = JSON.parse(rawContent) as {
      options?: Array<{
        label?: string;
        tone?: string;
        translation?: string;
        backTranslation?: string;
        pronunciation?: string;
        usageNote?: string;
      }>;
    };

    const options = (parsedResponse.options || [])
      .filter((option) => option.translation && option.backTranslation)
      .slice(0, 3)
      .map((option, index) => ({
        label: option.label || ["Natural", "Polite", "Direct"][index] || `Option ${index + 1}`,
        tone: option.tone || "travel-friendly",
        translation: option.translation!.trim(),
        backTranslation: option.backTranslation!.trim(),
        pronunciation: option.pronunciation?.trim() || "",
        usageNote: option.usageNote?.trim() || "Good for everyday travel conversations.",
      }));

    if (options.length === 0) {
      throw new Error("No usable translation options returned");
    }

    return NextResponse.json({ options });
  } catch (error) {
    console.error("[TRAVEL_RESPOND]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate response options" },
      { status: 500 }
    );
  }
}
