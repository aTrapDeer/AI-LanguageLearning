import { describe, expect, it } from "vitest";
import { addDays, diffDays, getLocalDateString, getUtcDateString, isValidLocalDate, resolveLocalDate } from "../local-date";

describe("local-date", () => {
  it("formats local and UTC dates", () => {
    expect(getLocalDateString(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(getUtcDateString(new Date("2026-01-05T23:30:00Z"))).toBe("2026-01-05");
  });

  it("validates real calendar dates", () => {
    expect(isValidLocalDate("2026-02-28")).toBe(true);
    expect(isValidLocalDate("2024-02-29")).toBe(true);
    expect(isValidLocalDate("2026-02-29")).toBe(false);
    expect(isValidLocalDate("2026-13-01")).toBe(false);
    expect(isValidLocalDate("2026-1-01")).toBe(false);
    expect(isValidLocalDate(20260101)).toBe(false);
  });

  it("does day arithmetic across month/year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2027-01-01", "2026-12-31")).toBe(1);
    expect(diffDays("2026-03-29", "2026-03-28")).toBe(1);
  });

  it("accepts client dates within one day of UTC and falls back otherwise", () => {
    const now = new Date("2026-06-15T02:00:00Z");
    expect(resolveLocalDate("2026-06-14", now)).toBe("2026-06-14");
    expect(resolveLocalDate("2026-06-16", now)).toBe("2026-06-16");
    expect(resolveLocalDate("2026-06-15", now)).toBe("2026-06-15");
    expect(resolveLocalDate("2026-06-12", now)).toBe("2026-06-15");
    expect(resolveLocalDate("not-a-date", now)).toBe("2026-06-15");
    expect(resolveLocalDate(undefined, now)).toBe("2026-06-15");
  });
});
