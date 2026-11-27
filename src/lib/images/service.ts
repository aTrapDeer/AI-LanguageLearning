import { after } from "next/server";
import { consumeAiQuota } from "@/lib/db/quota";
import {
  claimConceptImage,
  completeConceptImage,
  failConceptImage,
  findConceptImages,
  releaseConceptImage,
} from "@/lib/db/images";
import { getImageModel, isOpenAIConfigured } from "@/lib/openai";
import { conceptImageUrl } from "./concept";
import { describeImageError, normalisePicture, requestPicture } from "./generate";

/**
 * Vocabulary pictures: generated once per concept, stored, and shared. Everything here is best effort:
 * a failure only means a word has no picture, never that a lesson or review fails. Server-only.
 */

export interface PictureRequest {
  key: string;
  description: string;
}

export interface PictureDeps {
  /** Raw image bytes for a description (tests inject a fake instead of the Images API). */
  generate?: (description: string) => Promise<Uint8Array>;
  /** Keeps work running after the response is sent. Defaults to Next's `after()`. */
  defer?: (task: Promise<unknown>) => void;
  now?: () => Date;
}

const DEFAULT_PER_LESSON = 4;
const DEFAULT_WAIT_MS = 10_000;

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

/** `LESSON_IMAGES=off` turns pictures off entirely: none are generated or shown. */
export function picturesEnabled(): boolean {
  const value = process.env.LESSON_IMAGES?.trim().toLowerCase();
  return !(value === "off" || value === "false" || value === "0" || value === "no");
}

export function canGeneratePictures(): boolean {
  return picturesEnabled() && isOpenAIConfigured();
}

/** New pictures started per lesson start (the rest are filled in by later starts). */
export function picturesPerLesson(): number {
  return readInt("LESSON_IMAGES_PER_LESSON", DEFAULT_PER_LESSON, 0, 8);
}

/** How long a newly generated lesson waits for its pictures before responding anyway. */
export function pictureWaitMs(): number {
  return readInt("LESSON_IMAGES_WAIT_MS", DEFAULT_WAIT_MS, 0, 30_000);
}

function defaultDefer(task: Promise<unknown>) {
  try {
    after(task);
  } catch {
    // Outside a request (scripts, tests) there is no after(); the promise simply runs on.
  }
}

async function generateAndStore(id: string, request: PictureRequest, deps: PictureDeps): Promise<void> {
  try {
    const raw = await (deps.generate ?? ((description: string) => requestPicture(description)))(request.description);
    const picture = await normalisePicture(raw);
    await completeConceptImage({ id, ...picture, model: getImageModel() });
  } catch (error) {
    console.error("[CONCEPT_IMAGE]", request.key, describeImageError(error));
    try {
      await failConceptImage({ id, error: describeImageError(error), now: deps.now?.() });
    } catch (storeError) {
      console.error("[CONCEPT_IMAGE_STATE]", storeError);
    }
  }
}

function dedupe(requests: PictureRequest[]): PictureRequest[] {
  const seen = new Set<string>();
  return requests.filter((request) => {
    if (!request.key || !request.description || seen.has(request.key)) return false;
    seen.add(request.key);
    return true;
  });
}

/**
 * Starts generating pictures that do not exist yet (at most `limit`, each charged to the learner's
 * daily image quota), waits up to `waitMs` for them, and leaves the rest running after the response.
 * Resolves with the number of generations started. Never throws.
 */
export async function ensurePictures(params: {
  userId: string;
  requests: PictureRequest[];
  waitMs?: number;
  limit?: number;
  deps?: PictureDeps;
}): Promise<number> {
  const deps = params.deps ?? {};
  if (!picturesEnabled() || (!isOpenAIConfigured() && !deps.generate)) return 0;

  try {
    const limit = params.limit ?? picturesPerLesson();
    const requests = dedupe(params.requests);
    if (limit <= 0 || requests.length === 0) return 0;

    const existing = await findConceptImages(requests.map((request) => request.key));
    const missing = requests.filter((request) => existing.get(request.key)?.status !== "ready");

    const running: Promise<void>[] = [];
    for (const request of missing) {
      if (running.length >= limit) break;

      const claim = await claimConceptImage({ conceptKey: request.key, description: request.description, now: deps.now?.() });
      if (!claim.claimed) continue;

      const quota = await consumeAiQuota({ userId: params.userId, kind: "image" }).catch((error) => {
        // A quota-store outage should not stop learning features; count it as allowed.
        console.error("[AI_QUOTA]", error);
        return { allowed: true };
      });
      if (!quota.allowed) {
        await releaseConceptImage(claim.image.id, deps.now?.());
        break;
      }

      running.push(generateAndStore(claim.image.id, request, deps));
    }

    if (running.length === 0) return 0;

    const all = Promise.allSettled(running);
    const waitMs = Math.max(0, params.waitMs ?? 0);
    let finished = false;
    if (waitMs > 0) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), waitMs);
      });
      finished = (await Promise.race([all.then(() => "done" as const), timeout])) === "done";
      clearTimeout(timer);
    }
    if (!finished) {
      (deps.defer ?? defaultDefer)(all);
    }
    return running.length;
  } catch (error) {
    console.error("[CONCEPT_IMAGES]", error);
    return 0;
  }
}

/**
 * URLs for the concepts that have a picture or one being generated (the client retries a pending one).
 * Empty when pictures are switched off or on any error.
 */
export async function findPictureUrls(conceptKeys: Array<string | null | undefined>): Promise<Map<string, string>> {
  const keys = conceptKeys.filter((key): key is string => Boolean(key));
  if (!picturesEnabled() || keys.length === 0) return new Map();
  try {
    const rows = await findConceptImages(keys);
    const urls = new Map<string, string>();
    for (const [key, row] of rows) {
      if (row.status !== "failed") urls.set(key, conceptImageUrl(row.id));
    }
    return urls;
  } catch (error) {
    console.error("[CONCEPT_IMAGES_LOOKUP]", error);
    return new Map();
  }
}
