import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  buildTextGenerationParams,
  buildTranscriptionLanguageHint,
  DEFAULT_MODELS,
  describeOpenAIError,
  generateJson,
  getImageModel,
  getSpeechModel,
  getStaleModelReplacement,
  getTextModel,
  getTranscriptionModel,
  resolveConfiguredModel,
  STALE_MODELS,
  StructuredOutputError,
  type JsonChatClient,
} from "../openai";

type CreateParams = Parameters<JsonChatClient["chat"]["completions"]["create"]>[0];

type Reply = string | null | { refusal: string } | { content: string; finish_reason: string } | Error;

function fakeClient(replies: Reply[]) {
  const calls: CreateParams[] = [];
  const client: JsonChatClient = {
    chat: {
      completions: {
        async create(params) {
          calls.push(JSON.parse(JSON.stringify(params)) as CreateParams);
          const reply = replies[calls.length - 1];
          if (reply instanceof Error) {
            throw reply;
          }
          if (reply && typeof reply === "object" && "refusal" in reply) {
            return { choices: [{ message: { content: null, refusal: reply.refusal } }] };
          }
          if (reply && typeof reply === "object") {
            return { choices: [{ message: { content: reply.content }, finish_reason: reply.finish_reason }] };
          }
          return { choices: [{ message: { content: reply ?? null } }] };
        },
      },
    },
  };
  return { client, calls };
}

const WordSchema = z.object({
  words: z.array(z.object({ word: z.string(), translation: z.string() })).min(1),
});

const base = { schema: WordSchema, schemaName: "words", system: "You make flashcards.", user: "Give me words." };

async function expectError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(StructuredOutputError);
    return error as StructuredOutputError;
  }
  throw new Error("expected generateJson to throw");
}

describe("generateJson", () => {
  afterEach(() => {
    delete process.env.OPENAI_TEXT_MODEL;
    delete process.env.OPENAI_TTS_MODEL;
    delete process.env.OPENAI_TEXT_REASONING_EFFORT;
  });

  it("returns validated data and sends a strict json_schema response format", async () => {
    const { client, calls } = fakeClient([JSON.stringify({ words: [{ word: "Hund", translation: "dog" }] })]);
    const data = await generateJson({ ...base, client, temperature: 0.3, maxTokens: 500 });

    expect(data.words[0].word).toBe("Hund");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      model: "gpt-6-luna",
      reasoning_effort: "none",
      temperature: 0.3,
      max_completion_tokens: 500,
    });
    expect(calls[0]).not.toHaveProperty("max_tokens");
    expect(calls[0].response_format).toMatchObject({ type: "json_schema", json_schema: { name: "words", strict: true } });
    expect(calls[0].messages[0]).toMatchObject({ role: "developer", content: "You make flashcards." });
  });

  it("keeps the older parameters for a non-reasoning model set through env", async () => {
    process.env.OPENAI_TEXT_MODEL = "some-chat-model";
    const { client, calls } = fakeClient([JSON.stringify({ words: [{ word: "a", translation: "b" }] })]);
    await generateJson({ ...base, client, temperature: 0.3, maxTokens: 500 });
    expect(calls[0]).toMatchObject({ model: "some-chat-model", temperature: 0.3, max_completion_tokens: 500 });
    expect(calls[0]).not.toHaveProperty("reasoning_effort");
    expect(calls[0].messages[0].role).toBe("system");
  });

  it("retries once with the validation errors when the output does not match", async () => {
    const { client, calls } = fakeClient([
      JSON.stringify({ words: [] }),
      JSON.stringify({ words: [{ word: "Katze", translation: "cat" }] }),
    ]);
    const data = await generateJson({ ...base, client });

    expect(data.words[0].word).toBe("Katze");
    expect(calls).toHaveLength(2);
    const retryMessages = calls[1].messages;
    expect(retryMessages).toHaveLength(4);
    expect(retryMessages[2]).toMatchObject({ role: "assistant" });
    expect(String(retryMessages[3].content)).toContain("words");
  });

  it("retries on invalid JSON and accepts fenced JSON", async () => {
    const { client, calls } = fakeClient(["not json", '```json\n{"words":[{"word":"Baum","translation":"tree"}]}\n```']);
    const data = await generateJson({ ...base, client });
    expect(data.words[0].translation).toBe("tree");
    expect(calls).toHaveLength(2);
  });

  it("throws a typed error after the retry is used up", async () => {
    const { client, calls } = fakeClient(["{}", '{"words": "nope"}']);
    const error = await expectError(generateJson({ ...base, client }));
    expect(error.kind).toBe("schema_mismatch");
    expect(error.attempts).toBe(2);
    expect(error.issues.join(" ")).toContain("words");
    expect(error.raw).toBe('{"words": "nope"}');
    expect(calls).toHaveLength(2);
  });

  it("reports empty output, refusals and API errors", async () => {
    expect((await expectError(generateJson({ ...base, client: fakeClient([null, ""]).client }))).kind).toBe("empty");
    expect((await expectError(generateJson({ ...base, client: fakeClient([{ refusal: "no" }]).client }))).kind).toBe("refusal");

    const rejected = Object.assign(new Error("400 Unsupported parameter: 'temperature'"), {
      status: 400,
      param: "temperature",
      code: "unsupported_parameter",
    });
    const api = fakeClient([rejected]);
    const apiError = await expectError(generateJson({ ...base, client: api.client }));
    expect(apiError.kind).toBe("api");
    expect(apiError.message).toBe(
      `OpenAI request failed (model "gpt-6-luna", status 400, param "temperature", code unsupported_parameter): 400 Unsupported parameter: 'temperature'`
    );
    expect(apiError.cause).toBe(rejected);
    expect(api.calls).toHaveLength(1);
  });

  it("notes when the reply was cut off at the token limit", async () => {
    const cut = { content: '{"words":[{"word":"Ha', finish_reason: "length" };
    const error = await expectError(generateJson({ ...base, client: fakeClient([cut, cut]).client }));
    expect(error.kind).toBe("invalid_json");
    expect(error.issues).toContain("the reply stopped at the token limit");
  });

  it("supports plain JSON mode for schemas that are not strict-compatible", async () => {
    const Loose = z.object({ note: z.string().optional(), count: z.number().default(1) });
    const { client, calls } = fakeClient(['{"note":"hi"}']);
    const data = await generateJson({ ...base, schema: Loose, client, strict: false, maxAttempts: 1 });
    expect(data).toEqual({ note: "hi", count: 1 });
    expect(calls[0].response_format).toEqual({ type: "json_object" });
    expect(String(calls[0].messages[0].content)).toContain("JSON");
  });

  it("reports a config error when no client or key is available", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect((await expectError(generateJson(base))).kind).toBe("config");
    } finally {
      if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
    }
  });

  it("reads model names from env", async () => {
    process.env.OPENAI_TEXT_MODEL = "custom-text";
    process.env.OPENAI_TTS_MODEL = "custom-tts";
    expect(getTextModel()).toBe("custom-text");
    expect(getSpeechModel()).toBe("custom-tts");

    const { client, calls } = fakeClient([JSON.stringify({ words: [{ word: "a", translation: "b" }] })]);
    await generateJson({ ...base, client });
    expect(calls[0].model).toBe("custom-text");
  });
});

describe("text generation parameters", () => {
  afterEach(() => {
    delete process.env.OPENAI_TEXT_REASONING_EFFORT;
  });

  it("sends no reasoning by default, so temperature and a tight cap stay valid", () => {
    expect(buildTextGenerationParams("gpt-6-luna", { temperature: 0.7, maxTokens: 900 })).toEqual({
      reasoning_effort: "none",
      temperature: 0.7,
      max_completion_tokens: 900,
    });
  });

  it("drops temperature and the cap once the model reasons", () => {
    process.env.OPENAI_TEXT_REASONING_EFFORT = "low";
    expect(buildTextGenerationParams("gpt-6-luna", { temperature: 0.7, maxTokens: 900 })).toEqual({ reasoning_effort: "low" });

    process.env.OPENAI_TEXT_REASONING_EFFORT = "off";
    expect(buildTextGenerationParams("gpt-6.2-astra", { temperature: 0.7, maxTokens: 900 })).toEqual({});
  });

  it("names model, status, param and code in API error descriptions", () => {
    expect(describeOpenAIError({ status: 404, code: "model_not_found", message: "The model does not exist" }, "gpt-x")).toBe(
      'OpenAI request failed (model "gpt-x", status 404, code model_not_found): The model does not exist'
    );
    expect(describeOpenAIError(new Error("socket hang up"), "gpt-x")).toBe('OpenAI request failed (model "gpt-x"): socket hang up');
  });

  it("uses the languages list for the current transcription models", () => {
    expect(buildTranscriptionLanguageHint("gpt-transcribe", "de")).toEqual({ languages: ["de"] });
    expect(buildTranscriptionLanguageHint("gpt-live-transcribe", "ko")).toEqual({ languages: ["ko"] });
    expect(buildTranscriptionLanguageHint("some-older-model", "ko")).toEqual({ language: "ko" });
  });
});

describe("model defaults and stale settings", () => {
  const ENV = ["OPENAI_TEXT_MODEL", "OPENAI_TTS_MODEL", "OPENAI_TRANSCRIPTION_MODEL", "OPENAI_IMAGE_MODEL"];
  afterEach(() => {
    ENV.forEach((name) => delete process.env[name]);
    vi.restoreAllMocks();
  });

  it("defaults to current models", () => {
    expect(getTextModel()).toBe("gpt-6-luna");
    expect(getSpeechModel()).toBe("gpt-realtime-2.1-mini");
    expect(getTranscriptionModel()).toBe("gpt-transcribe");
    expect(getImageModel()).toBe("gpt-image-2.6-flare");
  });

  it("replaces a deprecated id from env and warns once naming the variable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.OPENAI_TEXT_MODEL = "gpt-4o-mini";
    process.env.OPENAI_TTS_MODEL = "tts-1";
    process.env.OPENAI_TRANSCRIPTION_MODEL = "whisper-1";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-1.5";

    expect(getTextModel()).toBe("gpt-6-luna");
    expect(getTextModel()).toBe("gpt-6-luna");
    expect(getSpeechModel()).toBe("gpt-realtime-2.1-mini");
    expect(getTranscriptionModel()).toBe("gpt-transcribe");
    expect(getImageModel()).toBe("gpt-image-2.6-flare");

    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn.mock.calls[0][0]).toBe(
      '[openai] OPENAI_TEXT_MODEL="gpt-4o-mini" is deprecated or shut down by OpenAI; using "gpt-6-luna" instead. Update or remove OPENAI_TEXT_MODEL.'
    );
  });

  it("keeps a current id from env as configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.OPENAI_TEXT_MODEL = "gpt-6.1-terra";
    expect(resolveConfiguredModel("text", "OPENAI_TEXT_MODEL")).toBe("gpt-6.1-terra");
    expect(warn).not.toHaveBeenCalled();
  });

  it("maps every stale id to a model that is not itself stale for that use", () => {
    for (const [use, table] of Object.entries(STALE_MODELS) as Array<[keyof typeof STALE_MODELS, Record<string, string>]>) {
      for (const replacement of Object.values(table)) {
        expect(getStaleModelReplacement(use, replacement), `${use}: ${replacement}`).toBeNull();
      }
      expect(getStaleModelReplacement(use, DEFAULT_MODELS[use])).toBeNull();
    }
  });

  it("follows the deprecations page for the ids this app has used", () => {
    expect(getStaleModelReplacement("text", "gpt-4o-mini-2024-07-18")).toBe("gpt-6-luna");
    expect(getStaleModelReplacement("speech", "gpt-4o-mini-tts")).toBe("gpt-realtime-2.1-mini");
    expect(getStaleModelReplacement("realtime", "gpt-realtime")).toBe("gpt-realtime-2.1");
    expect(getStaleModelReplacement("realtime", "gpt-realtime-mini")).toBe("gpt-realtime-2.1-mini");
    expect(getStaleModelReplacement("realtimeTranscription", "gpt-4o-mini-transcribe")).toBe("gpt-live-transcribe");
    expect(getStaleModelReplacement("transcription", "gpt-4o-mini-transcribe-2025-12-15")).toBe("gpt-transcribe");
  });
});
