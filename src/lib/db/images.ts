import { asNumber, asString, createId, execute, getFirstRow, getRows, nowIso, type DbRow } from "./client";

/**
 * Generated vocabulary pictures, one row per English concept. A row is claimed (status "pending")
 * before anything is generated so concurrent requests for the same concept never pay twice; a failed
 * generation can be claimed again once its back-off has passed.
 */

export type ConceptImageStatus = "pending" | "ready" | "failed";

export interface ConceptImageRef {
  id: string;
  conceptKey: string;
  status: ConceptImageStatus;
}

export interface ConceptImageData {
  id: string;
  status: ConceptImageStatus;
  mimeType: string | null;
  data: Uint8Array | null;
}

/** A pending claim older than this is treated as abandoned (the process died mid-generation). */
export const STALE_CLAIM_MS = 3 * 60 * 1000;
const FIRST_RETRY_MS = 10 * 60 * 1000;
const MAX_RETRY_MS = 24 * 60 * 60 * 1000;

/** Back-off after the n-th failed attempt: 10 min, 20 min, 40 min … capped at a day. */
export function retryDelayMs(attempts: number): number {
  return Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** Math.max(0, attempts - 1));
}

function toStatus(value: unknown): ConceptImageStatus {
  return value === "ready" || value === "failed" ? value : "pending";
}

function mapRef(row: DbRow): ConceptImageRef {
  return { id: String(row.id), conceptKey: String(row.concept_key), status: toStatus(row.status) };
}

function toBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

export type ClaimResult =
  /** This caller owns the generation and must finish it with complete/fail/release. */
  | { claimed: true; image: ConceptImageRef }
  /** Someone else is generating it, it is ready, or it failed recently. */
  | { claimed: false; image: ConceptImageRef | null };

export async function claimConceptImage(params: { conceptKey: string; description: string; now?: Date }): Promise<ClaimResult> {
  const now = params.now ?? new Date();
  const timestamp = nowIso(now);

  const inserted = await execute(
    `INSERT INTO concept_images (id, concept_key, description, status, attempts, claimed_at, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', 1, ?, ?, ?)
      ON CONFLICT(concept_key) DO NOTHING`,
    [createId(), params.conceptKey, params.description, timestamp, timestamp, timestamp]
  );

  let claimed = inserted.rowsAffected > 0;
  if (!claimed) {
    // Take over a failed row whose back-off is over, or a pending one that was abandoned. The
    // conditional UPDATE is atomic, so only one concurrent caller can win it.
    const takenOver = await execute(
      `UPDATE concept_images SET
          status = 'pending', description = ?, attempts = attempts + 1, claimed_at = ?, updated_at = ?
        WHERE concept_key = ? AND (
          (status = 'failed' AND (retry_after IS NULL OR retry_after <= ?))
          OR (status = 'pending' AND claimed_at < ?)
        )`,
      [params.description, timestamp, timestamp, params.conceptKey, timestamp, nowIso(new Date(now.getTime() - STALE_CLAIM_MS))]
    );
    claimed = takenOver.rowsAffected > 0;
  }

  const row = await getFirstRow("SELECT id, concept_key, status FROM concept_images WHERE concept_key = ? LIMIT 1", [params.conceptKey]);
  if (!row) {
    return { claimed: false, image: null };
  }

  const image = mapRef(row);
  return claimed ? { claimed: true, image } : { claimed: false, image };
}

export async function completeConceptImage(params: {
  id: string;
  data: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  model: string;
}): Promise<void> {
  await execute(
    `UPDATE concept_images SET
        status = 'ready', data = ?, mime_type = ?, byte_size = ?, width = ?, height = ?, model = ?,
        last_error = NULL, retry_after = NULL, updated_at = ?
      WHERE id = ?`,
    [params.data, params.mimeType, params.data.byteLength, params.width, params.height, params.model, nowIso(), params.id]
  );
}

export async function failConceptImage(params: { id: string; error: string; now?: Date }): Promise<void> {
  const now = params.now ?? new Date();
  const row = await getFirstRow("SELECT attempts FROM concept_images WHERE id = ? LIMIT 1", [params.id]);
  const retryAfter = new Date(now.getTime() + retryDelayMs(asNumber(row?.attempts, 1)));
  await execute(
    `UPDATE concept_images SET status = 'failed', last_error = ?, retry_after = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`,
    [params.error.slice(0, 500), nowIso(retryAfter), nowIso(now), params.id]
  );
}

/** Gives a claim back without counting it as an attempt (e.g. the learner's quota was used up). */
export async function releaseConceptImage(id: string, now: Date = new Date()): Promise<void> {
  await execute(
    `UPDATE concept_images SET status = 'failed', attempts = MAX(0, attempts - 1), retry_after = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`,
    [nowIso(now), nowIso(now), id]
  );
}

/** Existing rows for the given concept keys (any status). */
export async function findConceptImages(conceptKeys: string[]): Promise<Map<string, ConceptImageRef>> {
  const keys = Array.from(new Set(conceptKeys.filter(Boolean))).slice(0, 200);
  if (keys.length === 0) return new Map();
  const rows = await getRows(
    `SELECT id, concept_key, status FROM concept_images WHERE concept_key IN (${keys.map(() => "?").join(", ")})`,
    keys
  );
  return new Map(rows.map((row) => [String(row.concept_key), mapRef(row)]));
}

export async function getConceptImageData(id: string): Promise<ConceptImageData | null> {
  const row = await getFirstRow("SELECT id, status, mime_type, data FROM concept_images WHERE id = ? LIMIT 1", [id]);
  if (!row) return null;
  return { id: String(row.id), status: toStatus(row.status), mimeType: asString(row.mime_type), data: toBytes(row.data) };
}
