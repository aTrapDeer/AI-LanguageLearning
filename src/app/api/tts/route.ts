import { z } from "zod";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import { getOpenAIClient, getSpeechModel, isOpenAIConfigured } from "@/lib/openai";
import { getSpeechVoice, synthesizeSpeech } from "@/lib/realtime-speech";
import { parseLanguage, tutorUnavailableResponse } from "@/lib/tutor/route-helpers";

// The Realtime speech session needs Node APIs (a WebSocket with auth headers).
export const runtime = "nodejs";

const MAX_TTS_CHARACTERS = 600;

const TtsSchema = z.object({
  text: z.string(),
  language: z.string(),
  speed: z.enum(["normal", "slow"]).nullish(),
});

const SPEEDS = { normal: 1, slow: 0.75 } as const;

/** Speaks target-language text on demand (only when the learner taps listen). Returns a WAV file. */
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

    const audio = await synthesizeSpeech({
      client: getOpenAIClient(),
      model: getSpeechModel(),
      voice: getSpeechVoice(),
      text,
      languageName: language.name,
      speed: SPEEDS[parsed.data.speed ?? "normal"],
      signal: request.signal,
    });

    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audio.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[TTS]", error);
    return jsonError(502, "Couldn't create audio right now.");
  }
}
