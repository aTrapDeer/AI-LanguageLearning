import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  DailyGoalRing,
  FeedbackBanner,
  LessonShell,
  ProgressBar,
  SessionSummary,
  SpeakButton,
  StarRating,
  StreakBadge,
  XpPill,
} from "..";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** Server-render smoke tests: every primitive renders, exposes accessible labels and clamps input. */
describe("learn UI primitives", () => {
  it("ProgressBar exposes a clamped progressbar role", () => {
    const html = renderToStaticMarkup(<ProgressBar value={1.7} label="Lesson progress" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('aria-label="Lesson progress"');
  });

  it("StreakBadge, XpPill, DailyGoalRing and StarRating describe themselves", () => {
    expect(renderToStaticMarkup(<StreakBadge streak={4} atRisk />)).toContain("4-day streak, practise today to keep it");
    expect(renderToStaticMarkup(<StreakBadge streak={0} />)).toContain("No streak yet");
    expect(renderToStaticMarkup(<XpPill xp={120} />)).toContain("120 XP");
    expect(renderToStaticMarkup(<DailyGoalRing xp={15} goal={30} showLabel />)).toContain("Daily goal: 15 of 30 XP");
    expect(renderToStaticMarkup(<DailyGoalRing xp={45} goal={30} />)).toContain("Daily goal reached");
    expect(renderToStaticMarkup(<StarRating stars={5} />)).toContain("3 of 3 stars");
  });

  it("LessonShell renders the exit control, progress and slots", () => {
    const html = renderToStaticMarkup(
      <LessonShell exitHref="/dashboard" progress={0.5} topBarEnd={<span>slot-end</span>} footer={<div>slot-footer</div>}>
        <p>body</p>
      </LessonShell>
    );
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('aria-label="Exit"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain("slot-end");
    expect(html).toContain("slot-footer");
    expect(html).toContain("body");
  });

  it("FeedbackBanner shows the correct answer on mistakes and hides when idle", () => {
    const wrong = renderToStaticMarkup(<FeedbackBanner status="incorrect" correctAnswer="Ich bin müde" onContinue={() => {}} />);
    expect(wrong).toContain("Not quite");
    expect(wrong).toContain("Ich bin müde");
    expect(wrong).toContain('role="status"');
    expect(renderToStaticMarkup(<FeedbackBanner status={null} onContinue={() => {}} />)).toBe("");
  });

  it("SessionSummary shows stats, celebrations and actions", () => {
    const html = renderToStaticMarkup(
      <SessionSummary
        accuracy={0.9}
        xpGained={25}
        stars={2}
        streak={3}
        leveledUp
        level={3}
        goalJustReached
        dailyXp={35}
        dailyGoal={30}
        stats={[{ label: "New words", value: 8 }]}
        primaryAction={{ label: "Continue", href: "/learn/journey" }}
        secondaryAction={{ label: "Review mistakes", onClick: () => {} }}
      />
    );
    expect(html).toContain("Lesson complete!");
    expect(html).toContain("90%");
    expect(html).toContain("25 XP gained");
    expect(html).toContain("3 days");
    expect(html).toContain("Level up! You reached level 3");
    expect(html).toContain("A2");
    expect(html).toContain("Daily goal reached");
    expect(html).toContain("New words");
    expect(html).toContain('href="/learn/journey"');
    expect(html).toContain("Review mistakes");
  });

  it("SpeakButton renders nothing without a matching voice", () => {
    expect(renderToStaticMarkup(<SpeakButton text="Hallo" language="de" />)).toBe("");
  });
});
