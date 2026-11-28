import type OpenAI from "openai";
import { OpenAIRealtimeWS } from "openai/realtime/ws";
import type { RealtimeClientEvent, RealtimeServerEvent } from "openai/resources/realtime/realtime";

/**
 * Text-to-speech through the Realtime API.
 *
 * OpenAI's Speech API models (`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`) shut down on Jan 6, 2027 and
 * their replacement, `gpt-realtime-2.1-mini`, is not served by `/v1/audio/speech`. Instead, a short
 * server-side WebSocket session asks the model to say the text and collects the audio it streams
 * back. Realtime sessions produce raw PCM, so the result is wrapped in a WAV header.
 */

/** Realtime PCM output is 16-bit mono at this rate. */
export const SPEECH_SAMPLE_RATE = 24_000;

/** Built-in Realtime voices. They differ from the old Speech API set (no `nova`, `fable`, `onyx`). */
export const SPEECH_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"] as const;
export type SpeechVoice = (typeof SPEECH_VOICES)[number];
export const DEFAULT_SPEECH_VOICE: SpeechVoice = "marin";

export function getSpeechVoice(): SpeechVoice {
  const configured = process.env.OPENAI_TTS_VOICE?.trim().toLowerCase();
  return (SPEECH_VOICES as readonly string[]).includes(configured ?? "") ? (configured as SpeechVoice) : DEFAULT_SPEECH_VOICE;
}

/** The part of a Realtime connection speech synthesis needs; lets tests inject a fake. */
export interface SpeechConnection {
  onEvent(listener: (event: RealtimeServerEvent) => void): void;
  onError(listener: (error: Error) => void): void;
  onClose(listener: () => void): void;
  send(event: RealtimeClientEvent): void;
  close(): void;
}

export class SpeechSynthesisError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SpeechSynthesisError";
  }
}

export interface SynthesizeSpeechOptions {
  text: string;
  /** English name of the language the text is in, e.g. "German". */
  languageName: string;
  model: string;
  voice: string;
  /** Playback speed multiplier; the Realtime API accepts 0.25 to 1.5. */
  speed?: number;
  /** Aborts the session when the caller goes away. */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Required unless `connect` is given. */
  client?: OpenAI;
  connect?: (model: string) => SpeechConnection;
}

function openRealtimeConnection(client: OpenAI, model: string): SpeechConnection {
  const realtime = new OpenAIRealtimeWS({ model }, client);
  return {
    onEvent: (listener) => void realtime.on("event", listener),
    onError: (listener) => void realtime.on("error", listener),
    onClose: (listener) => void realtime.socket.on("close", () => listener()),
    send: (event) => realtime.send(event),
    close: () => realtime.close(),
  };
}

/** A realtime model converses by default, so the request has to pin it to reading the text out. */
export function buildSpeechInstructions(text: string, languageName: string): string {
  return `You are the read-aloud voice of a language-learning app. Say exactly the text below, word for word, with clear, natural ${languageName} pronunciation. If part of it is in another language, pronounce that part in its own language. Do not translate it, answer it, comment on it, or add or leave out anything.

${text}`;
}

/** Wraps raw 16-bit mono PCM in a WAV container so browsers can play it. */
export function pcm16ToWav(pcm: Buffer, sampleRate = SPEECH_SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Speaks `text` with a Realtime model and resolves with a complete WAV file.
 * Rejects with {@link SpeechSynthesisError} on API errors, an unfinished response, a dropped
 * connection, a timeout or an aborted `signal`.
 */
export function synthesizeSpeech(options: SynthesizeSpeechOptions): Promise<Buffer> {
  const { text, languageName, model, voice, speed = 1, signal, timeoutMs = 30_000 } = options;

  return new Promise<Buffer>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new SpeechSynthesisError("Speech request was cancelled"));
      return;
    }

    let connection: SpeechConnection;
    try {
      if (options.connect) {
        connection = options.connect(model);
      } else if (options.client) {
        connection = openRealtimeConnection(options.client, model);
      } else {
        throw new Error("An OpenAI client is required");
      }
    } catch (error) {
      reject(new SpeechSynthesisError("Could not open a speech session", { cause: error }));
      return;
    }

    const chunks: Buffer[] = [];
    let settled = false;

    const finish = (error: SpeechSynthesisError | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      try {
        connection.close();
      } catch {
        // The session is over either way.
      }
      if (error) {
        reject(error);
      } else {
        resolve(pcm16ToWav(Buffer.concat(chunks)));
      }
    };

    const onAbort = () => finish(new SpeechSynthesisError("Speech request was cancelled"));
    const timer = setTimeout(() => finish(new SpeechSynthesisError("Speech session timed out")), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });

    connection.onError((error) => finish(new SpeechSynthesisError(error.message || "Speech session failed", { cause: error })));
    connection.onClose(() => finish(new SpeechSynthesisError("Speech session closed before the audio was complete")));

    connection.onEvent((event) => {
      if (settled) return;

      switch (event.type) {
        case "session.created":
          connection.send({
            type: "session.update",
            session: {
              type: "realtime",
              output_modalities: ["audio"],
              audio: {
                output: {
                  format: { type: "audio/pcm", rate: SPEECH_SAMPLE_RATE },
                  voice,
                  speed,
                },
              },
            },
          });
          // An empty `input` keeps the response free of any other context: it only follows `instructions`.
          connection.send({
            type: "response.create",
            response: {
              input: [],
              output_modalities: ["audio"],
              instructions: buildSpeechInstructions(text, languageName),
            },
          });
          break;

        case "response.output_audio.delta":
          chunks.push(Buffer.from(event.delta, "base64"));
          break;

        case "response.done": {
          const status = event.response.status;
          if (status !== "completed") {
            const detail = event.response.status_details?.error?.message ?? event.response.status_details?.reason;
            finish(new SpeechSynthesisError(`Speech response ${status ?? "ended"}${detail ? `: ${detail}` : ""}`));
          } else if (chunks.length === 0) {
            finish(new SpeechSynthesisError("Speech response contained no audio"));
          } else {
            finish(null);
          }
          break;
        }
      }
    });
  });
}
