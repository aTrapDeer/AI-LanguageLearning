import type { AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";
import { clampLevel, onboardingChoiceToLevel } from "./levels";
import {
  asBoolean,
  asNumber,
  asRequiredString,
  asString,
  createId,
  ensureDatabaseSchema,
  execute,
  getFirstRow,
  getRows,
  nowIso,
  parseStringArray,
  type DbRow,
} from "./db/client";
import { getProgress, mapProgress } from "./db/progress";
import { DATABASE_TABLES } from "./db/schema";

/*
 * Data access entry point. Users/auth/progress live here; the learning domain is split into
 * ./db/* modules and re-exported below so callers can import everything from "@/lib/database".
 * Server-only: never import this from a client component.
 */
export * from "./db/progress";
export * from "./db/vocabulary";
export * from "./db/lessons";
export * from "./db/activity";
export * from "./db/chat";
export * from "./db/mistakes";
export * from "./db/quota";
export * from "./db/summary";

export interface DatabaseUser {
  id: string;
  name: string | null;
  email: string;
  /** bcrypt hash. Never send this to a client; use {@link toPublicUser}. */
  password: string | null;
  nativeLanguage: string;
  activeLanguage: string;
  learningLanguages: string[];
  accountSetup: boolean;
  /** Null means "use the default daily goal". */
  dailyXpGoal: number | null;
  emailVerified: Date | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Omit<DatabaseUser, "password"> & { hasPassword: boolean };

/** The only user shape routes may return. Strips the password hash. */
export function toPublicUser(user: DatabaseUser): PublicUser {
  const { password, ...rest } = user;
  return { ...rest, hasPassword: Boolean(password) };
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

export interface CreateProgressInput {
  userId: string;
  language: string;
  level?: number;
  xp?: number;
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
  /** Onboarding self-assessment per language: "1".."5", mapped to levels 1/3/5/7/9. */
  proficiencyLevels?: Record<string, string>;
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
  const dailyXpGoal = row.daily_xp_goal === null || row.daily_xp_goal === undefined ? null : asNumber(row.daily_xp_goal);

  return {
    id: asRequiredString(row.id, "users.id"),
    name: asString(row.name),
    email: asRequiredString(row.email, "users.email"),
    password: asString(row.password),
    nativeLanguage: asString(row.native_language) ?? "English",
    activeLanguage: asString(row.active_language) ?? "en",
    learningLanguages: parseStringArray(row.learning_languages),
    accountSetup: asBoolean(row.account_setup),
    dailyXpGoal: dailyXpGoal && dailyXpGoal > 0 ? dailyXpGoal : null,
    emailVerified: row.email_verified ? new Date(asRequiredString(row.email_verified, "users.email_verified")) : null,
    image: asString(row.image),
    createdAt: asRequiredString(row.created_at, "users.created_at"),
    updatedAt: asRequiredString(row.updated_at, "users.updated_at"),
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

export async function initializeDatabaseSchema() {
  await ensureDatabaseSchema();
}

export async function getDatabaseTableCounts() {
  const counts: Record<string, number> = {};

  for (const tableName of DATABASE_TABLES) {
    const row = await getFirstRow(`SELECT COUNT(*) AS count FROM ${tableName}`);
    counts[tableName] = asNumber(row?.count, 0);
  }

  return counts;
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

/** Sets the learner's daily XP goal (null resets to the default). */
export async function setDailyXpGoal(userId: string, goal: number | null) {
  const value = goal === null ? null : Math.max(1, Math.min(500, Math.round(goal)));
  await execute("UPDATE users SET daily_xp_goal = ?, updated_at = ? WHERE id = ?", [value, nowIso(), userId]);
  return getUserById(userId);
}

export async function getAllUserProgress(userId: string) {
  const rows = await getRows(
    "SELECT * FROM progress WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC",
    [userId]
  );

  return rows.map(mapProgress);
}

/**
 * Creates the (user, language) progress row, or updates its level if it exists.
 * XP is never lowered here: an existing row keeps the larger of its XP and `input.xp`.
 */
export async function createProgress(input: CreateProgressInput) {
  const timestamp = nowIso();

  await execute(
    `INSERT INTO progress (id, user_id, language, level, xp, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, language) DO UPDATE SET
        level = excluded.level,
        xp = MAX(progress.xp, excluded.xp),
        updated_at = excluded.updated_at`,
    [
      createId(),
      input.userId,
      input.language,
      clampLevel(input.level ?? 1),
      Math.max(0, Math.round(input.xp ?? 0)),
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

/** Creates the progress row with `level` only if none exists; never changes an existing row. */
export async function ensureProgress(userId: string, language: string, level = 1) {
  const timestamp = nowIso();
  await execute(
    `INSERT INTO progress (id, user_id, language, level, xp, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(user_id, language) DO NOTHING`,
    [createId(), userId, language, clampLevel(level), timestamp, timestamp]
  );

  const progress = await getProgress(userId, language);
  if (!progress) {
    throw new Error("Failed to load progress record");
  }

  return progress;
}

/** Legacy flat chat log used by the current chat routes. New code should use chat sessions. */
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
  if (requestedLanguages.length === 0) {
    throw new Error("At least one learning language is required");
  }

  const mergedLanguages = normalizeLanguages([...user.learningLanguages, ...requestedLanguages]);
  const preferredActiveLanguage = input.activeLanguage ?? user.activeLanguage ?? requestedLanguages[0] ?? "en";
  const activeLanguage = mergedLanguages.includes(preferredActiveLanguage)
    ? preferredActiveLanguage
    : mergedLanguages[0] ?? "en";

  await updateUser(userId, {
    learningLanguages: mergedLanguages,
    activeLanguage,
    accountSetup: true,
  });

  for (const language of requestedLanguages) {
    const existingProgress = await getProgress(userId, language);
    const requestedChoice = input.proficiencyLevels?.[language];
    const level = requestedChoice ? onboardingChoiceToLevel(requestedChoice) : existingProgress?.level ?? 1;

    await createProgress({
      userId,
      language,
      level,
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

  return row ? mapAdapterUser(mapUser(row)) : null;
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

