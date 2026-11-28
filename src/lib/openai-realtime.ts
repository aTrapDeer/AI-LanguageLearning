import { getSupportedLanguageName, LANGUAGES, type SupportedLanguageCode } from "@/lib/language-config";
import { transcriptionLanguageHint } from "@/lib/openai";

const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
const DEFAULT_REALTIME_VOICE = "alloy";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-transcribe";
/**
 * Input-transcription models a session may be configured with. The last three are deprecated and
 * shut down on Feb 26, 2027; they stay selectable until then and should be removed afterwards.
 */
const SUPPORTED_TRANSCRIPTION_MODELS = new Set([
  "gpt-transcribe",
  "gpt-live-transcribe",
  "whisper-1",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
]);

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
  return LANGUAGES[languageCode].transcriptionCode;
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
  const regionalHint = languageCode === "pt-BR" ? " The speaker uses Brazilian Portuguese vocabulary and spellings." : "";

  return buildOpenAIRealtimeSession({
    instructions: buildTravelRealtimeInstructions(languageCode),
    outputModalities: ["text"],
    transcriptionLanguage,
    // Context about the audio only; OpenAI's transcription guide says not to restate the task here.
    transcriptionPrompt: `Someone speaking ${languageName} to a traveler in an everyday situation such as directions, transport, food, shopping or lodging.${regionalHint}`,
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
          ...(options.transcriptionLanguage
            ? transcriptionLanguageHint(config.transcriptionModel, options.transcriptionLanguage)
            : {}),
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

export function buildVoiceTutorRealtimeSession(options: {
  languageCode: SupportedLanguageCode;
  instructions: string;
  transcriptionPrompt: string;
}) {
  return buildOpenAIRealtimeSession({
    instructions: options.instructions,
    outputModalities: ["audio"],
    transcriptionLanguage: getRealtimeTranscriptionLanguage(options.languageCode),
    transcriptionPrompt: options.transcriptionPrompt,
  });
}

export class RealtimeExchangeError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RealtimeExchangeError";
    this.status = status;
  }
}

/** Server-only: trades the browser's SDP offer for OpenAI's answer, with the session config attached. */
export async function exchangeRealtimeSdp(
  sdpOffer: string,
  session: ReturnType<typeof buildOpenAIRealtimeSession>
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new RealtimeExchangeError(503, "Voice conversations are not configured");
  }

  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const formData = new FormData();
  formData.set("sdp", sdpOffer);
  formData.set("session", JSON.stringify(session));

  const response = await fetch(`${baseUrl}/realtime/calls`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const detail = contentType.includes("application/json")
      ? ((await response.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message
      : await response.text().catch(() => "");
    throw new RealtimeExchangeError(response.status, detail || `Realtime connection failed (${response.status})`);
  }

  return response.text();
}
