import { z } from "zod";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import { isOpenAIConfigured } from "@/lib/openai";
import { synthesizeSpeech } from "@/lib/openai-realtime";
import { parseLanguage, tutorUnavailableResponse } from "@/lib/tutor/route-helpers";

// Each request opens a short Realtime session (connect, generate, close) instead of one HTTP call.
export const maxDuration = 30;

const MAX_TTS_CHARACTERS = 600;

const TtsSchema = z.object({
  text: z.string(),
  language: z.string(),
  speed: z.enum(["normal", "slow"]).nullish(),
});

/** Speaks target-language text on demand (only when the learner taps listen). Returns WAV audio. */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = TtsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, "Invalid request");
    }

    const text = parsed.data.text.trim();
    if (!text) {
      return jsonError(400, "Text is empty");
    }
    if (text.length > MAX_TTS_CHARACTERS) {
      return jsonError(413, "Text is too long to read aloud");
    }

    const language = parseLanguage(parsed.data.language);
    if (!language) {
      return jsonError(400, "Unsupported language");
    }

    if (!isOpenAIConfigured()) {
      return tutorUnavailableResponse();
    }

    const limited = await enforceAiQuota(auth.userId, "speech");
    if (limited) return limited;

    const audio = await synthesizeSpeech({ text, languageName: language.name, slow: parsed.data.speed === "slow" });

    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[TTS]", error instanceof Error ? error.message : error);
    return jsonError(502, "Couldn't create audio right now.");
  }
}
