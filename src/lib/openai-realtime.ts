import { getSupportedLanguageName, type SupportedLanguageCode } from "@/lib/language-config";

const DEFAULT_REALTIME_MODEL = "gpt-realtime";
const DEFAULT_REALTIME_VOICE = "alloy";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const SUPPORTED_TRANSCRIPTION_MODELS = new Set([
  "whisper-1",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "gpt-4o-mini-transcribe-2025-03-20",
  "gpt-4o-mini-transcribe-2025-12-15",
]);

const REALTIME_TRANSCRIPTION_LANGUAGE_MAP: Record<SupportedLanguageCode, string> = {
  de: "de",
  "pt-BR": "pt",
  zh: "zh",
  no: "no",
  ko: "ko",
  ar: "ar",
};

type RealtimeOutputModality = "audio" | "text";

type RealtimeSessionOptions = {
  instructions?: string;
  outputModalities?: RealtimeOutputModality[];
  transcriptionLanguage?: string;
  transcriptionPrompt?: string;
  createResponse?: boolean;
};

export function getOpenAIRealtimeConfig() {
  const requestedTranscriptionModel = process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim();

  return {
    model: process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL,
    voice: process.env.OPENAI_REALTIME_VOICE?.trim() || DEFAULT_REALTIME_VOICE,
    transcriptionModel:
      requestedTranscriptionModel && SUPPORTED_TRANSCRIPTION_MODELS.has(requestedTranscriptionModel)
        ? requestedTranscriptionModel
        : DEFAULT_TRANSCRIPTION_MODEL,
  };
}

export function getRealtimeTranscriptionLanguage(languageCode: SupportedLanguageCode) {
  return REALTIME_TRANSCRIPTION_LANGUAGE_MAP[languageCode];
}

export function buildTravelRealtimeInstructions(languageCode: SupportedLanguageCode) {
  const languageName = getSupportedLanguageName(languageCode);

  return `You are Travel mode for a traveler who understands English and needs help with ${languageName}.

Your job:
- Listen to what is being said in ${languageName}.
- Translate it into clear, natural English.
- Do not answer as the speaker.
- Do not ask follow-up questions.
- Keep the translation concise and practical for someone in the middle of a real-world travel situation.
- If part of the audio is unclear, briefly say so instead of inventing details.`;
}

export function buildTravelRealtimeSession(languageCode: SupportedLanguageCode) {
  const languageName = getSupportedLanguageName(languageCode);
  const transcriptionLanguage = getRealtimeTranscriptionLanguage(languageCode);
  const regionalHint =
    languageCode === "pt-BR"
      ? "Prefer Brazilian Portuguese vocabulary, pronunciation patterns, and spellings."
      : `Prefer natural ${languageName} vocabulary and spelling conventions.`;

  return buildOpenAIRealtimeSession({
    instructions: buildTravelRealtimeInstructions(languageCode),
    outputModalities: ["text"],
    transcriptionLanguage,
    transcriptionPrompt: `The speaker is expected to be speaking ${languageName}. ${regionalHint} Transcribe only what is spoken. Do not translate, summarize, or label the speech as another language unless the speaker clearly switches languages.`,
    createResponse: false,
  });
}

export function buildOpenAIRealtimeSession(options: RealtimeSessionOptions = {}) {
  const config = getOpenAIRealtimeConfig();
  const outputModalities = options.outputModalities ?? ["audio"];

  return {
    type: "realtime" as const,
    model: config.model,
    output_modalities: outputModalities,
    instructions: options.instructions,
    audio: {
      input: {
        transcription: {
          model: config.transcriptionModel,
          ...(options.transcriptionLanguage ? { language: options.transcriptionLanguage } : {}),
          ...(options.transcriptionPrompt ? { prompt: options.transcriptionPrompt } : {}),
        },
        turn_detection: {
          type: "semantic_vad" as const,
          create_response: options.createResponse ?? outputModalities.includes("audio"),
          interrupt_response: true,
        },
        noise_reduction: {
          type: "near_field" as const,
        },
      },
      ...(outputModalities.includes("audio")
        ? {
            output: {
              voice: config.voice,
            },
          }
        : {}),
    },
  };
}
