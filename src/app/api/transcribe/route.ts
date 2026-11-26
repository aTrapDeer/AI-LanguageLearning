import { NextResponse } from "next/server";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import { getLanguageConfig, resolveLanguageCode } from "@/lib/language-config";
import { getOpenAIClient, getTranscriptionModel, OpenAIConfigError } from "@/lib/openai";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const audioBlob = formData.get("audio");
    const requestedLanguage = formData.get("language");

    if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
      return jsonError(400, "No audio file provided");
    }

    if (audioBlob.size > MAX_AUDIO_BYTES) {
      return jsonError(413, "Audio file is too large");
    }

    const limited = await enforceAiQuota(auth.userId, "transcription");
    if (limited) return limited;

    // Accepts a code ("de") or a legacy display name ("German"); English is passed through.
    const languageCode = resolveLanguageCode(requestedLanguage);
    const transcriptionLanguage = languageCode
      ? getLanguageConfig(languageCode)?.transcriptionCode
      : String(requestedLanguage ?? "").trim().toLowerCase() === "english"
        ? "en"
        : undefined;

    const file = new File([audioBlob], "audio.webm", { type: audioBlob.type || "audio/webm" });
    const transcription = await getOpenAIClient().audio.transcriptions.create({
      file,
      model: getTranscriptionModel(),
      ...(transcriptionLanguage ? { language: transcriptionLanguage } : {}),
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      return jsonError(503, "Transcription is not configured");
    }

    console.error("Error transcribing audio:", error);
    return jsonError(500, "Failed to transcribe audio");
  }
}
