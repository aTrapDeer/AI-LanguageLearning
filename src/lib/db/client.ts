import { createClient, type Client, type InArgs, type InStatement, type ResultSet } from "@libsql/client";
import { migrateSchema } from "./schema";

export type DbRow = Record<string, unknown>;

let client: Client | null = null;
let schemaPromise: Promise<void> | null = null;

/**
 * libSQL client. `TURSO_DATABASE_URL` may be a Turso URL (libsql://…) or a local SQLite file
 * (`file:/absolute/path/dev.db`) for development and tests.
 */
export function getDbClient(): Client {
  if (client) {
    return client;
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL environment variable is not set");
  }

  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN, intMode: "number" });
  return client;
}

/** Creates missing tables/columns/indexes once per process. Safe to call repeatedly. */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = migrateSchema(getDbClient()).catch((error) => {
      // Allow a later request to retry instead of caching the failure forever.
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;
}

export async function execute(sql: string, args: InArgs = []): Promise<ResultSet> {
  await ensureDatabaseSchema();
  return getDbClient().execute({ sql, args });
}

/** Runs statements in one transaction (all-or-nothing). */
export async function executeBatch(statements: InStatement[]): Promise<ResultSet[]> {
  await ensureDatabaseSchema();
  return getDbClient().batch(statements, "write");
}

export async function getFirstRow(sql: string, args: InArgs = []): Promise<DbRow | null> {
  const result = await execute(sql, args);
  return (result.rows[0] as DbRow | undefined) ?? null;
}

export async function getRows(sql: string, args: InArgs = []): Promise<DbRow[]> {
  const result = await execute(sql, args);
  return result.rows as unknown as DbRow[];
}

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function createId(): string {
  return crypto.randomUUID();
}

export function asString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

export function asRequiredString(value: unknown, field: string): string {
  const stringValue = asString(value);
  if (!stringValue) {
    throw new Error(`Missing required database field: ${field}`);
  }

  return stringValue;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export function parseJson<T = unknown>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseStringArray(value: unknown): string[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
}

export function toJson(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

/** Test-only: drop the cached client so a new TURSO_DATABASE_URL takes effect. */
export function resetDatabaseClientForTests(): void {
  client?.close();
  client = null;
  schemaPromise = null;
}
