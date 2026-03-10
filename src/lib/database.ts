import { createClient, type InArgs } from "@libsql/client";
import type { AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";

type DbRow = Record<string, unknown>;

export interface DatabaseUser {
  id: string;
  name: string | null;
  email: string;
  password: string | null;
  nativeLanguage: string;
  activeLanguage: string;
  learningLanguages: string[];
  accountSetup: boolean;
  emailVerified: Date | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name?: string | null;
  email: string;
  password?: string | null;
  nativeLanguage?: string;
  activeLanguage?: string;
  learningLanguages?: string[];
  accountSetup?: boolean;
  emailVerified?: Date | null;
  image?: string | null;
}

export interface UpdateUserInput {
  name?: string | null;
  email?: string;
  password?: string | null;
  nativeLanguage?: string;
  activeLanguage?: string;
  learningLanguages?: string[];
  accountSetup?: boolean;
  emailVerified?: Date | null;
  image?: string | null;
}

export interface DatabaseProgress {
  id: string;
  userId: string;
  language: string;
  level: number;
  xp: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProgressInput {
  userId: string;
  language: string;
  level?: number;
  xp?: number;
}

export interface UpdateProgressInput {
  level?: number;
  xp?: number;
}

export interface DatabaseLearning {
  id: string;
  userId: string;
  language: string;
  word: string;
  translation: string;
  difficulty: number;
  lastRecalled: string;
  nextReview: string;
  successCount: number;
  failureCount: number;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningInput {
  userId: string;
  language: string;
  word: string;
  translation: string;
  difficulty?: number;
  lastRecalled?: string;
  nextReview: string;
  successCount?: number;
  failureCount?: number;
  notes?: string | null;
  tags?: string[];
}

export interface DatabaseChat {
  id: string;
  userId: string;
  language: string;
  message: string;
  response: string;
  audioUrl: string | null;
  createdAt: string;
}

export interface CreateChatInput {
  userId: string;
  language: string;
  message: string;
  response: string;
  audioUrl?: string | null;
}

export interface AccountSetupInput {
  learningLanguages: string[];
  activeLanguage?: string;
  proficiencyLevels?: Record<string, string>;
}

let tursoClient: ReturnType<typeof createClient> | null = null;

let schemaPromise: Promise<void> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function asString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function asRequiredString(value: unknown, field: string) {
  const stringValue = asString(value);
  if (!stringValue) {
    throw new Error(`Missing required database field: ${field}`);
  }

  return stringValue;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function parseStringArray(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function stringifyArray(values: string[] | undefined) {
  return JSON.stringify(values ?? []);
}

function normalizeLanguages(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function mapUser(row: DbRow): DatabaseUser {
  return {
    id: asRequiredString(row.id, "users.id"),
    name: asString(row.name),
    email: asRequiredString(row.email, "users.email"),
    password: asString(row.password),
    nativeLanguage: asString(row.native_language) ?? "English",
    activeLanguage: asString(row.active_language) ?? "en",
    learningLanguages: parseStringArray(row.learning_languages),
    accountSetup: asBoolean(row.account_setup),
    emailVerified: row.email_verified ? new Date(asRequiredString(row.email_verified, "users.email_verified")) : null,
    image: asString(row.image),
    createdAt: asRequiredString(row.created_at, "users.created_at"),
    updatedAt: asRequiredString(row.updated_at, "users.updated_at"),
  };
}

function mapProgress(row: DbRow): DatabaseProgress {
  return {
    id: asRequiredString(row.id, "progress.id"),
    userId: asRequiredString(row.user_id, "progress.user_id"),
    language: asRequiredString(row.language, "progress.language"),
    level: asNumber(row.level, 1),
    xp: asNumber(row.xp, 0),
    createdAt: asRequiredString(row.created_at, "progress.created_at"),
    updatedAt: asRequiredString(row.updated_at, "progress.updated_at"),
  };
}

function mapLearning(row: DbRow): DatabaseLearning {
  return {
    id: asRequiredString(row.id, "learning.id"),
    userId: asRequiredString(row.user_id, "learning.user_id"),
    language: asRequiredString(row.language, "learning.language"),
    word: asRequiredString(row.word, "learning.word"),
    translation: asRequiredString(row.translation, "learning.translation"),
    difficulty: asNumber(row.difficulty, 0),
    lastRecalled: asRequiredString(row.last_recalled, "learning.last_recalled"),
    nextReview: asRequiredString(row.next_review, "learning.next_review"),
    successCount: asNumber(row.success_count, 0),
    failureCount: asNumber(row.failure_count, 0),
    notes: asString(row.notes),
    tags: parseStringArray(row.tags),
    createdAt: asRequiredString(row.created_at, "learning.created_at"),
    updatedAt: asRequiredString(row.updated_at, "learning.updated_at"),
  };
}

function mapChat(row: DbRow): DatabaseChat {
  return {
    id: asRequiredString(row.id, "chats.id"),
    userId: asRequiredString(row.user_id, "chats.user_id"),
    language: asRequiredString(row.language, "chats.language"),
    message: asRequiredString(row.message, "chats.message"),
    response: asRequiredString(row.response, "chats.response"),
    audioUrl: asString(row.audio_url),
    createdAt: asRequiredString(row.created_at, "chats.created_at"),
  };
}

function mapAdapterUser(user: DatabaseUser): AdapterUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    learningLanguages: user.learningLanguages,
    accountSetup: user.accountSetup,
  };
}

function mapAdapterSession(row: DbRow): AdapterSession {
  return {
    sessionToken: asRequiredString(row.session_token, "sessions.session_token"),
    userId: asRequiredString(row.user_id, "sessions.user_id"),
    expires: new Date(asRequiredString(row.expires, "sessions.expires")),
  };
}

function mapVerificationToken(row: DbRow): VerificationToken {
  return {
    identifier: asRequiredString(row.identifier, "verification_tokens.identifier"),
    token: asRequiredString(row.token, "verification_tokens.token"),
    expires: new Date(asRequiredString(row.expires, "verification_tokens.expires")),
  };
}

async function ensureDatabaseSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const client = getTursoClient();
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT NOT NULL UNIQUE,
          password TEXT,
          native_language TEXT NOT NULL DEFAULT 'English',
          active_language TEXT NOT NULL DEFAULT 'en',
          learning_languages TEXT NOT NULL DEFAULT '[]',
          account_setup INTEGER NOT NULL DEFAULT 0,
          email_verified TEXT,
          image TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_account_id TEXT NOT NULL,
          refresh_token TEXT,
          access_token TEXT,
          expires_at INTEGER,
          token_type TEXT,
          scope TEXT,
          id_token TEXT,
          session_state TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(provider, provider_account_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          session_token TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          expires TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS verification_tokens (
          identifier TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires TEXT NOT NULL,
          UNIQUE(identifier, token)
        )`,
        `CREATE TABLE IF NOT EXISTS progress (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          language TEXT NOT NULL,
          level INTEGER NOT NULL DEFAULT 1,
          xp INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(user_id, language),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS learning (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          language TEXT NOT NULL,
          word TEXT NOT NULL,
          translation TEXT NOT NULL,
          difficulty INTEGER NOT NULL DEFAULT 0,
          last_recalled TEXT NOT NULL,
          next_review TEXT NOT NULL,
          success_count INTEGER NOT NULL DEFAULT 0,
          failure_count INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          language TEXT NOT NULL,
          message TEXT NOT NULL,
          response TEXT NOT NULL,
          audio_url TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_learning_user_language ON learning(user_id, language)`,
        `CREATE INDEX IF NOT EXISTS idx_chats_user_language_created_at ON chats(user_id, language, created_at DESC)`,
      ];

      for (const statement of statements) {
        await client.execute(statement);
      }
    })();
  }

  await schemaPromise;
}

async function execute(sql: string, args: InArgs = []) {
  await ensureDatabaseSchema();
  return getTursoClient().execute({ sql, args });
}

async function getFirstRow(sql: string, args: InArgs = []) {
  const result = await execute(sql, args);
  return (result.rows[0] as DbRow | undefined) ?? null;
}

async function getRows(sql: string, args: InArgs = []) {
  const result = await execute(sql, args);
  return result.rows as DbRow[];
}

export async function getUserById(id: string) {
  const row = await getFirstRow("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(email: string) {
  const row = await getFirstRow("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return row ? mapUser(row) : null;
}

export async function createUser(input: CreateUserInput) {
  const timestamp = nowIso();
  const userId = createId();
  const learningLanguages = normalizeLanguages(input.learningLanguages ?? []);
  const activeLanguage = input.activeLanguage ?? learningLanguages[0] ?? "en";

  await execute(
    `INSERT INTO users (
      id,
      name,
      email,
      password,
      native_language,
      active_language,
      learning_languages,
      account_setup,
      email_verified,
      image,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.name ?? null,
      input.email,
      input.password ?? null,
      input.nativeLanguage ?? "English",
      activeLanguage,
      stringifyArray(learningLanguages),
      input.accountSetup ? 1 : 0,
      input.emailVerified?.toISOString() ?? null,
      input.image ?? null,
      timestamp,
      timestamp,
    ]
  );

  const createdUser = await getUserById(userId);
  if (!createdUser) {
    throw new Error("Failed to load newly created user");
  }

  return createdUser;
}

export async function updateUser(id: string, updates: UpdateUserInput) {
  const existingUser = await getUserById(id);
  if (!existingUser) {
    return null;
  }

  const learningLanguages = updates.learningLanguages
    ? normalizeLanguages(updates.learningLanguages)
    : existingUser.learningLanguages;

  await execute(
    `UPDATE users
      SET name = ?,
          email = ?,
          password = ?,
          native_language = ?,
          active_language = ?,
          learning_languages = ?,
          account_setup = ?,
          email_verified = ?,
          image = ?,
          updated_at = ?
      WHERE id = ?`,
    [
      updates.name ?? existingUser.name,
      updates.email ?? existingUser.email,
      updates.password === undefined ? existingUser.password : updates.password,
      updates.nativeLanguage ?? existingUser.nativeLanguage,
      updates.activeLanguage ?? existingUser.activeLanguage,
      stringifyArray(learningLanguages),
      updates.accountSetup === undefined ? (existingUser.accountSetup ? 1 : 0) : updates.accountSetup ? 1 : 0,
      updates.emailVerified === undefined
        ? existingUser.emailVerified?.toISOString() ?? null
        : updates.emailVerified?.toISOString() ?? null,
      updates.image === undefined ? existingUser.image : updates.image,
      nowIso(),
      id,
    ]
  );

  return getUserById(id);
}

export async function getProgress(userId: string, language: string) {
  const row = await getFirstRow(
    "SELECT * FROM progress WHERE user_id = ? AND language = ? LIMIT 1",
    [userId, language]
  );

  return row ? mapProgress(row) : null;
}

export async function getAllUserProgress(userId: string) {
  const rows = await getRows(
    "SELECT * FROM progress WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC",
    [userId]
  );

  return rows.map(mapProgress);
}

export async function createProgress(input: CreateProgressInput) {
  const timestamp = nowIso();
  const progressId = createId();

  await execute(
    `INSERT INTO progress (id, user_id, language, level, xp, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, language) DO UPDATE SET
        level = excluded.level,
        xp = excluded.xp,
        updated_at = excluded.updated_at`,
    [
      progressId,
      input.userId,
      input.language,
      input.level ?? 1,
      input.xp ?? 0,
      timestamp,
      timestamp,
    ]
  );

  const progress = await getProgress(input.userId, input.language);
  if (!progress) {
    throw new Error("Failed to load progress record");
  }

  return progress;
}

export async function updateProgress(id: string, updates: UpdateProgressInput) {
  const row = await getFirstRow("SELECT * FROM progress WHERE id = ? LIMIT 1", [id]);
  if (!row) {
    return null;
  }

  const existingProgress = mapProgress(row);

  await execute(
    `UPDATE progress
      SET level = ?,
          xp = ?,
          updated_at = ?
      WHERE id = ?`,
    [
      updates.level ?? existingProgress.level,
      updates.xp ?? existingProgress.xp,
      nowIso(),
      id,
    ]
  );

  const updatedRow = await getFirstRow("SELECT * FROM progress WHERE id = ? LIMIT 1", [id]);
  return updatedRow ? mapProgress(updatedRow) : null;
}

export async function createLearningItem(input: CreateLearningInput) {
  const timestamp = nowIso();
  const learningId = createId();

  await execute(
    `INSERT INTO learning (
      id,
      user_id,
      language,
      word,
      translation,
      difficulty,
      last_recalled,
      next_review,
      success_count,
      failure_count,
      notes,
      tags,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      learningId,
      input.userId,
      input.language,
      input.word,
      input.translation,
      input.difficulty ?? 0,
      input.lastRecalled ?? timestamp,
      input.nextReview,
      input.successCount ?? 0,
      input.failureCount ?? 0,
      input.notes ?? null,
      stringifyArray(input.tags ?? []),
      timestamp,
      timestamp,
    ]
  );

  const learningRow = await getFirstRow("SELECT * FROM learning WHERE id = ? LIMIT 1", [learningId]);
  if (!learningRow) {
    throw new Error("Failed to load learning item");
  }

  return mapLearning(learningRow);
}

export async function getLearningItems(userId: string, language: string) {
  const rows = await getRows(
    "SELECT * FROM learning WHERE user_id = ? AND language = ? ORDER BY next_review ASC, created_at DESC",
    [userId, language]
  );

  return rows.map(mapLearning);
}

export async function createChatMessage(input: CreateChatInput) {
  const chatId = createId();
  const timestamp = nowIso();

  await execute(
    `INSERT INTO chats (
      id,
      user_id,
      language,
      message,
      response,
      audio_url,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      chatId,
      input.userId,
      input.language,
      input.message,
      input.response,
      input.audioUrl ?? null,
      timestamp,
    ]
  );

  const chatRow = await getFirstRow("SELECT * FROM chats WHERE id = ? LIMIT 1", [chatId]);
  if (!chatRow) {
    throw new Error("Failed to load chat message");
  }

  return mapChat(chatRow);
}

export async function getChatHistory(userId: string, language: string) {
  const rows = await getRows(
    "SELECT * FROM chats WHERE user_id = ? AND language = ? ORDER BY created_at DESC",
    [userId, language]
  );

  return rows.map(mapChat);
}

export async function setActiveLanguage(userId: string, language: string) {
  return updateUser(userId, { activeLanguage: language });
}

export async function getAccountSetupStatus(userId: string) {
  const user = await getUserById(userId);
  return user?.accountSetup ?? false;
}

export async function completeAccountSetup(userId: string, input: AccountSetupInput) {
  const user = await getUserById(userId);
  if (!user) {
    return null;
  }

  const requestedLanguages = normalizeLanguages(input.learningLanguages);
  const mergedLanguages = normalizeLanguages([...user.learningLanguages, ...requestedLanguages]);
  const activeLanguage = input.activeLanguage ?? user.activeLanguage ?? requestedLanguages[0] ?? "en";

  await updateUser(userId, {
    learningLanguages: mergedLanguages,
    activeLanguage,
    accountSetup: true,
  });

  for (const language of requestedLanguages) {
    const existingProgress = await getProgress(userId, language);
    const requestedLevel = input.proficiencyLevels?.[language];
    const level = requestedLevel ? Number.parseInt(requestedLevel, 10) : existingProgress?.level ?? 1;

    await createProgress({
      userId,
      language,
      level: Number.isFinite(level) ? level : 1,
      xp: existingProgress?.xp ?? 0,
    });
  }

  return getUserById(userId);
}

export async function createAdapterUser(user: Omit<AdapterUser, "id">) {
  const existingUser = await getUserByEmail(user.email);
  if (existingUser) {
    return mapAdapterUser(existingUser);
  }

  const createdUser = await createUser({
    name: user.name,
    email: user.email,
    password: null,
    nativeLanguage: "English",
    activeLanguage: "en",
    learningLanguages: [],
    accountSetup: false,
    emailVerified: user.emailVerified,
    image: user.image,
  });

  return mapAdapterUser(createdUser);
}

export async function getAdapterUser(id: string) {
  const user = await getUserById(id);
  return user ? mapAdapterUser(user) : null;
}

export async function getAdapterUserByEmail(email: string) {
  const user = await getUserByEmail(email);
  return user ? mapAdapterUser(user) : null;
}

export async function getAdapterUserByAccount(provider: string, providerAccountId: string) {
  const row = await getFirstRow(
    `SELECT users.*
      FROM accounts
      INNER JOIN users ON users.id = accounts.user_id
      WHERE accounts.provider = ? AND accounts.provider_account_id = ?
      LIMIT 1`,
    [provider, providerAccountId]
  );

  return row ? mapAdapterUser(row) : null;
}

export async function updateAdapterUser(user: Partial<AdapterUser> & { id: string }) {
  const updatedUser = await updateUser(user.id, {
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified ?? undefined,
    image: user.image,
  });

  if (!updatedUser) {
    throw new Error("Unable to update adapter user");
  }

  return mapAdapterUser(updatedUser);
}

export async function linkAdapterAccount(account: AdapterAccount) {
  const timestamp = nowIso();
  const accountId = createId();

  await execute(
    `INSERT INTO accounts (
      id,
      user_id,
      type,
      provider,
      provider_account_id,
      refresh_token,
      access_token,
      expires_at,
      token_type,
      scope,
      id_token,
      session_state,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, provider_account_id) DO UPDATE SET
        user_id = excluded.user_id,
        type = excluded.type,
        refresh_token = excluded.refresh_token,
        access_token = excluded.access_token,
        expires_at = excluded.expires_at,
        token_type = excluded.token_type,
        scope = excluded.scope,
        id_token = excluded.id_token,
        session_state = excluded.session_state,
        updated_at = excluded.updated_at`,
    [
      accountId,
      account.userId,
      account.type,
      account.provider,
      account.providerAccountId,
      account.refresh_token ?? null,
      account.access_token ?? null,
      account.expires_at ?? null,
      account.token_type ?? null,
      account.scope ?? null,
      account.id_token ?? null,
      account.session_state ?? null,
      timestamp,
      timestamp,
    ]
  );

  return account;
}

export async function unlinkAdapterAccount(provider: string, providerAccountId: string) {
  await execute(
    "DELETE FROM accounts WHERE provider = ? AND provider_account_id = ?",
    [provider, providerAccountId]
  );
}

export async function createAdapterSession(session: AdapterSession) {
  const timestamp = nowIso();

  await execute(
    `INSERT INTO sessions (id, session_token, user_id, expires, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_token) DO UPDATE SET
        user_id = excluded.user_id,
        expires = excluded.expires,
        updated_at = excluded.updated_at`,
    [
      createId(),
      session.sessionToken,
      session.userId,
      session.expires.toISOString(),
      timestamp,
      timestamp,
    ]
  );

  return session;
}

export async function getAdapterSessionAndUser(sessionToken: string) {
  const row = await getFirstRow(
    `SELECT
        sessions.session_token,
        sessions.user_id,
        sessions.expires,
        users.id,
        users.name,
        users.email,
        users.password,
        users.native_language,
        users.active_language,
        users.learning_languages,
        users.account_setup,
        users.email_verified,
        users.image,
        users.created_at,
        users.updated_at
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.session_token = ?
      LIMIT 1`,
    [sessionToken]
  );

  if (!row) {
    return null;
  }

  return {
    session: mapAdapterSession(row),
    user: mapAdapterUser(mapUser(row)),
  };
}

export async function updateAdapterSession(session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">) {
  const existingRow = await getFirstRow(
    "SELECT * FROM sessions WHERE session_token = ? LIMIT 1",
    [session.sessionToken]
  );

  if (!existingRow) {
    return null;
  }

  const existingSession = mapAdapterSession(existingRow);

  await execute(
    `UPDATE sessions
      SET user_id = ?,
          expires = ?,
          updated_at = ?
      WHERE session_token = ?`,
    [
      session.userId ?? existingSession.userId,
      (session.expires ?? existingSession.expires).toISOString(),
      nowIso(),
      session.sessionToken,
    ]
  );

  const updatedRow = await getFirstRow(
    "SELECT * FROM sessions WHERE session_token = ? LIMIT 1",
    [session.sessionToken]
  );

  return updatedRow ? mapAdapterSession(updatedRow) : null;
}

export async function deleteAdapterSession(sessionToken: string) {
  await execute("DELETE FROM sessions WHERE session_token = ?", [sessionToken]);
}

export async function createAdapterVerificationToken(token: VerificationToken) {
  await execute(
    `INSERT INTO verification_tokens (identifier, token, expires)
      VALUES (?, ?, ?)
      ON CONFLICT(identifier, token) DO UPDATE SET expires = excluded.expires`,
    [token.identifier, token.token, token.expires.toISOString()]
  );

  return token;
}

export async function consumeAdapterVerificationToken(identifier: string, token: string) {
  const row = await getFirstRow(
    "SELECT * FROM verification_tokens WHERE identifier = ? AND token = ? LIMIT 1",
    [identifier, token]
  );

  if (!row) {
    return null;
  }

  await execute(
    "DELETE FROM verification_tokens WHERE identifier = ? AND token = ?",
    [identifier, token]
  );

  return mapVerificationToken(row);
}

export async function deleteAdapterUser(userId: string) {
  await execute("DELETE FROM users WHERE id = ?", [userId]);
}

function getTursoClient() {
  if (tursoClient) {
    return tursoClient;
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error("TURSO_DATABASE_URL environment variable is not set");
  }

  tursoClient = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
    intMode: "number",
  });

  return tursoClient;
}
