import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ZodType, ZodTypeDef } from "zod";

export type ModelUse = "text" | "speech" | "transcription" | "realtime" | "realtimeTranscription" | "image";

export const DEFAULT_MODELS: Readonly<Record<ModelUse, string>> = {
  text: "gpt-6-luna",
  // Every `/v1/audio/speech` model is being retired; speech is generated through the Realtime API instead.
  speech: "gpt-realtime-2.1-mini",
  transcription: "gpt-transcribe",
  realtime: "gpt-realtime-2.1",
  // Realtime input transcription over WebRTC; `gpt-transcribe` there needs a WebSocket session.
  realtimeTranscription: "gpt-live-transcribe",
  image: "gpt-image-2.6-flare",
};

const REALTIME_REPLACEMENTS: Record<string, string> = {
  "gpt-realtime": "gpt-realtime-2.1",
  "gpt-realtime-2025-08-28": "gpt-realtime-2.1",
  "gpt-4o-realtime": "gpt-realtime-2.1",
  "gpt-4o-realtime-preview": "gpt-realtime-2.1",
  "gpt-4o-realtime-preview-2024-10-01": "gpt-realtime-2.1",
  "gpt-4o-realtime-preview-2024-12-17": "gpt-realtime-2.1",
  "gpt-4o-realtime-preview-2025-06-03": "gpt-realtime-2.1",
  "gpt-realtime-mini": "gpt-realtime-2.1-mini",
  "gpt-realtime-mini-2025-10-06": "gpt-realtime-2.1-mini",
  "gpt-realtime-mini-2025-12-15": "gpt-realtime-2.1-mini",
  "gpt-4o-mini-realtime": "gpt-realtime-2.1-mini",
  "gpt-4o-mini-realtime-preview": "gpt-realtime-2.1-mini",
  "gpt-4o-mini-realtime-preview-2024-12-17": "gpt-realtime-2.1-mini",
};

const STALE_TRANSCRIPTION_MODELS = [
  "whisper-1",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
  "gpt-4o-mini-transcribe",
  "gpt-4o-mini-transcribe-2025-03-20",
  "gpt-4o-mini-transcribe-2025-12-15",
];

const replaceAll = (ids: string[], replacement: string) => Object.fromEntries(ids.map((id) => [id, replacement]));

/**
 * Ids OpenAI lists as deprecated or shut down (developers.openai.com/api/docs/deprecations, checked
 * 2026-11-27), per use, mapped to the model used instead. Upcoming shutdowns map to the replacement the
 * deprecations page recommends; ids that are already shut down map to the current model of the same tier.
 * A configured env value found here is ignored (with a warning) so a forgotten deployment setting cannot
 * keep the app on a retired model.
 */
export const STALE_MODELS: Readonly<Record<ModelUse, Readonly<Record<string, string>>>> = {
  text: {
    ...replaceAll(
      [
        "gpt-4o-mini",
        "gpt-4o-mini-2024-07-18",
        "gpt-4o",
        "gpt-4o-2024-05-13",
        "gpt-4o-2024-08-06",
        "gpt-4o-2024-11-20",
        "gpt-4.1",
        "gpt-4.1-2025-04-14",
        "gpt-4.1-mini",
        "gpt-4.1-mini-2025-04-14",
        "gpt-4.1-nano",
        "gpt-4.1-nano-2025-04-14",
        "gpt-5-nano",
        "gpt-5-nano-2025-08-07",
        "gpt-5.4-nano",
        "gpt-5.4-nano-2026-03-17",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-0125",
        "gpt-3.5-turbo-1106",
      ],
      "gpt-6-luna"
    ),
    ...replaceAll(["gpt-5-mini", "gpt-5-mini-2025-08-07"], "gpt-6.1-terra"),
    ...replaceAll(["gpt-5", "gpt-5-2025-08-07"], "gpt-6.1-sol"),
    ...replaceAll(["gpt-5.1", "gpt-5.1-2025-11-13"], "gpt-6-sol"),
  },
  speech: {
    ...replaceAll(
      ["tts-1", "tts-1-hd", "gpt-4o-mini-tts", "gpt-4o-mini-tts-2025-03-20", "gpt-4o-mini-tts-2025-12-15"],
      "gpt-realtime-2.1-mini"
    ),
    ...REALTIME_REPLACEMENTS,
  },
  transcription: replaceAll(STALE_TRANSCRIPTION_MODELS, "gpt-transcribe"),
  realtime: REALTIME_REPLACEMENTS,
  realtimeTranscription: replaceAll(STALE_TRANSCRIPTION_MODELS, "gpt-live-transcribe"),
  image: replaceAll(
    [
      "dall-e-2",
      "dall-e-3",
      "gpt-image-1",
      "gpt-image-1-mini",
      "gpt-image-1.5",
      "gpt-image-1.5-2025-12-16",
      "chatgpt-image-latest",
      "gpt-image-2",
      "gpt-image-2-2026-04-21",
    ],
    "gpt-image-2.6-flare"
  ),
};

export function getStaleModelReplacement(use: ModelUse, model: string): string | null {
  return STALE_MODELS[use][model] ?? null;
}

const warnedStaleSettings = new Set<string>();

/** Reads a model id from `envName`, swapping a deprecated or shut-down id for its replacement. */
export function resolveConfiguredModel(use: ModelUse, envName: string): string {
  const configured = process.env[envName]?.trim();
  if (!configured) {
    return DEFAULT_MODELS[use];
  }

  const replacement = getStaleModelReplacement(use, configured);
  if (!replacement) {
    return configured;
  }

  const key = `${envName}=${configured}`;
  if (!warnedStaleSettings.has(key)) {
    warnedStaleSettings.add(key);
    console.warn(
      `[openai] ${envName}="${configured}" is deprecated or shut down by OpenAI; using "${replacement}" instead. Update or remove ${envName}.`
    );
  }
  return replacement;
}

/** Model names come from env so they can be changed without a deploy. */
export function getTextModel(): string {
  return resolveConfiguredModel("text", "OPENAI_TEXT_MODEL");
}

/** A Realtime model: the listen button reads text aloud through a short Realtime session. */
export function getSpeechModel(): string {
  return resolveConfiguredModel("speech", "OPENAI_TTS_MODEL");
}

/** File-upload transcription (the `/api/transcribe` and chat audio routes). */
export function getTranscriptionModel(): string {
  return resolveConfiguredModel("transcription", "OPENAI_TRANSCRIPTION_MODEL");
}

/**
 * `gpt-transcribe` and `gpt-live-transcribe` take a `languages` list and reject the older singular
 * `language` hint alongside it; older transcription models only know `language`.
 */
export function buildTranscriptionLanguageHint(model: string, languageCode: string): { languages: string[] } | { language: string } {
  return /^gpt-(live-)?transcribe/.test(model) ? { languages: [languageCode] } : { language: languageCode };
}

/** Images API model for vocabulary pictures. */
export function getImageModel(): string {
  return resolveConfiguredModel("image", "OPENAI_IMAGE_MODEL");
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
 * `complexity` controls how much the model plans before rendering. The 2.6 image models accept it
 * and default to "high"; simple one-subject illustrations don't need that, and "low" is faster at
 * no extra cost. Other models may reject the field, so it is only sent for 2.6 unless configured.
 * Set OPENAI_IMAGE_COMPLEXITY="off" to never send it.
 */
export function getImageComplexity(): string | null {
  const configured = process.env.OPENAI_IMAGE_COMPLEXITY?.trim().toLowerCase();
  if (configured) {
    return configured === "off" ? null : configured;
  }
  return getImageModel().startsWith("gpt-image-2.6") ? "low" : null;
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

const REASONING_MODEL = /^(gpt-5|gpt-6|o\d)/;

/** GPT-5/GPT-6 and o-series models reason before answering, which changes the parameters they accept. */
export function isReasoningModel(model: string): boolean {
  return REASONING_MODEL.test(model);
}

/**
 * Reasoning effort for text generation. "none" (the default) gives the lowest latency, matches the
 * non-reasoning models this app was written for, and keeps `temperature` available. Set
 * OPENAI_TEXT_REASONING_EFFORT to low/medium/... for more deliberate output, or "off" to send nothing
 * and use the model's own default (required for models that reject "none").
 */
export function getTextReasoningEffort(model: string): string | null {
  if (!isReasoningModel(model)) {
    return null;
  }
  const configured = process.env.OPENAI_TEXT_REASONING_EFFORT?.trim().toLowerCase();
  if (configured === "off") {
    return null;
  }
  return configured || "none";
}

/** Sampling and length parameters a Chat Completions request may carry for `model`. */
export function buildTextGenerationParams(
  model: string,
  options: { temperature?: number; maxTokens?: number }
): Pick<ChatCompletionCreateParamsNonStreaming, "reasoning_effort" | "temperature" | "max_completion_tokens"> {
  const effort = getTextReasoningEffort(model);
  // Reasoning models only accept sampling settings when they are not reasoning.
  const sampling = !isReasoningModel(model) || effort === "none";
  return {
    // SDK 4 types predate "none" and the newer effort levels; the API accepts them.
    ...(effort ? { reasoning_effort: effort as ChatCompletionCreateParamsNonStreaming["reasoning_effort"] } : {}),
    ...(sampling && options.temperature !== undefined ? { temperature: options.temperature } : {}),
    // The cap counts reasoning tokens too, so a cap sized for the visible reply is only safe without reasoning.
    ...(sampling && options.maxTokens !== undefined ? { max_completion_tokens: options.maxTokens } : {}),
  };
}

/** Instructions role: newer models take `developer` in place of `system`. */
export function instructionsRole(model: string): "developer" | "system" {
  return isReasoningModel(model) ? "developer" : "system";
}

/** One log line naming the model, status, parameter and code of a failed OpenAI request. */
export function describeOpenAIError(error: unknown, model: string): string {
  const details = (error ?? {}) as { status?: unknown; param?: unknown; code?: unknown; message?: unknown };
  const parts = [`model "${model}"`];
  if (typeof details.status === "number") parts.push(`status ${details.status}`);
  if (typeof details.param === "string" && details.param) parts.push(`param "${details.param}"`);
  if (typeof details.code === "string" && details.code) parts.push(`code ${details.code}`);
  const message = typeof details.message === "string" && details.message ? details.message : String(error);
  return `OpenAI request failed (${parts.join(", ")}): ${message}`;
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
 * Calls Chat Completions with structured output, validates the reply with `schema`, and retries once
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

  const model = options.model ?? getTextModel();
  const systemContent = strict ? options.system : `${options.system}\n\nRespond with a single JSON object only.`;
  const messages: ChatCompletionMessageParam[] = [
    { role: instructionsRole(model), content: systemContent },
    ...(typeof options.user === "string" ? [{ role: "user" as const, content: options.user }] : options.user),
  ];

  let lastKind: StructuredOutputErrorKind = "empty";
  let lastIssues: string[] = [];
  let lastRaw: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let completion: Awaited<ReturnType<JsonChatClient["chat"]["completions"]["create"]>>;
    try {
      completion = await client.chat.completions.create({
        model,
        messages,
        response_format: responseFormat,
        ...buildTextGenerationParams(model, options),
      });
    } catch (error) {
      throw new StructuredOutputError("api", describeOpenAIError(error, model), { attempts: attempt, cause: error });
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

    const truncated = completion.choices[0]?.finish_reason === "length";

    if (!raw || !raw.trim()) {
      lastKind = "empty";
      lastIssues = [truncated ? "empty response (stopped at the token limit)" : "empty response"];
    } else {
      let parsed: unknown;
      let parseFailed = false;
      try {
        parsed = JSON.parse(stripCodeFence(raw));
      } catch (error) {
        parseFailed = true;
        lastKind = "invalid_json";
        lastIssues = [error instanceof Error ? error.message : "invalid JSON"];
        if (truncated) lastIssues.push("the reply stopped at the token limit");
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
