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

export function buildOpenAIRealtimeSession(instructions?: string) {
  const config = getOpenAIRealtimeConfig();

  return {
    type: "realtime" as const,
    model: config.model,
    output_modalities: ["audio"],
    instructions,
    audio: {
      input: {
        transcription: {
          model: config.transcriptionModel,
        },
        turn_detection: {
          type: "semantic_vad" as const,
          create_response: true,
          interrupt_response: true,
        },
        noise_reduction: {
          type: "near_field" as const,
        },
      },
      output: {
        voice: config.voice,
      },
    },
  };
}
