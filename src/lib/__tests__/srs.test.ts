import { describe, expect, it } from "vitest";
import {
  DEFAULT_EASE,
  getMaturity,
  gradeFromOutcome,
  INITIAL_SRS_STATE,
  isDue,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  RELEARN_DELAY_MINUTES,
  scheduleReview,
  type SrsState,
} from "../srs";

const NOW = new Date("2026-03-01T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function run(grades: Array<"again" | "hard" | "good" | "easy">, start: SrsState = INITIAL_SRS_STATE) {
  let state: SrsState = start;
  let now = NOW;
  const intervals: number[] = [];
  for (const grade of grades) {
    const next = scheduleReview(state, grade, now);
    intervals.push(next.intervalDays);
    now = next.nextReview;
    state = next;
  }
  return { state, intervals };
}

describe("scheduleReview", () => {
  it("follows the SM-2 progression for repeated 'good'", () => {
    const { intervals, state } = run(["good", "good", "good", "good"]);
    expect(intervals).toEqual([1, 3, 8, 20]);
    expect(state.ease).toBe(DEFAULT_EASE);
    expect(state.repetitions).toBe(4);
  });

  it("schedules the next review relative to now", () => {
    const next = scheduleReview(INITIAL_SRS_STATE, "good", NOW);
    expect(next.nextReview.getTime() - NOW.getTime()).toBe(DAY);
  });

  it("'again' resets repetitions, lowers ease, counts a lapse only after a success", () => {
    const fresh = scheduleReview(INITIAL_SRS_STATE, "again", NOW);
    expect(fresh.lapses).toBe(0);
    expect(fresh.repetitions).toBe(0);
    expect(fresh.intervalDays).toBe(0);
    expect(fresh.nextReview.getTime() - NOW.getTime()).toBe(RELEARN_DELAY_MINUTES * 60 * 1000);

    const learned = run(["good", "good", "good"]).state;
    const lapsed = scheduleReview(learned, "again", NOW);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.ease).toBeCloseTo(learned.ease - 0.2);
  });

  it("orders intervals hard < good < easy", () => {
    const base = run(["good", "good"]).state;
    const hard = scheduleReview(base, "hard", NOW).intervalDays;
    const good = scheduleReview(base, "good", NOW).intervalDays;
    const easy = scheduleReview(base, "easy", NOW).intervalDays;
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
    expect(scheduleReview(INITIAL_SRS_STATE, "easy", NOW).intervalDays).toBe(4);
  });

  it("never drops ease below the minimum and caps the interval", () => {
    const { state } = run(Array(20).fill("again"));
    expect(state.ease).toBe(MIN_EASE);

    const long = scheduleReview({ intervalDays: 300, ease: 3, repetitions: 10, lapses: 0 }, "easy", NOW);
    expect(long.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it("is deterministic and does not mutate input", () => {
    const state = { intervalDays: 5, ease: 2.3, repetitions: 3, lapses: 1 };
    const copy = { ...state };
    expect(scheduleReview(state, "good", NOW)).toEqual(scheduleReview(state, "good", NOW));
    expect(state).toEqual(copy);
  });

  it("tolerates corrupt state", () => {
    const next = scheduleReview({ intervalDays: Number.NaN, ease: -1, repetitions: -2 }, "good", NOW);
    expect(next.intervalDays).toBe(1);
    expect(next.ease).toBeGreaterThanOrEqual(MIN_EASE);
    expect(scheduleReview(null, "good", NOW).intervalDays).toBe(1);
  });
});

describe("gradeFromOutcome", () => {
  it("maps exercise results to grades", () => {
    expect(gradeFromOutcome(false)).toBe("again");
    expect(gradeFromOutcome(true)).toBe("good");
    expect(gradeFromOutcome({ correct: true, hesitant: true })).toBe("hard");
    expect(gradeFromOutcome({ correct: true, effortless: true })).toBe("easy");
    expect(gradeFromOutcome({ correct: false, effortless: true })).toBe("again");
  });
});

describe("isDue / getMaturity", () => {
  it("compares against now", () => {
    expect(isDue(null, NOW)).toBe(true);
    expect(isDue("2026-03-01T11:59:59.000Z", NOW)).toBe(true);
    expect(isDue(NOW, NOW)).toBe(true);
    expect(isDue(new Date(NOW.getTime() + 1), NOW)).toBe(false);
    expect(isDue("garbage", NOW)).toBe(true);
  });

  it("buckets by review count and interval", () => {
    expect(getMaturity({ intervalDays: 0 }, 0)).toBe("new");
    expect(getMaturity({ intervalDays: 3 }, 2)).toBe("learning");
    expect(getMaturity({ intervalDays: 7 }, 3)).toBe("young");
    expect(getMaturity({ intervalDays: 21 }, 5)).toBe("mature");
  });
});
