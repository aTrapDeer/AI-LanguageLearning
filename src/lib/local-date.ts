/**
 * Calendar-date helpers. A "local date" is a `YYYY-MM-DD` string in the learner's own timezone;
 * streaks and daily goals are keyed on it so a day ends at the learner's midnight, not UTC's.
 */

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** The device's local calendar date. Call this in the browser and send it to the server. */
export function getLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getUtcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function toUtcMs(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Shifts a `YYYY-MM-DD` date by whole days. */
export function addDays(localDate: string, days: number): string {
  return new Date(toUtcMs(localDate) + days * DAY_MS).toISOString().slice(0, 10);
}

/** `later - earlier` in whole calendar days. */
export function diffDays(later: string, earlier: string): number {
  return Math.round((toUtcMs(later) - toUtcMs(earlier)) / DAY_MS);
}

/**
 * Server-side: trust the client's local date only if it is a real date within one day of the
 * server's UTC date (every real timezone is within ±14h); otherwise fall back to UTC today.
 */
export function resolveLocalDate(clientDate: unknown, now: Date = new Date()): string {
  const utcToday = getUtcDateString(now);
  if (!isValidLocalDate(clientDate)) {
    return utcToday;
  }

  return Math.abs(diffDays(clientDate, utcToday)) <= 1 ? clientDate : utcToday;
}
