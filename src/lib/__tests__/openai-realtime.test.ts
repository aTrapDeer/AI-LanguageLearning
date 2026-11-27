import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import {
  buildTravelRealtimeSession,
  encodePcm16Wav,
  getOpenAIRealtimeConfig,
  RealtimeSpeechError,
  resolveRealtimeVoice,
  synthesizeSpeech,
  type SpeechSocketFactory,
  type SpeechSocketHandlers,
} from "../openai-realtime";

const ENV = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_REALTIME_MODEL",
  "OPENAI_REALTIME_VOICE",
  "OPENAI_REALTIME_TRANSCRIPTION_MODEL",
  "OPENAI_TTS_MODEL",
  "OPENAI_TTS_VOICE",
];

afterEach(() => {
  ENV.forEach((name) => delete process.env[name]);
  vi.restoreAllMocks();
});

describe("realtime config", () => {
  it("defaults to current models and a Realtime voice", () => {
    expect(getOpenAIRealtimeConfig()).toEqual({
      model: "gpt-realtime-2.1",
      voice: "marin",
      transcriptionModel: "gpt-live-transcribe",
    });
  });

  it("replaces the ids a deployment set before the deprecations", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.OPENAI_REALTIME_MODEL = "gpt-realtime";
    process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
    process.env.OPENAI_REALTIME_VOICE = "alloy";

    expect(getOpenAIRealtimeConfig()).toEqual({
      model: "gpt-realtime-2.1",
      voice: "alloy",
      transcriptionModel: "gpt-live-transcribe",
    });
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      '[openai] OPENAI_REALTIME_MODEL="gpt-realtime" is deprecated or shut down by OpenAI; using "gpt-realtime-2.1" instead. Update or remove OPENAI_REALTIME_MODEL.',
      '[openai] OPENAI_REALTIME_TRANSCRIPTION_MODEL="gpt-4o-mini-transcribe" is deprecated or shut down by OpenAI; using "gpt-live-transcribe" instead. Update or remove OPENAI_REALTIME_TRANSCRIPTION_MODEL.',
    ]);
  });

  it("passes a current model id through unchanged", () => {
    process.env.OPENAI_REALTIME_MODEL = "gpt-realtime-2.1-mini";
    process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
    expect(getOpenAIRealtimeConfig()).toMatchObject({ model: "gpt-realtime-2.1-mini", transcriptionModel: "gpt-realtime-whisper" });
  });

  it("falls back to a valid voice when the configured one is not a Realtime voice", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.OPENAI_TTS_VOICE = "nova";
    expect(resolveRealtimeVoice("OPENAI_TTS_VOICE")).toBe("marin");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('OPENAI_TTS_VOICE="nova"');

    process.env.OPENAI_TTS_VOICE = "Cedar";
    expect(resolveRealtimeVoice("OPENAI_TTS_VOICE")).toBe("cedar");
    process.env.OPENAI_TTS_VOICE = "voice_1234";
    expect(resolveRealtimeVoice("OPENAI_TTS_VOICE")).toEqual({ id: "voice_1234" });
  });

  it("builds the travel session for text output with the transcription hints", () => {
    const session = buildTravelRealtimeSession("pt-BR");
    expect(session.output_modalities).toEqual(["text"]);
    expect(session.audio).not.toHaveProperty("output");
    expect(session.audio.input.turn_detection).toEqual({ type: "semantic_vad", create_response: false, interrupt_response: true });
    expect(session.audio.input.transcription).toMatchObject({ model: "gpt-live-transcribe", languages: ["pt"] });
    expect(session.audio.input.transcription).not.toHaveProperty("language");
    expect(session.audio.input.transcription.prompt).toContain("Brazilian Portuguese");
  });
});

describe("encodePcm16Wav", () => {
  it("writes a 24 kHz mono 16-bit header", () => {
    const wav = encodePcm16Wav(Buffer.alloc(4800));
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.readUInt32LE(4)).toBe(36 + 4800);
    expect(wav.subarray(8, 16).toString("ascii")).toBe("WAVEfmt ");
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt32LE(28)).toBe(48_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(4800);
    expect(wav.length).toBe(44 + 4800);
  });

  it("drops a trailing odd byte", () => {
    expect(encodePcm16Wav(Buffer.alloc(5)).readUInt32LE(40)).toBe(4);
  });
});

describe("synthesizeSpeech", () => {
  let sent: Array<Record<string, unknown>>;
  let handlers: SpeechSocketHandlers;
  let connectedTo: { url: string; headers: Record<string, string> } | null;
  let closed: number;

  const connect: SpeechSocketFactory = (url, headers, socketHandlers) => {
    connectedTo = { url, headers };
    handlers = socketHandlers;
    return {
      send: (data) => sent.push(JSON.parse(data)),
      close: () => (closed += 1),
    };
  };
  const emit = (event: Record<string, unknown>) => handlers.onMessage(JSON.stringify(event));
  /** The socket is opened asynchronously; wait for it before emitting server events. */
  const opened = () => vi.waitFor(() => expect(connectedTo).not.toBeNull());

  beforeEach(() => {
    sent = [];
    connectedTo = null;
    closed = 0;
    process.env.OPENAI_API_KEY = "sk-test";
  });

  it("asks the speech model to read the text and returns WAV audio", async () => {
    process.env.OPENAI_BASE_URL = "http://localhost:9999/v1";
    const pending = synthesizeSpeech({ text: "Guten Morgen!", languageName: "German", slow: true, connect });

    await opened();
    expect(connectedTo).toEqual({
      url: "ws://localhost:9999/v1/realtime?model=gpt-realtime-2.1-mini",
      headers: { Authorization: "Bearer sk-test" },
    });

    emit({ type: "session.created", session: {} });
    expect(sent.map((event) => event.type)).toEqual(["session.update", "response.create"]);
    expect(sent[0]).toMatchObject({
      session: {
        type: "realtime",
        output_modalities: ["audio"],
        audio: { input: { turn_detection: null }, output: { format: { type: "audio/pcm", rate: 24000 }, voice: "marin", speed: 0.75 } },
      },
    });
    expect(sent[1]).toMatchObject({
      response: { conversation: "none", input: [], output_modalities: ["audio"], audio: { output: { voice: "marin" } } },
    });
    const instructions = String((sent[1].response as { instructions: string }).instructions);
    expect(instructions).toContain("Say exactly the following German text");
    expect(instructions).toContain("slowly");
    expect(instructions.endsWith("Guten Morgen!")).toBe(true);

    emit({ type: "response.output_audio.delta", delta: Buffer.alloc(960, 1).toString("base64") });
    emit({ type: "response.output_audio.delta", delta: Buffer.alloc(960, 2).toString("base64") });
    emit({ type: "response.done", response: { status: "completed" } });

    const wav = await pending;
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.readUInt32LE(40)).toBe(1920);
    expect(closed).toBe(1);
  });

  it("rejects with the model and the API's reason on an error event", async () => {
    process.env.OPENAI_TTS_MODEL = "gpt-future-voice";
    const pending = synthesizeSpeech({ text: "Hola", languageName: "Spanish", connect });
    await opened();
    emit({ type: "error", error: { message: "Unknown parameter: 'session.audio.output.speed'.", param: "session.audio.output.speed", code: "unknown_parameter" } });

    await expect(pending).rejects.toThrow(RealtimeSpeechError);
    await expect(pending).rejects.toThrow(
      `Speech with model "gpt-future-voice" failed: Unknown parameter: 'session.audio.output.speed'. (param "session.audio.output.speed", code unknown_parameter)`
    );
  });

  it("rejects when the response does not complete, has no audio, or the socket closes", async () => {
    connectedTo = null;
    const failed = synthesizeSpeech({ text: "Hola", languageName: "Spanish", connect });
    await opened();
    emit({ type: "response.done", response: { status: "failed", status_details: { error: { message: "boom" } } } });
    await expect(failed).rejects.toThrow('response ended with status "failed"');

    connectedTo = null;
    const silent = synthesizeSpeech({ text: "Hola", languageName: "Spanish", connect });
    await opened();
    emit({ type: "response.done", response: { status: "completed" } });
    await expect(silent).rejects.toThrow("no audio");

    connectedTo = null;
    const dropped = synthesizeSpeech({ text: "Hola", languageName: "Spanish", connect });
    await opened();
    handlers.onClose(1006, "");
    await expect(dropped).rejects.toThrow("connection closed before the audio finished (code 1006)");

    connectedTo = null;
    const refused = synthesizeSpeech({ text: "Hola", languageName: "Spanish", connect });
    await opened();
    handlers.onError('handshake rejected with status 404: The model "x" does not exist');
    await expect(refused).rejects.toThrow("handshake rejected with status 404");
  });

  it("times out", async () => {
    vi.useFakeTimers();
    try {
      const pending = synthesizeSpeech({ text: "Hola", languageName: "Spanish", connect, timeoutMs: 1000 });
      const rejected = expect(pending).rejects.toThrow("no complete response after 1000 ms");
      await vi.advanceTimersByTimeAsync(1000);
      await rejected;
      expect(closed).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails without an API key and opens no connection", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(synthesizeSpeech({ text: "Hola", languageName: "Spanish", connect })).rejects.toThrow("OPENAI_API_KEY is not set");
    expect(connectedTo).toBeNull();
  });
});

describe("synthesizeSpeech over a real WebSocket", () => {
  let server: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    server = new WebSocketServer({ port: 0 });
    await new Promise((resolve) => server.once("listening", resolve));
    port = (server.address() as AddressInfo).port;
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_BASE_URL = `http://localhost:${port}/v1`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("sends large frames and assembles the audio", async () => {
    const received: string[] = [];
    server.on("connection", (socket, request) => {
      expect(request.headers.authorization).toBe("Bearer sk-test");
      expect(request.url).toBe("/v1/realtime?model=gpt-realtime-2.1-mini");
      socket.on("message", (data) => {
        const event = JSON.parse(data.toString());
        received.push(event.type);
        if (event.type === "response.create") {
          socket.send(JSON.stringify({ type: "response.output_audio.delta", delta: Buffer.alloc(48_000).toString("base64") }));
          socket.send(JSON.stringify({ type: "response.done", response: { status: "completed" } }));
        }
      });
      socket.send(JSON.stringify({ type: "session.created", session: {} }));
    });

    const wav = await synthesizeSpeech({ text: "Bonjour ".repeat(60), languageName: "French" });
    expect(received).toEqual(["session.update", "response.create"]);
    expect(wav.readUInt32LE(40)).toBe(48_000);
  });

  it("reports the API's reason when the handshake is rejected", async () => {
    const rejecting = createServer();
    rejecting.on("upgrade", (_request, socket) => {
      const body = JSON.stringify({ error: { message: "The model `x` does not exist.", param: "model", code: "model_not_found" } });
      socket.end(`HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`);
    });
    await new Promise<void>((resolve) => rejecting.listen(0, resolve));
    process.env.OPENAI_BASE_URL = `http://localhost:${(rejecting.address() as AddressInfo).port}/v1`;

    try {
      await expect(synthesizeSpeech({ text: "Hola", languageName: "Spanish" })).rejects.toThrow(
        'Speech with model "gpt-realtime-2.1-mini" failed: handshake rejected with status 400: The model `x` does not exist. (param "model", code model_not_found)'
      );
    } finally {
      await new Promise((resolve) => rejecting.close(resolve));
    }
  });
});
