import type { RealtimeClientEvent, RealtimeServerEvent } from "openai/resources/realtime/realtime";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildSpeechInstructions,
  getSpeechVoice,
  pcm16ToWav,
  SpeechSynthesisError,
  synthesizeSpeech,
  type SpeechConnection,
} from "../realtime-speech";

/** A scripted connection: the test pushes server events and reads what the client sent. */
function fakeConnection() {
  const sent: RealtimeClientEvent[] = [];
  let closed = 0;
  let onEvent: (event: RealtimeServerEvent) => void = () => {};
  let onError: (error: Error) => void = () => {};
  let onClose: () => void = () => {};
  const connection: SpeechConnection = {
    onEvent: (listener) => void (onEvent = listener),
    onError: (listener) => void (onError = listener),
    onClose: (listener) => void (onClose = listener),
    send: (event) => void sent.push(event),
    close: () => void (closed += 1),
  };
  return {
    connection,
    sent,
    closedCount: () => closed,
    emit: (event: unknown) => onEvent(event as RealtimeServerEvent),
    fail: (error: Error) => onError(error),
    drop: () => onClose(),
  };
}

const request = { text: "Guten Morgen!", languageName: "German", model: "gpt-realtime-2.1-mini", voice: "marin" };

async function expectSpeechError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(SpeechSynthesisError);
    return error as SpeechSynthesisError;
  }
  throw new Error("expected synthesizeSpeech to reject");
}

describe("synthesizeSpeech", () => {
  it("configures the session, asks for the exact text and returns the audio as WAV", async () => {
    const fake = fakeConnection();
    const result = synthesizeSpeech({ ...request, speed: 0.75, connect: () => fake.connection });

    expect(fake.sent).toHaveLength(0);
    fake.emit({ type: "session.created" });

    expect(fake.sent).toEqual([
      {
        type: "session.update",
        session: {
          type: "realtime",
          output_modalities: ["audio"],
          audio: { output: { format: { type: "audio/pcm", rate: 24000 }, voice: "marin", speed: 0.75 } },
        },
      },
      {
        type: "response.create",
        response: { input: [], output_modalities: ["audio"], instructions: buildSpeechInstructions("Guten Morgen!", "German") },
      },
    ]);

    fake.emit({ type: "response.output_audio.delta", delta: Buffer.from([1, 2, 3, 4]).toString("base64") });
    fake.emit({ type: "response.output_audio.delta", delta: Buffer.from([5, 6]).toString("base64") });
    fake.emit({ type: "response.done", response: { status: "completed" } });

    const wav = await result;
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect([...wav.subarray(44)]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fake.closedCount()).toBe(1);
  });

  it("puts the text and its language in the instructions", () => {
    const instructions = buildSpeechInstructions("Wie heißt du?", "German");
    expect(instructions).toContain("German pronunciation");
    expect(instructions.endsWith("Wie heißt du?")).toBe(true);
  });

  it("rejects when the response does not complete or has no audio", async () => {
    const failed = fakeConnection();
    const failedResult = synthesizeSpeech({ ...request, connect: () => failed.connection });
    failed.emit({ type: "session.created" });
    failed.emit({ type: "response.done", response: { status: "failed", status_details: { error: { message: "model overloaded" } } } });
    expect((await expectSpeechError(failedResult)).message).toBe("Speech response failed: model overloaded");
    expect(failed.closedCount()).toBe(1);

    const silent = fakeConnection();
    const silentResult = synthesizeSpeech({ ...request, connect: () => silent.connection });
    silent.emit({ type: "session.created" });
    silent.emit({ type: "response.done", response: { status: "completed" } });
    expect((await expectSpeechError(silentResult)).message).toContain("no audio");
  });

  it("rejects on API errors, dropped connections, timeouts and cancellation", async () => {
    const errored = fakeConnection();
    const erroredResult = synthesizeSpeech({ ...request, connect: () => errored.connection });
    errored.fail(new Error("Unexpected server response: 401"));
    expect((await expectSpeechError(erroredResult)).message).toBe("Unexpected server response: 401");

    const dropped = fakeConnection();
    const droppedResult = synthesizeSpeech({ ...request, connect: () => dropped.connection });
    dropped.drop();
    expect((await expectSpeechError(droppedResult)).message).toContain("closed before");

    const slow = fakeConnection();
    expect((await expectSpeechError(synthesizeSpeech({ ...request, timeoutMs: 10, connect: () => slow.connection }))).message).toContain(
      "timed out"
    );
    expect(slow.closedCount()).toBe(1);

    const controller = new AbortController();
    const cancelled = fakeConnection();
    const cancelledResult = synthesizeSpeech({ ...request, signal: controller.signal, connect: () => cancelled.connection });
    controller.abort();
    expect((await expectSpeechError(cancelledResult)).message).toContain("cancelled");
    expect(cancelled.closedCount()).toBe(1);
  });

  it("ignores events that arrive after the result is settled", async () => {
    const fake = fakeConnection();
    const result = synthesizeSpeech({ ...request, connect: () => fake.connection });
    fake.emit({ type: "session.created" });
    fake.emit({ type: "response.output_audio.delta", delta: Buffer.from([9, 9]).toString("base64") });
    fake.emit({ type: "response.done", response: { status: "completed" } });
    fake.drop();
    fake.fail(new Error("late"));
    expect((await result).length).toBe(46);
    expect(fake.closedCount()).toBe(1);
  });
});

describe("speech helpers", () => {
  afterEach(() => {
    delete process.env.OPENAI_TTS_VOICE;
  });

  it("writes a valid 16-bit mono WAV header", () => {
    const wav = pcm16ToWav(Buffer.alloc(48_000));
    expect(wav.length).toBe(48_044);
    expect(wav.readUInt32LE(4)).toBe(48_036); // RIFF size
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(24_000); // sample rate
    expect(wav.readUInt32LE(28)).toBe(48_000); // byte rate
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
    expect(wav.readUInt32LE(40)).toBe(48_000); // data size
  });

  it("only accepts voices the Realtime API offers", () => {
    expect(getSpeechVoice()).toBe("marin");
    process.env.OPENAI_TTS_VOICE = "Cedar";
    expect(getSpeechVoice()).toBe("cedar");
    process.env.OPENAI_TTS_VOICE = "nova";
    expect(getSpeechVoice()).toBe("marin");
  });
});
