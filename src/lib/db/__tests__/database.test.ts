import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getUnitsForLevel } from "../../curriculum";

/**
 * Integration tests against a real local SQLite file through @libsql/client, starting from a database
 * shaped like the pre-upgrade production schema to prove the migration is additive and safe.
 */

type Db = typeof import("../../database");

let dir: string;
let raw: Client;
let db: Db;

const OLD_USER_ID = "user-old";
const NOW = new Date("2026-06-15T12:00:00.000Z");
const TODAY = "2026-06-15";

async function createLegacyDatabase(url: string) {
  const client = createClient({ url, intMode: "number" });
  await client.batch(
    [
      `CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, password TEXT,
        native_language TEXT NOT NULL DEFAULT 'English', active_language TEXT NOT NULL DEFAULT 'en',
        learning_languages TEXT NOT NULL DEFAULT '[]', account_setup INTEGER NOT NULL DEFAULT 0,
        email_verified TEXT, image TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
      `CREATE TABLE progress (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, language TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, language))`,
      `CREATE TABLE learning (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, language TEXT NOT NULL, word TEXT NOT NULL, translation TEXT NOT NULL,
        difficulty INTEGER NOT NULL DEFAULT 0, last_recalled TEXT NOT NULL, next_review TEXT NOT NULL,
        success_count INTEGER NOT NULL DEFAULT 0, failure_count INTEGER NOT NULL DEFAULT 0, notes TEXT,
        tags TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
      `CREATE TABLE chats (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, language TEXT NOT NULL, message TEXT NOT NULL,
        response TEXT NOT NULL, audio_url TEXT, created_at TEXT NOT NULL)`,
      `CREATE INDEX idx_progress_user_id ON progress(user_id)`,
      {
        sql: `INSERT INTO users (id, name, email, password, active_language, learning_languages, account_setup, created_at, updated_at)
          VALUES (?, 'Old User', 'old@example.com', '$2a$12$hash', 'de', '["de"]', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')`,
        args: [OLD_USER_ID],
      },
      `INSERT INTO progress (id, user_id, language, level, xp, created_at, updated_at)
        VALUES ('p1', 'user-old', 'de', 3, 120, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')`,
      `INSERT INTO learning (id, user_id, language, word, translation, last_recalled, next_review, created_at, updated_at)
        VALUES ('w1', 'user-old', 'de', 'Hallo!', 'hello', '2025-01-01T00:00:00.000Z', '2025-01-02T00:00:00.000Z', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')`,
      `INSERT INTO learning (id, user_id, language, word, translation, last_recalled, next_review, created_at, updated_at)
        VALUES ('w2', 'user-old', 'de', 'hallo', 'hi', '2025-01-01T00:00:00.000Z', '2025-01-02T00:00:00.000Z', '2025-01-03T00:00:00.000Z', '2025-01-03T00:00:00.000Z')`,
    ],
    "write"
  );
  client.close();
}

async function columns(table: string) {
  const result = await raw.execute(`PRAGMA table_info(${table})`);
  return result.rows.map((row) => String(row.name));
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "laingfy-db-"));
  const url = `file:${path.join(dir, "test.db")}`;
  await createLegacyDatabase(url);
  process.env.TURSO_DATABASE_URL = url;
  delete process.env.TURSO_AUTH_TOKEN;
  raw = createClient({ url, intMode: "number" });
  db = await import("../../database");
  await db.initializeDatabaseSchema();
});

afterAll(() => {
  raw?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("schema migration", () => {
  it("adds new columns and tables without touching existing rows", async () => {
    expect(await columns("learning")).toEqual(
      expect.arrayContaining(["normalized_word", "interval_days", "ease", "repetitions", "lapses", "source", "romanization", "example_sentence", "example_translation", "last_reviewed_at", "unit_id"])
    );
    expect(await columns("users")).toContain("daily_xp_goal");

    const counts = await db.getDatabaseTableCounts();
    expect(counts).toMatchObject({ users: 1, progress: 1, learning: 2, lessons: 0, ai_usage: 0 });

    const progress = await db.getProgress(OLD_USER_ID, "de");
    expect(progress).toMatchObject({ level: 3, xp: 120 });
  });

  it("backfills normalized words, leaving later duplicates NULL instead of deleting them", async () => {
    const rows = await raw.execute("SELECT id, normalized_word, ease, source FROM learning ORDER BY id");
    expect(rows.rows.map((row) => [row.id, row.normalized_word, row.ease, row.source])).toEqual([
      ["w1", "hallo", 2.5, "manual"],
      ["w2", null, 2.5, "manual"],
    ]);
  });

  it("is idempotent when run again", async () => {
    const { migrateSchema } = await import("../schema");
    await migrateSchema(raw);
    await migrateSchema(raw);
    expect((await db.getDatabaseTableCounts()).learning).toBe(2);
  });
});

describe("users", () => {
  it("never exposes the password hash through toPublicUser", async () => {
    const user = await db.getUserById(OLD_USER_ID);
    expect(user?.password).toBe("$2a$12$hash");
    const publicUser = db.toPublicUser(user!);
    expect(publicUser).not.toHaveProperty("password");
    expect(publicUser.hasPassword).toBe(true);
    expect(JSON.stringify(publicUser)).not.toContain("$2a$");
  });

  it("maps onboarding choices to the 1-10 scale and never lowers XP", async () => {
    const user = await db.createUser({ email: "new@example.com", name: "New" });
    await db.completeAccountSetup(user.id, {
      learningLanguages: ["ko", "zh"],
      activeLanguage: "ko",
      proficiencyLevels: { ko: "3", zh: "5" },
    });
    expect((await db.getProgress(user.id, "ko"))?.level).toBe(5);
    expect((await db.getProgress(user.id, "zh"))?.level).toBe(9);

    await db.createProgress({ userId: OLD_USER_ID, language: "de", level: 4, xp: 0 });
    expect(await db.getProgress(OLD_USER_ID, "de")).toMatchObject({ level: 4, xp: 120 });

    const ensured = await db.ensureProgress(OLD_USER_ID, "de", 1);
    expect(ensured).toMatchObject({ level: 4, xp: 120 });
  });

  it("sets a learner's level manually only for languages they study", async () => {
    expect((await db.setLearnerLevel(OLD_USER_ID, "de", 3))?.level).toBe(3);
    expect(await db.setLearnerLevel(OLD_USER_ID, "ar", 3)).toBeNull();
  });
});

describe("vocabulary", () => {
  const userId = OLD_USER_ID;

  it("upserts without duplicates and keeps existing review progress", async () => {
    const first = await db.upsertVocabulary({
      userId,
      language: "de",
      source: "journey",
      now: NOW,
      items: [
        { word: "Hund", translation: "dog", exampleSentence: "Der Hund schläft." },
        { word: "Katze", translation: "cat" },
        { word: "hund!", translation: "dog (dup in batch)" },
        { word: "  ", translation: "blank" },
        { word: "HALLO", translation: "hello again" },
      ],
    });
    expect(first.insertedCount).toBe(2);
    expect(first.existingCount).toBe(1);
    expect(first.items.map((item) => item.word)).toEqual(["Hund", "Katze", "Hallo!"]);
    expect(first.items[0]).toMatchObject({ source: "journey", maturity: "new", ease: 2.5, exampleSentence: "Der Hund schläft." });
    // Existing word keeps its original translation.
    expect(first.items[2].translation).toBe("hello");

    const hund = first.items[0];
    await db.applyReviewGrade({ userId, itemId: hund.id, grade: "good", now: NOW });

    const second = await db.upsertVocabulary({
      userId,
      language: "de",
      source: "chat",
      now: NOW,
      items: [{ word: "Hund", translation: "hound", romanization: "hoont", exampleSentence: "other" }],
    });
    expect(second.insertedCount).toBe(0);
    expect(second.items[0]).toMatchObject({
      id: hund.id,
      translation: "dog",
      romanization: "hoont",
      exampleSentence: "Der Hund schläft.",
      source: "journey",
      repetitions: 1,
      successCount: 1,
    });
  });

  it("lists and counts due items, applies grades and reports maturity", async () => {
    const due = await db.listDueVocabulary({ userId, language: "de", now: NOW, limit: 10 });
    const dueWords = due.map((item) => item.word);
    expect(dueWords).toContain("Katze");
    expect(dueWords).not.toContain("Hund");
    expect(await db.countDueVocabulary(userId, "de", NOW)).toBe(due.length);

    const katze = due.find((item) => item.word === "Katze")!;
    const failed = await db.applyReviewGrade({ userId, itemId: katze.id, grade: "again", now: NOW });
    expect(failed).toMatchObject({ failureCount: 1, repetitions: 0, maturity: "learning" });
    expect(new Date(failed!.nextReview).getTime()).toBeGreaterThan(NOW.getTime());

    expect(await db.applyReviewGrade({ userId: "someone-else", itemId: katze.id, grade: "good" })).toBeNull();

    const counts = await db.countVocabularyByMaturity(userId, "de");
    expect(counts.total).toBe(4);
    expect(counts.learning).toBe(2);
    expect(counts.new).toBe(2);

    const weakest = await db.listWeakestVocabulary(userId, "de", 5);
    expect(weakest[0].word).toBe("Katze");
    expect(await db.listKnownWords(userId, "de")).toEqual(expect.arrayContaining(["Hund", "Katze", "Hallo!"]));
    expect((await db.listRecentVocabulary(userId, "de", 2)).length).toBe(2);
  });
});

describe("activity, streaks and lessons", () => {
  let learnerId: string;

  beforeAll(async () => {
    const learner = await db.createUser({ email: "learner@example.com", name: "Learner" });
    learnerId = learner.id;
    await db.completeAccountSetup(learnerId, { learningLanguages: ["de"], proficiencyLevels: { de: "1" } });
  });

  it("records XP atomically, validates local dates and tracks the streak and goal", async () => {
    const day1 = await db.recordActivity({ userId: learnerId, language: "de", kind: "review", xp: 12, localDate: "2026-06-13", now: new Date("2026-06-13T10:00:00Z") });
    expect(day1).toMatchObject({ xpGained: 12, totalXp: 12, dailyXp: 12, dailyGoal: 30, goalJustReached: false, localDate: "2026-06-13" });
    expect(day1.streak).toMatchObject({ current: 1, todayDone: true });

    await db.recordActivity({ userId: learnerId, language: "de", kind: "chat", xp: 4, localDate: "2026-06-14", now: new Date("2026-06-14T10:00:00Z") });

    // A client date far from UTC "today" falls back to the UTC date.
    const bogus = await db.recordActivity({ userId: learnerId, language: "de", kind: "chat", xp: 10, localDate: "2020-01-01", now: NOW });
    expect(bogus.localDate).toBe(TODAY);
    expect(bogus.streak).toMatchObject({ current: 3, longest: 3, todayDone: true });

    const crossing = await db.recordActivity({ userId: learnerId, language: "de", kind: "review", xp: 25, localDate: TODAY, now: NOW });
    expect(crossing).toMatchObject({ dailyXp: 35, goalJustReached: true, totalXp: 51, leveledUp: false });

    const after = await db.recordActivity({ userId: learnerId, language: "de", kind: "review", xp: -50, localDate: TODAY, now: NOW });
    expect(after).toMatchObject({ xpGained: 0, totalXp: 51, goalJustReached: false });

    await db.setDailyXpGoal(learnerId, 50);
    expect(await db.getDailyXpGoal(learnerId)).toBe(50);
  });

  it("pools lessons, resumes attempts, scores completions and blocks double claims", async () => {
    const [unit1] = getUnitsForLevel(1);
    expect(await db.findReusableLesson({ userId: learnerId, language: "de", unitId: unit1.id })).toBeNull();

    const lesson = await db.insertLesson({ language: "de", unitId: unit1.id, content: { steps: [1, 2, 3] }, createdBy: learnerId });
    expect(lesson).toMatchObject({ level: 1, unitId: unit1.id, content: { steps: [1, 2, 3] } });

    const found = await db.findReusableLesson<{ steps: number[] }>({ userId: learnerId, language: "de", unitId: unit1.id });
    expect(found?.id).toBe(lesson.id);

    const attempt = await db.startLessonAttempt({ userId: learnerId, lessonId: lesson.id, initialState: { step: 0 } });
    const resumed = await db.startLessonAttempt({ userId: learnerId, lessonId: lesson.id });
    expect(resumed.id).toBe(attempt.id);
    expect((await db.getActiveLessonAttempt({ userId: learnerId, language: "de", unitId: unit1.id }))?.id).toBe(attempt.id);

    const saved = await db.saveLessonAttemptState({ userId: learnerId, attemptId: attempt.id, state: { step: 2 }, correctCount: 2, totalCount: 2 });
    expect(saved).toMatchObject({ state: { step: 2 }, correctCount: 2 });
    expect(await db.saveLessonAttemptState({ userId: "intruder", attemptId: attempt.id, state: {} })).toBeNull();

    const result = await db.completeLessonAttempt({ userId: learnerId, attemptId: attempt.id, correctCount: 9, totalCount: 10, localDate: TODAY, now: NOW });
    expect(result).toMatchObject({ stars: 2, accuracy: 0.9, xpAwarded: 20, isFirstPass: true, bestStars: 2 });
    expect(result?.activity).toMatchObject({ xpGained: 20, leveledUp: false, level: 1 });
    expect(await db.completeLessonAttempt({ userId: learnerId, attemptId: attempt.id, correctCount: 10, totalCount: 10 })).toBeNull();

    // Completed lessons are no longer offered to the same learner, but are to others.
    expect(await db.findReusableLesson({ userId: learnerId, language: "de", unitId: unit1.id })).toBeNull();
    expect((await db.findReusableLesson({ userId: OLD_USER_ID, language: "de", unitId: unit1.id }))?.id).toBe(lesson.id);

    // Replay earns reduced XP.
    const replayLesson = await db.insertLesson({ language: "de", unitId: unit1.id, content: {} });
    const replay = await db.startLessonAttempt({ userId: learnerId, lessonId: replayLesson.id });
    const replayResult = await db.completeLessonAttempt({ userId: learnerId, attemptId: replay.id, correctCount: 10, totalCount: 10, localDate: TODAY, now: NOW });
    expect(replayResult).toMatchObject({ stars: 3, isFirstPass: false, xpAwarded: 13, bestStars: 3 });

    const progress = await db.getUnitProgress(learnerId, "de");
    expect(progress.completedUnitIds).toEqual([unit1.id]);
    expect(progress.bestStars[unit1.id]).toBe(3);
  });

  it("levels up only when every unit of the current level has at least one star", async () => {
    const units = getUnitsForLevel(1);
    let last: Awaited<ReturnType<Db["completeLessonAttempt"]>> = null;

    // A 0-star completion does not count.
    const failLesson = await db.insertLesson({ language: "de", unitId: units[1].id, content: {} });
    const failAttempt = await db.startLessonAttempt({ userId: learnerId, lessonId: failLesson.id });
    const failed = await db.completeLessonAttempt({ userId: learnerId, attemptId: failAttempt.id, correctCount: 1, totalCount: 10, localDate: TODAY, now: NOW });
    expect(failed).toMatchObject({ stars: 0, isFirstPass: false, xpAwarded: 5 });
    expect((await db.getUnitProgress(learnerId, "de")).completedUnitIds).not.toContain(units[1].id);

    for (const unit of units.slice(1)) {
      const lesson = await db.insertLesson({ language: "de", unitId: unit.id, content: {} });
      const attempt = await db.startLessonAttempt({ userId: learnerId, lessonId: lesson.id });
      last = await db.completeLessonAttempt({ userId: learnerId, attemptId: attempt.id, correctCount: 6, totalCount: 10, localDate: TODAY, now: NOW });
      if (unit !== units[units.length - 1]) {
        expect(last?.activity.leveledUp).toBe(false);
      }
    }

    expect(last?.activity).toMatchObject({ leveledUp: true, previousLevel: 1, level: 2 });
    expect((await db.getProgress(learnerId, "de"))?.level).toBe(2);

    const summary = await db.getLearnerSummary({ userId: learnerId, language: "de", localDate: TODAY, now: NOW });
    expect(summary).toMatchObject({ hasProgress: true, level: 2, cefr: "A1", levelLabel: "Beginner" });
    expect(summary.levelProgress).toMatchObject({ completed: 0, total: 6 });
    expect(summary.nextUnit?.id).toBe(getUnitsForLevel(2)[0].id);
    expect(summary.units).toHaveLength(6);
    expect(summary.units[0]).toMatchObject({ unlocked: true, completed: false, stars: 0 });
    expect(summary.units[1].unlocked).toBe(false);
    expect(summary.streak.current).toBe(3);
    expect(summary.today).toMatchObject({ localDate: TODAY, goal: 50 });
    expect(summary.today.xp).toBeGreaterThan(50);
    expect(summary.today.goalReached).toBe(true);
    expect(summary.totalXp).toBe((await db.getProgress(learnerId, "de"))?.xp);
  });

  it("returns a default summary for a language that has not been set up", async () => {
    const summary = await db.getLearnerSummary({ userId: learnerId, language: "ar", localDate: TODAY, now: NOW });
    expect(summary).toMatchObject({ hasProgress: false, level: 1, totalXp: 0, languageName: "Arabic" });
    expect(summary.review.dueCount).toBe(0);
    expect(summary.nextUnit?.id).toBe("l1-greetings");
  });
});

describe("chat sessions", () => {
  it("stores conversation memory per session and enforces ownership", async () => {
    const session = await db.createChatSession({ userId: OLD_USER_ID, language: "de", mode: "tutor", metadata: { scenario: "cafe" } });
    expect(session).toMatchObject({ mode: "tutor", metadata: { scenario: "cafe" } });

    for (let index = 1; index <= 5; index += 1) {
      await db.appendChatMessage({ userId: OLD_USER_ID, sessionId: session.id, role: index % 2 ? "user" : "assistant", content: `m${index}`, payload: { index } });
    }

    const lastThree = await db.listChatMessages<{ index: number }>({ userId: OLD_USER_ID, sessionId: session.id, limit: 3 });
    expect(lastThree.map((message) => message.content)).toEqual(["m3", "m4", "m5"]);
    expect(lastThree[2].payload).toEqual({ index: 5 });

    expect(await db.appendChatMessage({ userId: "intruder", sessionId: session.id, role: "user", content: "hi" })).toBeNull();
    expect(await db.listChatMessages({ userId: "intruder", sessionId: session.id })).toEqual([]);
    expect(await db.getChatSession("intruder", session.id)).toBeNull();
    expect((await db.getLatestChatSession({ userId: OLD_USER_ID, language: "de" }))?.id).toBe(session.id);
    expect((await db.listChatSessions(OLD_USER_ID, "de")).length).toBe(1);
  });
});

describe("mistakes", () => {
  it("records and lists recent mistakes", async () => {
    const written = await db.recordMistakes({
      userId: OLD_USER_ID,
      language: "de",
      source: "chat",
      mistakes: [
        { kind: "grammar", incorrect: "Ich habe gegangen", correction: "Ich bin gegangen", explanation: "gehen uses sein" },
        { kind: "spelling", incorrect: "Strase", correction: "Straße" },
        { kind: "other", incorrect: " ", correction: "x" },
      ],
    });
    expect(written).toBe(2);

    const recent = await db.listRecentMistakes({ userId: OLD_USER_ID, language: "de" });
    expect(recent.map((mistake) => mistake.kind)).toEqual(["spelling", "grammar"]);
    expect(recent[1]).toMatchObject({ source: "chat", explanation: "gehen uses sein" });
    expect(await db.listRecentMistakes({ userId: OLD_USER_ID, language: "de", kind: "grammar" })).toHaveLength(1);
  });
});

describe("AI quota", () => {
  it("consumes up to the daily limit and then refuses without consuming", async () => {
    process.env.AI_DAILY_LIMIT_REALTIME = "2";
    try {
      const first = await db.consumeAiQuota({ userId: OLD_USER_ID, kind: "realtime", now: NOW });
      const second = await db.consumeAiQuota({ userId: OLD_USER_ID, kind: "realtime", now: NOW });
      const third = await db.consumeAiQuota({ userId: OLD_USER_ID, kind: "realtime", now: NOW });
      expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, false]);
      expect(third).toMatchObject({ used: 2, limit: 2, remaining: 0 });
      expect(await db.getAiUsage(OLD_USER_ID, "realtime", NOW)).toBe(2);

      // A new UTC day starts a fresh counter.
      const tomorrow = await db.consumeAiQuota({ userId: OLD_USER_ID, kind: "realtime", now: new Date("2026-06-16T00:30:00Z") });
      expect(tomorrow).toMatchObject({ allowed: true, used: 1 });

      expect((await db.consumeAiQuota({ userId: OLD_USER_ID, kind: "realtime", cost: 5, now: NOW })).allowed).toBe(false);

      process.env.AI_DAILY_LIMIT_REALTIME = "0";
      const unlimited = await db.consumeAiQuota({ userId: OLD_USER_ID, kind: "realtime", now: NOW });
      expect(unlimited).toMatchObject({ allowed: true, limit: null, remaining: null, used: 3 });
    } finally {
      delete process.env.AI_DAILY_LIMIT_REALTIME;
    }
  });

  it("reads limits from env with defaults", () => {
    expect(db.getAiDailyLimit("text", {})).toBe(db.DEFAULT_AI_DAILY_LIMITS.text);
    expect(db.getAiDailyLimit("text", { AI_DAILY_LIMIT_TEXT: "1000" })).toBe(1000);
    expect(db.getAiDailyLimit("speech", { AI_DAILY_LIMIT_SPEECH: "-1" })).toBeNull();
    expect(db.getAiDailyLimit("speech", { AI_DAILY_LIMIT_SPEECH: "lots" })).toBe(db.DEFAULT_AI_DAILY_LIMITS.speech);
  });
});
