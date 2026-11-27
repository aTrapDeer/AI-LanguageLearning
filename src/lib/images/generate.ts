import sharp from "sharp";
import { getImageComplexity, getImageModel, getImageQuality, getImageSize, getOpenAIClient } from "@/lib/openai";
import { buildImagePrompt, sniffImageFormat } from "./concept";

/** Calls the Images API and turns whatever comes back into a small stored WebP. Server-only. */

export const STORED_IMAGE_SIZE = 512;
export const TARGET_IMAGE_BYTES = 40 * 1024;
const WEBP_QUALITIES = [72, 60, 50, 40];
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
/** Image generation is slow; the shared client's 30 s default is too short. */
const IMAGE_REQUEST_TIMEOUT_MS = 55_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

/** The subset of the OpenAI client used here; lets tests inject a fake. */
export interface ImageApiClient {
  images: {
    generate(
      body: Record<string, unknown>,
      options?: { timeout?: number; maxRetries?: number }
    ): Promise<{ data?: Array<{ b64_json?: string | null; url?: string | null }> | null }>;
  };
}

export class ImageGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ImageGenerationError";
  }
}

/**
 * The exact request body. Only widely supported fields are sent: an unknown parameter fails the
 * whole request, and the response format is left to the model (b64_json or url are both handled).
 */
export function buildImageRequest(description: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: getImageModel(),
    prompt: buildImagePrompt(description),
    size: getImageSize(),
    quality: getImageQuality(),
    n: 1,
  };
  const complexity = getImageComplexity();
  if (complexity) {
    body.complexity = complexity;
  }
  return body;
}

async function download(url: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  if (!/^https?:\/\//i.test(url)) {
    throw new ImageGenerationError("image url is not http(s)");
  }
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) {
    throw new ImageGenerationError(`image download failed with HTTP ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_DOWNLOAD_BYTES) {
    throw new ImageGenerationError("image download too large");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new ImageGenerationError("image download too large");
  }
  return bytes;
}

/** Generates one picture and returns the raw image bytes (format checked, not assumed). */
export async function requestPicture(
  description: string,
  deps: { client?: ImageApiClient; fetchImpl?: typeof fetch } = {}
): Promise<Uint8Array> {
  const client = deps.client ?? (getOpenAIClient() as unknown as ImageApiClient);
  const response = await client.images.generate(buildImageRequest(description), {
    timeout: IMAGE_REQUEST_TIMEOUT_MS,
    // A failed picture is retried later with back-off rather than holding the request open.
    maxRetries: 0,
  });

  const first = response.data?.[0];
  let bytes: Uint8Array | null = null;
  if (first?.b64_json) {
    bytes = new Uint8Array(Buffer.from(first.b64_json, "base64"));
  } else if (first?.url) {
    bytes = await download(first.url, deps.fetchImpl ?? fetch);
  }

  if (!bytes || bytes.byteLength === 0) {
    throw new ImageGenerationError("the response contained no image");
  }
  if (!sniffImageFormat(bytes)) {
    throw new ImageGenerationError("the response was not a PNG, JPEG, WebP or GIF image");
  }
  return bytes;
}

export interface NormalisedPicture {
  data: Uint8Array;
  mimeType: "image/webp";
  width: number;
  height: number;
}

/** Square 512 px WebP on a white background, stepping quality down until it is small enough. */
export async function normalisePicture(input: Uint8Array): Promise<NormalisedPicture> {
  const base = sharp(input, { limitInputPixels: 4096 * 4096, animated: false })
    .rotate()
    .resize(STORED_IMAGE_SIZE, STORED_IMAGE_SIZE, { fit: "cover", position: "centre" })
    .flatten({ background: "#ffffff" });

  let output: { data: Buffer; info: sharp.OutputInfo } | null = null;
  for (const quality of WEBP_QUALITIES) {
    output = await base.clone().webp({ quality, effort: 5 }).toBuffer({ resolveWithObject: true });
    if (output.data.byteLength <= TARGET_IMAGE_BYTES) break;
  }

  if (!output) {
    throw new ImageGenerationError("could not encode the image");
  }
  return { data: new Uint8Array(output.data), mimeType: "image/webp", width: output.info.width, height: output.info.height };
}

/** Short, log-safe summary of a failure (never the response body or the key). */
export function describeImageError(error: unknown): string {
  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status;
    const message = error instanceof Error ? error.message : String(error);
    const prefix = typeof status === "number" && !message.startsWith(String(status)) ? `${status} ` : "";
    return `${prefix}${message}`.slice(0, 300);
  }
  return String(error).slice(0, 300);
}
