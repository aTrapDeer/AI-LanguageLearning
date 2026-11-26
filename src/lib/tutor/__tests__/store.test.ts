import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** The tutor's own queries against a real local SQLite database. */

type Db = typeof import("../../database");
type Store = typeof import("../store");

let dir: string;
let db: Db;
let store: Store;
const TODAY = "2026-06-15";

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "laingfy-tutor-"));
  process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "test.db")}`;
  delete process.env.TURSO_AUTH_TOKEN;
  db = await import("../../database");
  store = await import("../store");
  await db.initializeDatabaseSchema();
  await db.createUser({ email: "learner@example.com", name: "Learner", password: "x", accountSetup: true });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function userId() {
  const user = await db.getUserByEmail("learner@example.com");
  return user!.id;
}

describe("chat turn counter", () => {
  it("reads today's counted chat turns per language", async () => {
    const id = await userId();
    expect(await store.countChatTurnsToday(id, "de", TODAY)).toBe(0);
    await db.recordActivity({ userId: id, language: "de", kind: "chat", xp: 2, localDate: TODAY, now: new Date(`${TODAY}T12:00:00Z`) });
    await db.recordActivity({ userId: id, language: "de", kind: "chat", xp: 0, localDate: TODAY, now: new Date(`${TODAY}T12:00:00Z`) });
    expect(await store.countChatTurnsToday(id, "de", TODAY)).toBe(2);
    expect(await store.countChatTurnsToday(id, "ko", TODAY)).toBe(0);
  });
});

describe("saved words", () => {
  it("finds words already in the deck by normalised form", async () => {
    const id = await userId();
    await db.upsertVocabulary({ userId: id, language: "de", source: "chat", items: [{ word: "Kaffee", translation: "coffee" }] });
    expect(await store.findSavedWords(id, "de", ["kaffee!", "Tee", ""])).toEqual(["kaffee"]);
    expect(await store.findSavedWords(id, "de", [])).toEqual([]);
  });
});

describe("voice sessions", () => {
  it("ends a session exactly once and sums the day's voice XP", async () => {
    const id = await userId();
    const session = await db.createChatSession({
      userId: id,
      language: "de",
      mode: "voice",
      metadata: { voiceMode: "native", unitId: null, localDate: TODAY, startedAt: "2026-06-15T10:00:00.000Z", endedAt: null },
    });

    expect(await store.sumVoiceXpToday(id, "de", TODAY)).toBe(0);
    const end = { userId: id, sessionId: session.id, endedAt: new Date("2026-06-15T10:05:00Z"), xpAwarded: 15, creditedSeconds: 300 };
    expect(await store.claimVoiceSessionEnd(end)).toBe(true);
    expect(await store.claimVoiceSessionEnd(end)).toBe(false);
    expect(await store.sumVoiceXpToday(id, "de", TODAY)).toBe(15);

    const stored = await db.getChatSession<{ endedAt: string; xpAwarded: number; voiceMode: string }>(id, session.id);
    expect(stored?.metadata).toMatchObject({ endedAt: "2026-06-15T10:05:00.000Z", xpAwarded: 15, voiceMode: "native" });
  });

  it("refuses other users' sessions and tutor sessions", async () => {
    const id = await userId();
    const tutor = await db.createChatSession({ userId: id, language: "de", mode: "tutor", metadata: { scenarioId: "free" } });
    const end = { endedAt: new Date(), xpAwarded: 5, creditedSeconds: 60 };
    expect(await store.claimVoiceSessionEnd({ ...end, userId: id, sessionId: tutor.id })).toBe(false);

    const voice = await db.createChatSession({ userId: id, language: "de", mode: "voice", metadata: { localDate: TODAY } });
    expect(await store.claimVoiceSessionEnd({ ...end, userId: "someone-else", sessionId: voice.id })).toBe(false);
  });
});
