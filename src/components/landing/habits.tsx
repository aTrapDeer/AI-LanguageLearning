import { Flame, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { GoalRingDemo } from "./vignettes/goal-ring-demo";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const DONE = [true, true, true, true, true, false, false];

export function Habits() {
  return (
    <section aria-labelledby="habits-title" className="border-t border-ink-900/[0.06] bg-paper-deep px-4 py-20 sm:px-6 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="habits-title"
          eyebrow="Keep going"
          title="Small wins, every day."
          lede="A daily goal you choose, a streak that counts the days you show up, and stars that show how well each unit went."
        />
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          <Reveal as="li" className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_40px_-28px_rgb(24_18_63/0.35)] sm:p-7">
            <GoalRingDemo />
            <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-ink-950">A goal that fits your day</h3>
            <p className="mt-2 text-ink-600">Pick 10, 20, 30 or 50 XP a day. Lessons, reviews, chat and voice all count towards it.</p>
          </Reveal>
          <Reveal as="li" delay={80} className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_40px_-28px_rgb(24_18_63/0.35)] sm:p-7">
            <div aria-hidden className="flex h-[6.5rem] items-center gap-1.5">
              {WEEK.map((day, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <span
                    className={cn(
                      "flex h-10 w-full max-w-[2.5rem] items-center justify-center rounded-xl",
                      DONE[index] ? "bg-gradient-to-b from-ember-300 to-ember-500" : "border border-dashed border-ink-200"
                    )}
                  >
                    {DONE[index] && <Flame className="h-4 w-4 fill-white text-white" />}
                  </span>
                  <span className="font-mono text-[11px] text-ink-500">{day}</span>
                </div>
              ))}
            </div>
            <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-ink-950">Streaks without guilt</h3>
            <p className="mt-2 text-ink-600">Watch your streak grow and celebrate milestones. Miss a day? Just start again.</p>
          </Reveal>
          <Reveal as="li" delay={160} className="rounded-[1.75rem] bg-white p-6 shadow-[0_18px_40px_-28px_rgb(24_18_63/0.35)] sm:p-7">
            <div aria-hidden className="flex h-[6.5rem] items-center gap-4">
              <div className="flex gap-1">
                {[0, 1, 2].map((index) => (
                  <Star key={index} className={cn("h-10 w-10 fill-amber-400 text-amber-400", index === 1 && "-translate-y-2")} />
                ))}
              </div>
              <div className="rounded-xl bg-ink-900 px-3 py-2 text-white">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ember-300">Level up</p>
                <p className="text-sm font-bold">A2 Elementary</p>
              </div>
            </div>
            <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-ink-950">Stars and levels</h3>
            <p className="mt-2 text-ink-600">Earn up to three stars per unit. Pass every unit in a level and you move up.</p>
          </Reveal>
        </ul>
      </div>
    </section>
  );
}
