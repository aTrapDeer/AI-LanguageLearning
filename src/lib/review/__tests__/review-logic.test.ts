import { describe, expect, it } from "vitest";
import { formatDueIn, formatInterval, previewIntervals } from "../intervals";
import {
  canGenerateMore,
  cardDirection,
  DAILY_GENERATED_WORD_CAP,
  MAX_GRADES_PER_CARD,
  planSession,
  SESSION_MAX_CARDS,
  SESSION_MAX_NEW,
  topUpCount,
  type PlannableItem,
} from "../plan";
import { createQueue, currentCardId, dropCard, gradeCurrent, isQueueFinished, queueProgress, queueStats } from "../queue";
import { nextStreakMilestone, scoreSession, streakMilestone } from "../scoring";
import { INITIAL_SRS_STATE } from "../../srs";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

describe("formatInterval", () => {
  it("uses compact units", () => {
    expect(formatInterval(10 * MIN)).toBe("10 min");
    expect(formatInterval(5 * 1000)).toBe("1 min");
    expect(formatInterval(3 * 60 * MIN)).toBe("3 h");
    expect(formatInterval(DAY)).toBe("1 d");
    expect(formatInterval(3 * DAY)).toBe("3 d");
    expect(formatInterval(45 * DAY)).toBe("1.5 mo");
    expect(formatInterval(60 * DAY)).toBe("2 mo");
    expect(formatInterval(365 * DAY)).toBe("1 y");
    expect(formatInterval(Number.NaN)).toBe("1 min");
  });
});

describe("previewIntervals", () => {
  it("matches the scheduler for a new card", () => {
    const preview = previewIntervals(INITIAL_SRS_STATE, NOW);
    expect(preview.again.label).toBe("10 min");
    expect(preview.hard.label).toBe("1 d");
    expect(preview.good.label).toBe("1 d");
    expect(preview.easy.label).toBe("4 d");
  });

  it("grows with a reviewed card", () => {
    const preview = previewIntervals({ intervalDays: 10, ease: 2.5, repetitions: 3, lapses: 0 }, NOW);
    expect(preview.again.label).toBe("10 min");
    expect(preview.good.label).toBe("25 d");
    expect(preview.good.nextReview.getTime()).toBe(NOW.getTime() + 25 * DAY);
  });
});

describe("formatDueIn", () => {
  it("describes upcoming times", () => {
    expect(formatDueIn(null, NOW)).toBeNull();
    expect(formatDueIn("not a date", NOW)).toBeNull();
    expect(formatDueIn(new Date(NOW.getTime() - MIN), NOW)).toBe("now");
    expect(formatDueIn(new Date(NOW.getTime() + 10 * MIN), NOW)).toBe("in 10 minutes");
    expect(formatDueIn(new Date(NOW.getTime() + 60 * MIN), NOW)).toBe("in 1 hour");
    expect(formatDueIn(new Date(NOW.getTime() + 5 * 60 * MIN), NOW)).toBe("in 5 hours");
    expect(formatDueIn(new Date(NOW.getTime() + DAY), NOW)).toBe("tomorrow");
    expect(formatDueIn(new Date(NOW.getTime() + 4 * DAY).toISOString(), NOW)).toBe("in 4 days");
    expect(formatDueIn(new Date(NOW.getTime() + 90 * DAY), NOW)).toBe("in 3 months");
  });
});

function item(id: string, maturity: PlannableItem["maturity"], minutesAgo: number): PlannableItem {
  return { id, maturity, nextReview: new Date(NOW.getTime() - minutesAgo * MIN).toISOString() };
}

describe("planSession", () => {
  it("serves seen cards first, most overdue first, then new words", () => {
    const plan = planSession([item("n1", "new", 5), item("r1", "learning", 10), item("r2", "mature", 600), item("n2", "new", 50)]);
    expect(plan.map((entry) => entry.id)).toEqual(["r2", "r1", "n2", "n1"]);
  });

  it("caps the session and the number of new words", () => {
    const due = [
      ...Array.from({ length: 30 }, (_, index) => item(`n${index}`, "new", index)),
      ...Array.from({ length: 5 }, (_, index) => item(`r${index}`, "young", 100 + index)),
    ];
    const plan = planSession(due);
    expect(plan).toHaveLength(5 + SESSION_MAX_NEW);
    expect(plan.filter((entry) => entry.maturity === "new")).toHaveLength(SESSION_MAX_NEW);

    const many = Array.from({ length: 40 }, (_, index) => item(`r${index}`, "learning", index));
    expect(planSession(many)).toHaveLength(SESSION_MAX_CARDS);
  });

  it("does not add new words when reviews fill the session", () => {
    const due = [...Array.from({ length: 25 }, (_, index) => item(`r${index}`, "learning", index)), item("n", "new", 1)];
    expect(planSession(due).some((entry) => entry.id === "n")).toBe(false);
  });
});

describe("cardDirection", () => {
  it("recognises new/learning words and produces young/mature ones", () => {
    expect(cardDirection("new")).toBe("recognize");
    expect(cardDirection("learning")).toBe("recognize");
    expect(cardDirection("young")).toBe("produce");
    expect(cardDirection("mature")).toBe("produce");
  });
});

describe("topUpCount", () => {
  const base = { plannedCards: 0, deckSize: 0, generatedLast24h: 0, aiAvailable: true };

  it("fills an empty deck", () => {
    expect(topUpCount(base)).toBe(10);
  });

  it("tops up a thin session", () => {
    expect(topUpCount({ ...base, plannedCards: 3, deckSize: 40 })).toBe(7);
    expect(topUpCount({ ...base, plannedCards: 8, deckSize: 40 })).toBe(5);
  });

  it("leaves a caught-up learner alone unless they ask", () => {
    expect(topUpCount({ ...base, plannedCards: 0, deckSize: 40 })).toBe(0);
    expect(topUpCount({ ...base, plannedCards: 0, deckSize: 40, requested: true })).toBe(10);
  });

  it("does nothing for a full session or without AI", () => {
    expect(topUpCount({ ...base, plannedCards: 12, deckSize: 40 })).toBe(0);
    expect(topUpCount({ ...base, aiAvailable: false })).toBe(0);
  });

  it("respects the daily cap", () => {
    expect(topUpCount({ ...base, generatedLast24h: DAILY_GENERATED_WORD_CAP - 6 })).toBe(6);
    expect(topUpCount({ ...base, generatedLast24h: DAILY_GENERATED_WORD_CAP - 2 })).toBe(0);
    expect(canGenerateMore(DAILY_GENERATED_WORD_CAP - 2, true)).toBe(false);
    expect(canGenerateMore(0, true)).toBe(true);
    expect(canGenerateMore(0, false)).toBe(false);
  });
});

describe("review queue", () => {
  it("removes cards on a pass and finishes", () => {
    let queue = createQueue(["a", "b"]);
    expect(currentCardId(queue)).toBe("a");
    queue = gradeCurrent(queue, "good");
    queue = gradeCurrent(queue, "easy");
    expect(isQueueFinished(queue)).toBe(true);
    expect(queueProgress(queue)).toBe(1);
    expect(queue.done).toEqual(["a", "b"]);
  });

  it("brings an 'again' card back a few cards later", () => {
    let queue = createQueue(["a", "b", "c", "d", "e"]);
    queue = gradeCurrent(queue, "again");
    expect(queue.order).toEqual(["b", "c", "d", "a", "e"]);
    expect(queueProgress(queue)).toBe(0);
  });

  it("re-shows an 'again' card immediately when it is the last one", () => {
    let queue = createQueue(["a"]);
    queue = gradeCurrent(queue, "again");
    expect(queue.order).toEqual(["a"]);
    queue = gradeCurrent(queue, "good");
    expect(isQueueFinished(queue)).toBe(true);
  });

  it("stops re-queuing after the maximum tries or when the server refuses", () => {
    let queue = createQueue(["a"]);
    for (let index = 0; index < MAX_GRADES_PER_CARD; index += 1) {
      queue = gradeCurrent(queue, "again");
    }
    expect(isQueueFinished(queue)).toBe(true);

    let refused = createQueue(["a", "b"]);
    refused = gradeCurrent(refused, "again", { requeue: false });
    expect(refused.order).toEqual(["b"]);
  });

  it("drops a card and scores by first grade", () => {
    let queue = createQueue(["a", "b", "c", "a"]);
    expect(queue.total).toBe(3);
    queue = gradeCurrent(queue, "again");
    queue = gradeCurrent(queue, "good");
    queue = dropCard(queue, "c");
    expect(queue.order).toEqual(["a"]);
    queue = gradeCurrent(queue, "good");
    expect(queueStats(queue)).toEqual({ reviewed: 2, correct: 1, struggled: ["a"] });
  });
});

describe("scoring", () => {
  it("scores first grades with the review XP rules", () => {
    expect(scoreSession([])).toEqual({ reviewed: 0, correct: 0, accuracy: 0, xp: 0 });
    expect(scoreSession(["good", "again", null, "easy"])).toEqual({ reviewed: 3, correct: 2, accuracy: 2 / 3, xp: 5 });
    // 5 items earn the session bonus.
    expect(scoreSession(["good", "good", "good", "hard", "again"]).xp).toBe(4 * 2 + 1 + 5);
  });

  it("finds streak milestones", () => {
    expect(streakMilestone(7)).toBe(7);
    expect(streakMilestone(8)).toBeNull();
    expect(nextStreakMilestone(0)).toBe(3);
    expect(nextStreakMilestone(7)).toBe(14);
    expect(nextStreakMilestone(5000)).toBeNull();
  });
});
