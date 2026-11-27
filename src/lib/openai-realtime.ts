import { getSupportedLanguageName, LANGUAGES, type SupportedLanguageCode } from "@/lib/language-config";
import { buildTranscriptionLanguageHint, getSpeechModel, resolveConfiguredModel } from "@/lib/openai";

/** Built-in Realtime voices (the older speech-only voices such as `nova`, `fable` and `onyx` are not among them). */
export const REALTIME_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"] as const;
const DEFAULT_VOICE = "marin";

export type RealtimeVoice = string | { id: string };

const warnedVoices = new Set<string>();

/**
 * Reads a voice from `envName`. A custom voice id (`voice_...`) is sent as `{ id }`; a name the Realtime
 * models don't offer falls back to the default instead of failing the session.
 */
export function resolveRealtimeVoice(envName: string): RealtimeVoice {
  const configured = process.env[envName]?.trim();
  if (!configured) {
    return DEFAULT_VOICE;
  }
  if (configured.startsWith("voice_")) {
    return { id: configured };
  }
  const name = configured.toLowerCase();
  if ((REALTIME_VOICES as readonly string[]).includes(name)) {
    return name;
  }
  if (!warnedVoices.has(`${envName}=${configured}`)) {
    warnedVoices.add(`${envName}=${configured}`);
    console.warn(
      `[openai] ${envName}="${configured}" is not a Realtime voice (${REALTIME_VOICES.join(", ")}); using "${DEFAULT_VOICE}" instead.`
    );
  }
  return DEFAULT_VOICE;
}

type RealtimeOutputModality = "audio" | "text";

type RealtimeSessionOptions = {
  instructions?: string;
  outputModalities?: RealtimeOutputModality[];
  transcriptionLanguage?: string;
  transcriptionPrompt?: string;
  createResponse?: boolean;
};

export function getOpenAIRealtimeConfig() {
  return {
    model: resolveConfiguredModel("realtime", "OPENAI_REALTIME_MODEL"),
    voice: resolveRealtimeVoice("OPENAI_REALTIME_VOICE"),
    transcriptionModel: resolveConfiguredModel("realtimeTranscription", "OPENAI_REALTIME_TRANSCRIPTION_MODEL"),
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
  const regionalHint = languageCode === "pt-BR" ? " The speaker uses Brazilian Portuguese." : "";

  return buildOpenAIRealtimeSession({
    instructions: buildTravelRealtimeInstructions(languageCode),
    outputModalities: ["text"],
    transcriptionLanguage,
    // Describes the audio rather than the task, as OpenAI advises for the current transcription models.
    transcriptionPrompt: `A traveler is talking with someone who speaks ${languageName}, in a shop, station, restaurant or street.${regionalHint}`,
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
          ...(options.transcriptionLanguage ? buildTranscriptionLanguageHint(config.transcriptionModel, options.transcriptionLanguage) : {}),
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

function getApiBaseUrl() {
  return (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
}

type OpenAIErrorBody = { error?: { message?: string; param?: string | null; code?: string | null } };

function describeErrorBody(body: OpenAIErrorBody["error"] | undefined): string {
  if (!body) return "";
  const extras = [body.param ? `param "${body.param}"` : "", body.code ? `code ${body.code}` : ""].filter(Boolean).join(", ");
  return `${body.message ?? "unknown error"}${extras ? ` (${extras})` : ""}`;
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

  const formData = new FormData();
  formData.set("sdp", sdpOffer);
  formData.set("session", JSON.stringify(session));

  const response = await fetch(`${getApiBaseUrl()}/realtime/calls`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const detail = contentType.includes("application/json")
      ? describeErrorBody(((await response.json().catch(() => null)) as OpenAIErrorBody | null)?.error)
      : await response.text().catch(() => "");
    throw new RealtimeExchangeError(
      response.status,
      `Realtime call failed (status ${response.status}, model "${session.model}", transcription "${session.audio.input.transcription.model}"): ${detail || "no details"}`
    );
  }

  return response.text();
}

// --- Speech generation ------------------------------------------------------------------------------

/** Realtime PCM output: 16-bit little-endian mono at 24 kHz (the only rate the API produces). */
const PCM_SAMPLE_RATE = 24_000;

/** Wraps raw PCM16 mono samples in a WAV header so `<audio>` can play them. */
export function encodePcm16Wav(pcm: Buffer, sampleRate = PCM_SAMPLE_RATE): Buffer {
  const data = pcm.length % 2 === 0 ? pcm : pcm.subarray(0, pcm.length - 1);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export class RealtimeSpeechError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealtimeSpeechError";
  }
}

/** The part of a WebSocket the speech session uses; tests substitute a fake. */
export interface SpeechSocket {
  send(data: string): void;
  close(): void;
}

export interface SpeechSocketHandlers {
  onMessage(data: string): void;
  onError(message: string): void;
  onClose(code: number, reason: string): void;
}

export type SpeechSocketFactory = (
  url: string,
  headers: Record<string, string>,
  handlers: SpeechSocketHandlers
) => SpeechSocket | Promise<SpeechSocket>;

/**
 * `ws` is loaded on first use with its optional native add-ons switched off: when Next bundles it, the
 * add-on lookups resolve to empty stubs and every frame of 48 bytes or more fails to send.
 */
async function loadWebSocket() {
  process.env.WS_NO_BUFFER_UTIL ??= "1";
  process.env.WS_NO_UTF_8_VALIDATE ??= "1";
  return (await import("ws")).default;
}

const connectWithWs: SpeechSocketFactory = async (url, headers, handlers) => {
  const WebSocket = await loadWebSocket();
  const socket = new WebSocket(url, { headers });
  socket.on("message", (data) => handlers.onMessage(data.toString()));
  socket.on("error", (error) => handlers.onError(error.message));
  socket.on("close", (code, reason) => handlers.onClose(code, reason.toString()));
  // A rejected handshake (bad key, unknown model) carries its reason in the HTTP body.
  socket.on("unexpected-response", (_request, response) => {
    let body = "";
    response.on("data", (chunk: Buffer) => (body += chunk.toString()));
    response.on("end", () => {
      let detail = body.trim();
      try {
        detail = describeErrorBody((JSON.parse(body) as OpenAIErrorBody).error) || detail;
      } catch {
        // Not JSON; keep the raw text.
      }
      handlers.onError(`handshake rejected with status ${response.statusCode}${detail ? `: ${detail}` : ""}`);
      socket.terminate();
    });
  });
  return socket;
};

export interface SynthesizeSpeechOptions {
  text: string;
  languageName: string;
  slow?: boolean;
  timeoutMs?: number;
  connect?: SpeechSocketFactory;
}

export function buildSpeechInstructions(text: string, languageName: string, slow: boolean) {
  return `You are the read-aloud voice of a language-learning app. Say exactly the following ${languageName} text, word for word, with natural native ${languageName} pronunciation${slow ? ", slowly and clearly" : ""}. Do not translate it, answer it, comment on it, or add anything before or after it.

${text}`;
}

/**
 * Speaks `text` with the speech model through a one-off Realtime WebSocket session and returns a WAV file.
 * Rejects with {@link RealtimeSpeechError} naming the model and the API's reason on any failure.
 */
export function synthesizeSpeech(options: SynthesizeSpeechOptions): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = getSpeechModel();
  if (!apiKey) {
    return Promise.reject(new RealtimeSpeechError("OPENAI_API_KEY is not set"));
  }

  const url = `${getApiBaseUrl().replace(/^http/, "ws")}/realtime?model=${encodeURIComponent(model)}`;
  const voice = resolveRealtimeVoice("OPENAI_TTS_VOICE");
  const format = { type: "audio/pcm" as const, rate: PCM_SAMPLE_RATE };
  const instructions = buildSpeechInstructions(options.text, options.languageName, options.slow ?? false);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    let socket: SpeechSocket | null = null;

    const finish = (error: string | null, audio?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.close();
      if (error) {
        reject(new RealtimeSpeechError(`Speech with model "${model}" failed: ${error}`));
      } else {
        resolve(audio!);
      }
    };

    const timer = setTimeout(() => finish(`no complete response after ${options.timeoutMs ?? 25_000} ms`), options.timeoutMs ?? 25_000);

    const send = (event: Record<string, unknown>) => {
      try {
        socket?.send(JSON.stringify(event));
      } catch (error) {
        finish(`could not send ${String(event.type)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    const handlers: SpeechSocketHandlers = {
      onMessage(data) {
        let event: {
          type?: string;
          delta?: string;
          error?: OpenAIErrorBody["error"];
          response?: { status?: string; status_details?: unknown };
        };
        try {
          event = JSON.parse(data);
        } catch {
          return;
        }

        switch (event.type) {
          case "session.created":
            send({
              type: "session.update",
              session: {
                type: "realtime",
                output_modalities: ["audio"],
                instructions,
                audio: {
                  input: { turn_detection: null },
                  output: { format, voice, speed: options.slow ? 0.75 : 1 },
                },
              },
            });
            // No conversation context: the documented pattern for "say exactly this".
            send({
              type: "response.create",
              response: {
                conversation: "none",
                input: [],
                output_modalities: ["audio"],
                instructions,
                audio: { output: { format, voice } },
              },
            });
            break;
          case "response.output_audio.delta":
            if (event.delta) chunks.push(Buffer.from(event.delta, "base64"));
            break;
          case "response.done": {
            const status = event.response?.status;
            if (status !== "completed") {
              finish(`response ended with status "${status ?? "unknown"}" ${JSON.stringify(event.response?.status_details ?? null)}`);
            } else if (chunks.length === 0) {
              finish("the response contained no audio");
            } else {
              finish(null, encodePcm16Wav(Buffer.concat(chunks)));
            }
            break;
          }
          case "error":
            finish(describeErrorBody(event.error) || "error event without details");
            break;
        }
      },
      onError(message) {
        finish(message);
      },
      onClose(code, reason) {
        finish(`connection closed before the audio finished (code ${code}${reason ? `, ${reason}` : ""})`);
      },
    };

    Promise.resolve()
      .then(() => (options.connect ?? connectWithWs)(url, { Authorization: `Bearer ${apiKey}` }, handlers))
      .then((connected) => {
        socket = connected;
        if (settled) connected.close();
      })
      .catch((error: unknown) => finish(error instanceof Error ? error.message : String(error)));
  });
}
