import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { MistakeReturns } from "./vignettes/mistake-returns";
import { PathStops } from "./vignettes/path-stops";
import { ReviewCardVignette } from "./vignettes/review-card";
import { ExerciseKinds, WordIntro } from "./vignettes/word-intro";

interface Step {
  title: string;
  body: ReactNode;
  visual: ReactNode;
  extra?: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Start at your level",
    body: "Ten levels mapped to the CEFR scale, A1 to C2: sixty units, each built around one thing you'll be able to do — like ordering a drink and a snack. Begin at A1 or jump ahead.",
    visual: <PathStops className="w-full max-w-[20rem]" />,
  },
  {
    title: "Learn it, then prove it",
    body: "Every lesson introduces a few new words — with a picture, audio and an example — and then tests you on them straight away.",
    visual: <WordIntro className="w-full max-w-[20rem]" />,
    extra: <ExerciseKinds className="mt-5" />,
  },
  {
    title: "Your mistakes come back",
    body: "Miss something and it returns later in the lesson, then again in your next lessons, until you get it right.",
    visual: <MistakeReturns className="w-full max-w-[20rem]" />,
  },
  {
    title: "Review right before you'd forget",
    body: "Every word you learn joins your own deck. Spaced repetition brings each one back at the right moment; you say how well you knew it and the next gap adapts.",
    visual: <ReviewCardVignette className="w-full max-w-[20rem] -rotate-1" />,
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="relative overflow-hidden bg-paper px-4 py-20 sm:px-6 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="A system, not a word list."
          lede="Laingfy keeps track of what you know, what you're learning and what keeps tripping you up — and plans your next step around it."
        />

        <ol className="relative mt-14 md:mt-20">
          {/* The thread that ties the steps together, like the path itself. */}
          <span aria-hidden className="absolute bottom-8 left-[1.375rem] top-2 w-px bg-gradient-to-b from-ember-400 via-ink-300 to-transparent lg:left-1/2" />
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} className="relative grid gap-8 pb-16 pl-16 last:pb-0 lg:grid-cols-2 lg:gap-24 lg:pb-20 lg:pl-0">
              <span
                aria-hidden
                className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-ink-900/10 bg-white font-mono text-sm font-semibold text-ink-900 shadow-sm lg:left-1/2 lg:-translate-x-1/2"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className={cn("lg:sticky lg:top-28 lg:self-start lg:pt-1", index % 2 === 1 ? "lg:order-2 lg:pl-4" : "lg:pr-4 lg:text-right")}>
                <h3 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-ink-950 sm:text-4xl">{step.title}</h3>
                <p className="mt-3 text-pretty text-lg leading-relaxed text-ink-600">{step.body}</p>
                {step.extra && <div className={cn(index % 2 === 0 && "lg:flex lg:justify-end")}>{step.extra}</div>}
              </div>
              <div className={cn("flex", index % 2 === 1 ? "lg:order-1 lg:justify-end lg:pr-4" : "lg:pl-4")}>
                <div className="relative isolate w-full max-w-[20rem]">
                  <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-dots" />
                  {step.visual}
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
