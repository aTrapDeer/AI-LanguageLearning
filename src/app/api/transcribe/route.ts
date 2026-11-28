import { NextResponse } from "next/server";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import {
  getOpenAIClient,
  getTranscriptionModel,
  isOpenAIConfigured,
  OpenAIConfigError,
  transcriptionLanguageHint,
} from "@/lib/openai";
import { parseLanguage, tutorUnavailableResponse } from "@/lib/tutor/route-helpers";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** The API infers the codec from the file name, so it must match what the browser actually recorded. */
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

function fileNameFor(mimeType: string) {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return `speech.${EXTENSIONS[base] ?? "webm"}`;
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const formData = await request.formData().catch(() => null);
    const audioBlob = formData?.get("audio");
    const requestedLanguage = formData?.get("language");

    if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
      return jsonError(400, "No audio file provided");
    }

    if (audioBlob.size > MAX_AUDIO_BYTES) {
      return jsonError(413, "Audio file is too large");
    }

    // English is allowed so a learner can ask for help in their own language.
    const isEnglish = typeof requestedLanguage === "string" && ["en", "english"].includes(requestedLanguage.trim().toLowerCase());
    const language = isEnglish ? null : parseLanguage(requestedLanguage);
    if (!isEnglish && !language) {
      return jsonError(400, "Unsupported language");
    }

    if (!isOpenAIConfigured()) {
      return tutorUnavailableResponse();
    }

    const limited = await enforceAiQuota(auth.userId, "transcription");
    if (limited) return limited;

    const mimeType = audioBlob.type || "audio/webm";
    const file = new File([audioBlob], fileNameFor(mimeType), { type: mimeType });
    const model = getTranscriptionModel();
    const transcription = await getOpenAIClient().audio.transcriptions.create({
      file,
      model,
      ...transcriptionLanguageHint(model, isEnglish ? "en" : language!.transcriptionCode),
    });

    return NextResponse.json({ text: transcription.text.trim() });
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      return tutorUnavailableResponse();
    }

    console.error("[TRANSCRIBE]", error);
    return jsonError(502, "Couldn't understand the recording. Please try again.");
  }
}
