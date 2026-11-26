import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Review sessions against a real local SQLite file: grading and XP must not be inflatable. */

type Db = typeof import("../../database");
type Store = typeof import("../store");

let dir: string;
let db: Db;
let store: Store;
let userId: string;
let otherUserId: string;

const NOW = new Date("2026-06-15T12:00:00.000Z");
const TODAY = "2026-06-15";
const MIN = 60 * 1000;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "laingfy-review-"));
  process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "test.db")}`;
  delete process.env.TURSO_AUTH_TOKEN;
  db = await import("../../database");
  store = await import("../store");
  await db.initializeDatabaseSchema();
  userId = (await db.createUser({ email: "learner@example.com", accountSetup: true, learningLanguages: ["de"] })).id;
  otherUserId = (await db.createUser({ email: "other@example.com", accountSetup: true })).id;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function addWords(words: string[], at: Date) {
  const result = await db.upsertVocabulary({
    userId,
    language: "de",
    source: "manual",
    items: words.map((word) => ({ word, translation: `${word}-en` })),
    now: at,
  });
  return result.items;
}

describe("review sessions", () => {
  it("only accepts grades for served, due, pending cards and scores each card once", async () => {
    const [haus, baum, katze] = await addWords(["Haus", "Baum", "Katze"], new Date(NOW.getTime() - 60 * MIN));
    const sessionId = await store.createReviewSession({ userId, language: "de", itemIds: [haus.id, baum.id], now: NOW });

    // Not served in this session.
    expect(await store.claimGrade({ userId, sessionId, itemId: katze.id, grade: "good", now: NOW })).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    // Someone else's session.
    expect((await store.claimGrade({ userId: otherUserId, sessionId, itemId: haus.id, grade: "good", now: NOW })).ok).toBe(false);

    // "again" keeps the card in the session; a later pass finishes it.
    expect(await store.claimGrade({ userId, sessionId, itemId: haus.id, grade: "again", now: NOW })).toEqual({ ok: true, requeue: true });
    await db.applyReviewGrade({ userId, itemId: haus.id, grade: "again", now: NOW });
    // Relearning in the same session is allowed although the card is no longer due.
    expect(await store.claimGrade({ userId, sessionId, itemId: haus.id, grade: "good", now: new Date(NOW.getTime() + MIN) })).toEqual({
      ok: true,
      requeue: false,
    });
    // Finished cards cannot be graded again.
    expect((await store.claimGrade({ userId, sessionId, itemId: haus.id, grade: "easy", now: NOW })).ok).toBe(false);

    expect((await store.claimGrade({ userId, sessionId, itemId: baum.id, grade: "good", now: NOW })).ok).toBe(true);
    await db.applyReviewGrade({ userId, itemId: baum.id, grade: "good", now: NOW });

    const first = await store.completeReviewSession({ userId, sessionId, localDate: TODAY, now: NOW });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Haus: first grade again (1 XP), Baum: good (2 XP); under 5 cards so no bonus.
    expect(first.result).toMatchObject({ reviewed: 2, correct: 1, accuracy: 0.5, xpGained: 3, streakExtended: true });
    expect(first.result.streak?.current).toBe(1);

    // Completing again returns the same result and awards nothing more.
    const again = await store.completeReviewSession({ userId, sessionId, localDate: TODAY, now: NOW });
    expect(again).toEqual(first);
    expect((await db.getProgress(userId, "de"))?.xp).toBe(3);

    // A closed session cannot be graded.
    expect((await store.claimGrade({ userId, sessionId, itemId: baum.id, grade: "good", now: NOW })).ok).toBe(false);
  });

  it("rejects cards that are not due when served again in a second session", async () => {
    const [hund] = await addWords(["Hund"], new Date(NOW.getTime() - 60 * MIN));
    const first = await store.createReviewSession({ userId, language: "de", itemIds: [hund.id], now: NOW });
    const second = await store.createReviewSession({ userId, language: "de", itemIds: [hund.id], now: NOW });

    expect((await store.claimGrade({ userId, sessionId: first, itemId: hund.id, grade: "good", now: NOW })).ok).toBe(true);
    await db.applyReviewGrade({ userId, itemId: hund.id, grade: "good", now: NOW });
    expect((await store.claimGrade({ userId, sessionId: second, itemId: hund.id, grade: "good", now: NOW })).ok).toBe(false);
  });

  it("stops accepting 'again' after the per-card limit and expires stale sessions", async () => {
    const [vogel] = await addWords(["Vogel"], new Date(NOW.getTime() - 60 * MIN));
    const sessionId = await store.createReviewSession({ userId, language: "de", itemIds: [vogel.id], now: NOW });
    const results = [];
    for (let index = 0; index < 5; index += 1) {
      results.push(await store.claimGrade({ userId, sessionId, itemId: vogel.id, grade: "again", now: NOW }));
    }
    expect(results.map((result) => (result.ok ? result.requeue : "refused"))).toEqual([true, true, true, false, "refused"]);

    const [fisch] = await addWords(["Fisch"], new Date(NOW.getTime() - 60 * MIN));
    const stale = await store.createReviewSession({ userId, language: "de", itemIds: [fisch.id], now: NOW });
    const later = new Date(NOW.getTime() + 13 * 60 * MIN);
    expect((await store.claimGrade({ userId, sessionId: stale, itemId: fisch.id, grade: "good", now: later })).ok).toBe(false);
  });

  it("completes an ungraded session without recording activity", async () => {
    const sessionId = await store.createReviewSession({ userId: otherUserId, language: "de", itemIds: [], now: NOW });
    const result = await store.completeReviewSession({ userId: otherUserId, sessionId, localDate: TODAY, now: NOW });
    expect(result.ok && result.result.xpGained).toBe(0);
    expect(await db.getProgress(otherUserId, "de")).toBeNull();
    expect(await store.completeReviewSession({ userId, sessionId: "missing", now: NOW })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("vocabulary helpers", () => {
  it("searches, deletes only the owner's words and reports the next due time", async () => {
    const found = await store.searchVocabulary({ userId, language: "de", query: "KATZ" });
    expect(found.items.map((entry) => entry.word)).toEqual(["Katze"]);
    expect((await store.searchVocabulary({ userId, language: "de", query: "baum-en" })).items).toHaveLength(1);
    expect((await store.searchVocabulary({ userId, language: "de", query: "%" })).items).toHaveLength(0);

    const page = await store.searchVocabulary({ userId, language: "de", limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);

    const katze = found.items[0];
    expect(await store.deleteVocabularyItem(otherUserId, katze.id)).toBe(false);
    expect(await store.deleteVocabularyItem(userId, katze.id)).toBe(true);
    expect(await db.getVocabularyItem(userId, katze.id)).toBeNull();

    const nextDue = await store.getNextDueAt(userId, "de", NOW);
    expect(nextDue).toBe(new Date(NOW.getTime() + 10 * MIN).toISOString());
  });

  it("lists the last seven days of XP with gaps filled", async () => {
    const history = await store.listDailyHistory({ userId, today: TODAY, goal: 3 });
    expect(history).toHaveLength(7);
    expect(history[0].date).toBe("2026-06-09");
    expect(history[6]).toEqual({ date: TODAY, xp: 3, goalMet: true });
    expect(history.slice(0, 6).every((entry) => entry.xp === 0 && !entry.goalMet)).toBe(true);
  });
});
