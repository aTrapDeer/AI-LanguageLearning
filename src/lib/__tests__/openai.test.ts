import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { generateJson, getSpeechModel, getTextModel, StructuredOutputError, type JsonChatClient } from "../openai";

type CreateParams = Parameters<JsonChatClient["chat"]["completions"]["create"]>[0];

function fakeClient(replies: Array<string | null | { refusal: string } | Error>) {
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
          if (reply && typeof reply === "object") {
            return { choices: [{ message: { content: null, refusal: reply.refusal } }] };
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
  });

  it("returns validated data and sends a strict json_schema response format", async () => {
    const { client, calls } = fakeClient([JSON.stringify({ words: [{ word: "Hund", translation: "dog" }] })]);
    const data = await generateJson({ ...base, client, temperature: 0.3 });

    expect(data.words[0].word).toBe("Hund");
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe("gpt-4o-mini");
    expect(calls[0].temperature).toBe(0.3);
    expect(calls[0].response_format).toMatchObject({ type: "json_schema", json_schema: { name: "words", strict: true } });
    expect(calls[0].messages[0]).toMatchObject({ role: "system", content: "You make flashcards." });
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

    const api = fakeClient([new Error("rate limited")]);
    const apiError = await expectError(generateJson({ ...base, client: api.client }));
    expect(apiError.kind).toBe("api");
    expect(apiError.message).toBe("rate limited");
    expect(api.calls).toHaveLength(1);
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
