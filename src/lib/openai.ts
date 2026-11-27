import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ZodType, ZodTypeDef } from "zod";

/** Model names come from env so they can be changed without a deploy. */
export function getTextModel(): string {
  return process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
}

export function getSpeechModel(): string {
  return process.env.OPENAI_TTS_MODEL?.trim() || "tts-1";
}

/** File-upload transcription (the `/api/transcribe` and chat audio routes). */
export function getTranscriptionModel(): string {
  return process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "whisper-1";
}

/** Images API model for vocabulary pictures. */
export function getImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2.6-flare";
}

/** Passed through as-is: the accepted values differ between image models. */
export function getImageQuality(): string {
  return process.env.OPENAI_IMAGE_QUALITY?.trim() || "low";
}

export function getImageSize(): string {
  const size = process.env.OPENAI_IMAGE_SIZE?.trim();
  return size && /^(\d{2,4}x\d{2,4}|auto)$/.test(size) ? size : "1024x1024";
}

/**
 * Optional `complexity` request field. Sent only when configured, because not every image model
 * accepts it and an unknown parameter fails the whole request.
 */
export function getImageComplexity(): string | null {
  return process.env.OPENAI_IMAGE_COMPLEXITY?.trim() || null;
}

export class OpenAIConfigError extends Error {
  constructor(message = "OPENAI_API_KEY is not set") {
    super(message);
    this.name = "OpenAIConfigError";
  }
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

let cachedClient: OpenAI | null = null;

/** Shared client. Throws {@link OpenAIConfigError} when no API key is configured. */
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIConfigError();
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 2 });
  }

  return cachedClient;
}

/** The subset of the OpenAI client `generateJson` needs; lets tests inject a fake. */
export interface JsonChatClient {
  chat: {
    completions: {
      create(params: ChatCompletionCreateParamsNonStreaming): Promise<{
        choices: Array<{ message: { content: string | null; refusal?: string | null }; finish_reason?: string | null }>;
      }>;
    };
  };
}

export type StructuredOutputErrorKind = "config" | "api" | "empty" | "refusal" | "invalid_json" | "schema_mismatch";

export class StructuredOutputError extends Error {
  readonly kind: StructuredOutputErrorKind;
  readonly attempts: number;
  /** Zod issue summaries or the JSON parse error for the last attempt. */
  readonly issues: string[];
  /** Last raw model output, for logging. Never send this to clients. */
  readonly raw: string | null;

  constructor(
    kind: StructuredOutputErrorKind,
    message: string,
    details: { attempts: number; issues?: string[]; raw?: string | null; cause?: unknown }
  ) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = "StructuredOutputError";
    this.kind = kind;
    this.attempts = details.attempts;
    this.issues = details.issues ?? [];
    this.raw = details.raw ?? null;
  }
}

export interface GenerateJsonOptions<T> {
  /** Zod schema the output must satisfy. */
  schema: ZodType<T, ZodTypeDef, unknown>;
  /** Short identifier sent to the API as the JSON schema name ([a-zA-Z0-9_-]). */
  schemaName: string;
  system: string;
  /** A user prompt, or a full message list (system prompt is still prepended). */
  user: string | ChatCompletionMessageParam[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * true (default): strict JSON-schema structured output. The schema must then be strict-compatible:
   * every property required (use `.nullable()` instead of `.optional()`), no `.default()`, no records.
   * false: plain JSON mode; the schema is only enforced locally by zod (use for loose/legacy shapes).
   */
  strict?: boolean;
  /** Total tries including the first. Default 2 (one retry on invalid output). */
  maxAttempts?: number;
  client?: JsonChatClient;
}

function describeIssues(error: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  return error.issues.slice(0, 8).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

function stripCodeFence(raw: string) {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

/**
 * Calls chat completions with structured output, validates the reply with `schema`, and retries once
 * (feeding the validation errors back to the model) when the output is not valid.
 * Throws {@link StructuredOutputError} on every failure path.
 */
export async function generateJson<T>(options: GenerateJsonOptions<T>): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const strict = options.strict ?? true;

  let client: JsonChatClient;
  try {
    client = options.client ?? (getOpenAIClient() as unknown as JsonChatClient);
  } catch (error) {
    throw new StructuredOutputError("config", error instanceof Error ? error.message : "OpenAI is not configured", {
      attempts: 0,
      cause: error,
    });
  }

  let responseFormat: ChatCompletionCreateParamsNonStreaming["response_format"];
  if (strict) {
    try {
      const format = zodResponseFormat(options.schema as ZodType, options.schemaName);
      responseFormat = { type: "json_schema", json_schema: format.json_schema };
    } catch (error) {
      throw new StructuredOutputError("config", `Schema "${options.schemaName}" is not strict-compatible`, {
        attempts: 0,
        cause: error,
      });
    }
  } else {
    responseFormat = { type: "json_object" };
  }

  const systemContent = strict ? options.system : `${options.system}\n\nRespond with a single JSON object only.`;
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...(typeof options.user === "string" ? [{ role: "user" as const, content: options.user }] : options.user),
  ];

  let lastKind: StructuredOutputErrorKind = "empty";
  let lastIssues: string[] = [];
  let lastRaw: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let completion: Awaited<ReturnType<JsonChatClient["chat"]["completions"]["create"]>>;
    try {
      completion = await client.chat.completions.create({
        model: options.model ?? getTextModel(),
        messages,
        response_format: responseFormat,
        ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        ...(options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }),
      });
    } catch (error) {
      throw new StructuredOutputError("api", error instanceof Error ? error.message : "OpenAI request failed", {
        attempts: attempt,
        cause: error,
      });
    }

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new StructuredOutputError("refusal", "The model refused to generate this content", {
        attempts: attempt,
        raw: message.refusal,
      });
    }

    const raw = message?.content ?? null;
    lastRaw = raw;

    if (!raw || !raw.trim()) {
      lastKind = "empty";
      lastIssues = ["empty response"];
    } else {
      let parsed: unknown;
      let parseFailed = false;
      try {
        parsed = JSON.parse(stripCodeFence(raw));
      } catch (error) {
        parseFailed = true;
        lastKind = "invalid_json";
        lastIssues = [error instanceof Error ? error.message : "invalid JSON"];
      }

      if (!parseFailed) {
        const result = options.schema.safeParse(parsed);
        if (result.success) {
          return result.data;
        }

        lastKind = "schema_mismatch";
        lastIssues = describeIssues(result.error);
      }
    }

    if (attempt < maxAttempts) {
      messages.push(
        { role: "assistant", content: raw ?? "" },
        {
          role: "user",
          content: `That reply was not valid for the required JSON format:\n- ${lastIssues.join("\n- ")}\nReply again with only the corrected JSON object.`,
        }
      );
    }
  }

  throw new StructuredOutputError(lastKind, `Model output did not match "${options.schemaName}" after ${maxAttempts} attempts`, {
    attempts: maxAttempts,
    issues: lastIssues,
    raw: lastRaw,
  });
}
