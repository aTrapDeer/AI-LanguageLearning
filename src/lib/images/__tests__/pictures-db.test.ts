import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLessonPlan } from "@/lib/lesson/builder";
import { validateLessonContent, validateStoredContent, type GeneratedLessonContent } from "@/lib/lesson/content";
import { getStarterContent, STARTER_UNIT_ID } from "@/lib/lesson/starter-content";
import type { LessonPlan } from "@/lib/lesson/types";

/**
 * Pictures against a real SQLite file, starting from the schema exactly as it was before pictures
 * existed, with production-like rows that must survive the migration.
 */

type Db = typeof import("../../database");
type Service = typeof import("../service");
type Pictures = typeof import("../../lesson/pictures");
type LessonService = typeof import("../../lesson/service");

let dir: string;
let raw: Client;
let db: Db;
let service: Service;
let pictures: Pictures;
let lessons: LessonService;

const T = "2026-11-01T00:00:00.000Z";

const PRE_PICTURE_SCHEMA = [
  `CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, password TEXT,
    native_language TEXT NOT NULL DEFAULT 'English', active_language TEXT NOT NULL DEFAULT 'en',
    learning_languages TEXT NOT NULL DEFAULT '[]', account_setup INTEGER NOT NULL DEFAULT 0, email_verified TEXT, image TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, daily_xp_goal INTEGER)`,
  `CREATE TABLE progress (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, language TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, language),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
  `CREATE TABLE learning (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, language TEXT NOT NULL, word TEXT NOT NULL,
    translation TEXT NOT NULL, difficulty INTEGER NOT NULL DEFAULT 0, last_recalled TEXT NOT NULL, next_review TEXT NOT NULL,
    success_count INTEGER NOT NULL DEFAULT 0, failure_count INTEGER NOT NULL DEFAULT 0, notes TEXT, tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, normalized_word TEXT, interval_days REAL NOT NULL DEFAULT 0,
    ease REAL NOT NULL DEFAULT 2.5, repetitions INTEGER NOT NULL DEFAULT 0, lapses INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual', unit_id TEXT, romanization TEXT, example_sentence TEXT, example_translation TEXT,
    last_reviewed_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
  `CREATE TABLE lessons (id TEXT PRIMARY KEY, language TEXT NOT NULL, level INTEGER NOT NULL, unit_id TEXT NOT NULL,
    content TEXT NOT NULL, content_version INTEGER NOT NULL DEFAULT 1, created_by TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE lesson_attempts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, lesson_id TEXT NOT NULL, language TEXT NOT NULL,
    level INTEGER NOT NULL, unit_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    correct_count INTEGER NOT NULL DEFAULT 0, total_count INTEGER NOT NULL DEFAULT 0, accuracy REAL NOT NULL DEFAULT 0,
    stars INTEGER NOT NULL DEFAULT 0, xp_awarded INTEGER NOT NULL DEFAULT 0, state TEXT, started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, completed_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE)`,
  `CREATE TABLE ai_usage (user_id TEXT NOT NULL, usage_date TEXT NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL, PRIMARY KEY (user_id, usage_date, kind))`,
  `CREATE UNIQUE INDEX idx_learning_user_language_word ON learning(user_id, language, normalized_word)`,
];

/** A version-1 lesson exactly as stored before pictures: no `picture` on any item. */
function versionOneContent() {
  const result = validateLessonContent(getStarterContent("de", STARTER_UNIT_ID), "de");
  if (!result.ok) throw new Error(result.errors.join("; "));
  return {
    ...result.content,
    vocabulary: result.content.vocabulary.map((item) => {
      const copy: Record<string, unknown> = { ...item };
      delete copy.picture;
      return copy;
    }),
  };
}

async function createPrePictureDatabase(url: string) {
  const client = createClient({ url, intMode: "number" });
  await client.batch(
    [
      ...PRE_PICTURE_SCHEMA,
      `INSERT INTO users (id, name, email, password, active_language, learning_languages, account_setup, created_at, updated_at)
        VALUES ('u-old', 'Old', 'old@example.com', '$2a$12$hash', 'de', '["de"]', 1, '${T}', '${T}')`,
      `INSERT INTO progress (id, user_id, language, level, xp, created_at, updated_at) VALUES ('p-old', 'u-old', 'de', 2, 340, '${T}', '${T}')`,
      `INSERT INTO learning (id, user_id, language, word, translation, last_recalled, next_review, created_at, updated_at, normalized_word, source)
        VALUES ('w-old', 'u-old', 'de', 'der Hund', 'dog', '${T}', '${T}', '${T}', '${T}', 'der hund', 'journey')`,
      {
        sql: `INSERT INTO lessons (id, language, level, unit_id, content, content_version, created_by, created_at)
          VALUES ('l-old', 'de', 1, ?, ?, 1, NULL, '${T}')`,
        args: [STARTER_UNIT_ID, JSON.stringify(versionOneContent())],
      },
      `INSERT INTO lesson_attempts (id, user_id, lesson_id, language, level, unit_id, status, state, started_at, updated_at)
        VALUES ('a-old', 'u-old', 'l-old', 'de', 1, '${STARTER_UNIT_ID}', 'completed', NULL, '${T}', '${T}')`,
    ],
    "write"
  );
  client.close();
}

async function png(color: string): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width: 1024, height: 1024, channels: 3, background: color } }).png().toBuffer());
}

/** Fake Images API: records each description it is asked for. */
function fakeGenerator(options: { delayMs?: number; fail?: boolean } = {}) {
  const calls: string[] = [];
  const generate = vi.fn(async (description: string) => {
    calls.push(description);
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (options.fail) throw Object.assign(new Error("500 stub failure"), { status: 500 });
    return png("#e74c3c");
  });
  return { calls, generate };
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "laingfy-pictures-"));
  const url = `file:${path.join(dir, "test.db")}`;
  await createPrePictureDatabase(url);
  process.env.TURSO_DATABASE_URL = url;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.OPENAI_API_KEY;
  raw = createClient({ url, intMode: "number" });
  db = await import("../../database");
  service = await import("../service");
  pictures = await import("../../lesson/pictures");
  lessons = await import("../../lesson/service");
  await db.initializeDatabaseSchema();
});

afterAll(() => {
  raw?.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  delete process.env.LESSON_IMAGES;
  delete process.env.AI_DAILY_LIMIT_IMAGE;
});

describe("migration from the pre-picture schema", () => {
  it("adds the picture table and column and keeps every existing row", async () => {
    const learningColumns = (await raw.execute("PRAGMA table_info(learning)")).rows.map((row) => String(row.name));
    expect(learningColumns).toContain("image_key");
    const imageColumns = (await raw.execute("PRAGMA table_info(concept_images)")).rows.map((row) => String(row.name));
    expect(imageColumns).toEqual(expect.arrayContaining(["id", "concept_key", "status", "data", "mime_type", "retry_after"]));

    expect((await raw.execute("SELECT email, password FROM users WHERE id = 'u-old'")).rows[0]).toMatchObject({
      email: "old@example.com",
      password: "$2a$12$hash",
    });
    expect((await raw.execute("SELECT level, xp FROM progress WHERE id = 'p-old'")).rows[0]).toMatchObject({ level: 2, xp: 340 });
    expect((await raw.execute("SELECT word, image_key FROM learning WHERE id = 'w-old'")).rows[0]).toMatchObject({
      word: "der Hund",
      image_key: null,
    });
    expect((await raw.execute("SELECT status FROM lesson_attempts WHERE id = 'a-old'")).rows[0]).toMatchObject({ status: "completed" });

    await db.initializeDatabaseSchema();
    const { migrateSchema } = await import("../../db/schema");
    await migrateSchema(raw);
    expect((await raw.execute("SELECT COUNT(*) AS n FROM lessons")).rows[0].n).toBe(1);
  });

  it("still plays a version-1 lesson, just without pictures", async () => {
    const stored = await db.getLessonById("l-old");
    const content = validateStoredContent(stored?.content, "de");
    expect(content).not.toBeNull();
    expect(content!.vocabulary.every((item) => !item.picture)).toBe(true);
    const plan = buildLessonPlan(content!, { language: "de", lessonId: "l-old", unitId: STARTER_UNIT_ID, seed: 3 });
    expect(plan.newWords.every((word) => !word.picture)).toBe(true);
    const { generate } = fakeGenerator();
    const prepared = await pictures.preparePlanPictures({ userId: "u-old", plan, freshlyGenerated: true, deps: { generate } });
    expect(prepared.steps).toEqual(plan.steps);
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("concept image claims", () => {
  it("lets exactly one of many concurrent requests generate a concept", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => db.claimConceptImage({ conceptKey: "race apple", description: "a red apple" }))
    );
    expect(results.filter((result) => result.claimed)).toHaveLength(1);
    expect(new Set(results.map((result) => result.image?.id)).size).toBe(1);
  });

  it("backs off after a failure and can be retried once the back-off has passed", async () => {
    const now = new Date("2026-11-20T10:00:00.000Z");
    const first = await db.claimConceptImage({ conceptKey: "backoff pear", description: "a pear", now });
    expect(first.claimed).toBe(true);
    if (!first.claimed) return;
    await db.failConceptImage({ id: first.image.id, error: "500 stub", now });

    const soon = new Date(now.getTime() + 60_000);
    expect((await db.claimConceptImage({ conceptKey: "backoff pear", description: "a pear", now: soon })).claimed).toBe(false);

    const later = new Date(now.getTime() + db.retryDelayMs(1) + 1000);
    const retry = await db.claimConceptImage({ conceptKey: "backoff pear", description: "a pear", now: later });
    expect(retry).toMatchObject({ claimed: true, image: { id: first.image.id } });
    expect(db.retryDelayMs(2)).toBe(2 * db.retryDelayMs(1));
    expect(db.retryDelayMs(30)).toBe(24 * 60 * 60 * 1000);
  });

  it("takes over a claim abandoned mid-generation", async () => {
    const now = new Date("2026-11-20T10:00:00.000Z");
    expect((await db.claimConceptImage({ conceptKey: "stale kiwi", description: "a kiwi", now })).claimed).toBe(true);
    const sameMinute = new Date(now.getTime() + 30_000);
    expect((await db.claimConceptImage({ conceptKey: "stale kiwi", description: "a kiwi", now: sameMinute })).claimed).toBe(false);
    const muchLater = new Date(now.getTime() + db.STALE_CLAIM_MS + 1000);
    expect((await db.claimConceptImage({ conceptKey: "stale kiwi", description: "a kiwi", now: muchLater })).claimed).toBe(true);
  });
});

describe("ensurePictures", () => {
  it("generates each missing concept once, stores a small WebP and charges the image quota", async () => {
    const { calls, generate } = fakeGenerator();
    const started = await service.ensurePictures({
      userId: "u-quota",
      requests: [
        { key: "banana", description: "a yellow banana" },
        { key: "banana", description: "a yellow banana" },
        { key: "cat", description: "a sitting cat" },
      ],
      waitMs: 5000,
      deps: { generate, defer: () => undefined },
    });
    expect(started).toBe(2);
    expect(calls.sort()).toEqual(["a sitting cat", "a yellow banana"]);
    expect(await db.getAiUsage("u-quota", "image")).toBe(2);

    const rows = await db.findConceptImages(["banana", "cat"]);
    expect(rows.get("banana")?.status).toBe("ready");
    const stored = await db.getConceptImageData(rows.get("banana")!.id);
    expect(stored?.mimeType).toBe("image/webp");
    expect(stored!.data!.byteLength).toBeLessThan(40 * 1024);
    expect((await sharp(stored!.data!).metadata()).width).toBe(512);

    // Ready concepts are reused for free, by anyone, in any language.
    const again = fakeGenerator();
    expect(
      await service.ensurePictures({ userId: "u-other", requests: [{ key: "banana", description: "a banana" }], deps: again })
    ).toBe(0);
    expect(again.generate).not.toHaveBeenCalled();
  });

  it("caps new pictures per call and stops when the daily quota is used up", async () => {
    process.env.AI_DAILY_LIMIT_IMAGE = "1";
    const { generate } = fakeGenerator();
    const requests = ["q1", "q2", "q3"].map((key) => ({ key, description: `a ${key}` }));
    expect(await service.ensurePictures({ userId: "u-capped", requests, waitMs: 5000, limit: 4, deps: { generate } })).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    // The refused claim was released, so it is free for the next learner with quota left.
    const released = (await db.findConceptImages(["q2"])).get("q2");
    expect(released?.status).toBe("failed");
    delete process.env.AI_DAILY_LIMIT_IMAGE;
    const next = fakeGenerator();
    expect(await service.ensurePictures({ userId: "u-fresh", requests, waitMs: 5000, limit: 1, deps: next })).toBe(1);
    expect(next.calls).toEqual(["a q2"]);
  });

  it("waits only up to the bound and finishes slow pictures after the response", async () => {
    const { generate } = fakeGenerator({ delayMs: 400 });
    const deferred: Promise<unknown>[] = [];
    const startedAt = Date.now();
    await service.ensurePictures({
      userId: "u-slow",
      requests: [{ key: "slow turtle", description: "a turtle" }],
      waitMs: 50,
      deps: { generate, defer: (task) => deferred.push(task) },
    });
    expect(Date.now() - startedAt).toBeLessThan(350);
    expect(deferred).toHaveLength(1);
    expect((await db.findConceptImages(["slow turtle"])).get("slow turtle")?.status).toBe("pending");
    await deferred[0];
    expect((await db.findConceptImages(["slow turtle"])).get("slow turtle")?.status).toBe("ready");
  });

  it("records failures without throwing and does nothing when switched off", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing = fakeGenerator({ fail: true });
    await service.ensurePictures({ userId: "u-fail", requests: [{ key: "broken", description: "x" }], waitMs: 2000, deps: failing });
    expect((await db.findConceptImages(["broken"])).get("broken")?.status).toBe("failed");
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();

    process.env.LESSON_IMAGES = "off";
    const off = fakeGenerator();
    expect(await service.ensurePictures({ userId: "u-off", requests: [{ key: "lamp", description: "a lamp" }], deps: off })).toBe(0);
    expect(off.generate).not.toHaveBeenCalled();
    expect((await service.findPictureUrls(["banana"])).size).toBe(0);
  });

  it("is a no-op without OpenAI unless a generator is injected", async () => {
    expect(service.canGeneratePictures()).toBe(false);
    expect(await service.ensurePictures({ userId: "u-none", requests: [{ key: "chair", description: "a chair" }] })).toBe(0);
    expect((await db.findConceptImages(["chair"])).size).toBe(0);
  });
});

describe("GET /api/images/:id", () => {
  it("serves ready pictures immutably, 202 while pending and 404 otherwise", async () => {
    const { GET } = await import("@/app/api/images/[id]/route");
    const call = (id: string) => GET(new Request(`http://test/api/images/${id}`), { params: Promise.resolve({ id }) });

    const ready = (await db.findConceptImages(["banana"])).get("banana")!;
    const ok = await call(ready.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/webp");
    expect(ok.headers.get("cache-control")).toContain("immutable");
    expect((await sharp(Buffer.from(await ok.arrayBuffer())).metadata()).format).toBe("webp");

    const pending = await db.claimConceptImage({ conceptKey: "pending owl", description: "an owl" });
    const waiting = await call(pending.image!.id);
    expect(waiting.status).toBe(202);
    expect(waiting.headers.get("cache-control")).toBe("no-store");

    const failed = (await db.findConceptImages(["broken"])).get("broken")!;
    expect((await call(failed.id)).status).toBe(404);
    expect((await call("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await call("../../users")).status).toBe(404);
    expect((await call("u-old")).status).toBe(404);
  });
});

describe("pictures through lessons and review", () => {
  /** The German first unit with a picture on "please" (test content, not the real starter). */
  function contentWithPictures(): GeneratedLessonContent {
    const base = getStarterContent("de", STARTER_UNIT_ID)!;
    return {
      ...base,
      vocabulary: base.vocabulary.map((item) =>
        item.translation === "please" ? { ...item, picture: "a hand politely offering a cup of coffee" } : item
      ),
    };
  }

  it("resolves URLs per response, shows pictures only where they cannot give the answer away, and links review words", async () => {
    await raw.execute(
      `INSERT INTO users (id, email, active_language, learning_languages, account_setup, created_at, updated_at)
        VALUES ('u-pic', 'pic@example.com', 'de', '["de"]', 1, '${T}', '${T}')`
    );
    await raw.execute(`INSERT INTO progress (id, user_id, language, level, xp, created_at, updated_at) VALUES ('p-pic', 'u-pic', 'de', 1, 0, '${T}', '${T}')`);

    const validated = validateLessonContent(contentWithPictures(), "de");
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    await db.insertLesson({ language: "de", unitId: STARTER_UNIT_ID, content: validated.content, contentVersion: 2, createdBy: null });

    // The picture already exists (made for another language's "please").
    const claim = await db.claimConceptImage({ conceptKey: "please", description: "a hand offering coffee" });
    const normalised = await (await import("../generate")).normalisePicture(await png("#3498db"));
    await db.completeConceptImage({ id: claim.image!.id, ...normalised, model: "stub" });

    const started = await lessons.startLesson({ userId: "u-pic", language: "de" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const plan: LessonPlan = started.data.plan;
    expect(plan.lessonId).not.toBe("l-old");
    const url = `/api/images/${claim.image!.id}`;

    const intro = plan.steps.find((step) => step.kind === "intro" && step.word.translation === "please");
    expect(intro?.kind === "intro" && intro.word.picture?.url).toBe(url);
    for (const step of plan.steps) {
      if (step.kind === "choice" && step.direction === "toEnglish") expect(step.picture?.url ?? null).toBeNull();
      if (step.kind === "choice" && step.direction === "toTarget" && step.prompt.text === "please") expect(step.picture?.url).toBe(url);
      if (step.kind === "intro" && step.word.translation !== "please") expect(step.word.picture ?? null).toBeNull();
    }

    // The stored plan keeps only the concept key, never a URL.
    const attempt = await db.getLessonAttempt<{ plan: LessonPlan }>("u-pic", started.data.attemptId);
    expect(JSON.stringify(attempt?.state)).not.toContain("/api/images/");

    // Completing the lesson links the learner's word to the picture for review.
    const graded = plan.steps.filter((step) => step.graded);
    const completed = await lessons.completeLesson({
      userId: "u-pic",
      attemptId: started.data.attemptId,
      body: { results: graded.map((step) => ({ stepId: step.id, answer: { type: "choice", optionId: "none" } })) },
      now: new Date(Date.now() + 10 * 60 * 1000),
    });
    expect(completed.ok).toBe(true);
    const bitte = (await raw.execute("SELECT image_key FROM learning WHERE user_id = 'u-pic' AND word = 'Bitte'")).rows[0];
    expect(bitte.image_key).toBe("please");
    const danke = (await raw.execute("SELECT image_key FROM learning WHERE user_id = 'u-pic' AND word = 'Danke'")).rows[0];
    expect(danke.image_key).toBeNull();

    const due = await db.listDueVocabulary({ userId: "u-pic", language: "de", now: new Date(Date.now() + 2 * 86_400_000) });
    const urls = await service.findPictureUrls(due.map((item) => item.imageKey));
    expect(urls.get("please")).toBe(url);
  });

  it("keeps an existing picture link when a word is upserted again", async () => {
    const first = await db.upsertVocabulary({
      userId: "u-pic",
      language: "de",
      source: "journey",
      items: [{ word: "der Apfel", translation: "apple", imageKey: "apple" }],
    });
    expect(first.items[0].imageKey).toBe("apple");
    const again = await db.upsertVocabulary({
      userId: "u-pic",
      language: "de",
      source: "chat",
      items: [{ word: "der Apfel", translation: "apple", imageKey: "red apple" }, { word: "die Birne", translation: "pear" }],
    });
    expect(again.items.map((item) => item.imageKey)).toEqual(["apple", null]);
  });
});
