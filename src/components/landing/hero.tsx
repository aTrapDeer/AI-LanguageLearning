import { Target } from "lucide-react";
import { LandingCta } from "@/components/dashboard/landing-cta";
import { SUPPORTED_LANGUAGES } from "@/lib/language-config";
import { cn } from "@/lib/utils";
import { InkBackdrop } from "./ink-backdrop";
import { LessonStepDemo } from "./vignettes/lesson-step-demo";
import { TutorCorrection } from "./vignettes/tutor-correction";

const FACTS = [
  { value: "A1–C2", label: "10 levels" },
  { value: "60", label: "units" },
  { value: "6", label: "languages" },
];

/** A hand-drawn ember stroke under the key word of the headline. */
function Underline() {
  return (
    <svg aria-hidden viewBox="0 0 300 24" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-[0.32em] w-full text-ember-400">
      <path d="M3 17C60 7 140 4 297 9" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

/** True numbers about the course itself — never about users. */
function Facts({ className }: { className?: string }) {
  return (
    <dl className={cn("divide-x divide-white/15", className)}>
      {FACTS.map((fact) => (
        <div key={fact.label} className="flex-1 px-4 first:pl-0">
          <dt className="sr-only">{fact.label}</dt>
          <dd>
            <span className="block font-display text-3xl font-extrabold tracking-tight">{fact.value}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">{fact.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden pt-14 text-white md:pt-16">
      <InkBackdrop glow className="-z-10" />
      <div className="mx-auto grid max-w-6xl gap-14 px-4 pb-24 pt-8 sm:px-6 md:pb-28 md:pt-16 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-10">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase leading-relaxed tracking-[0.18em] text-ember-300 motion-safe:animate-rise sm:text-xs">
            {SUPPORTED_LANGUAGES.map((lang) => lang.name.replace(" (Brazilian)", "")).join(" · ")}
          </p>
          <h1
            id="hero-title"
            className="mt-5 text-balance font-display text-[3.2rem] font-extrabold leading-[0.92] tracking-[-0.035em] [font-stretch:88%] motion-safe:animate-rise motion-safe:[animation-delay:80ms] sm:text-7xl lg:text-[5.4rem]"
          >
            Learn a language that actually{" "}
            <span className="relative inline-block whitespace-nowrap">
              sticks.
              <Underline />
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-white/80 motion-safe:animate-rise motion-safe:[animation-delay:160ms] sm:text-xl">
            A clear path from your first hello to real conversations. Short lessons that teach, test and bring your mistakes back,
            reviews timed to your memory, and a tutor you can talk to out loud.
          </p>
          <LandingCta className="mt-8 motion-safe:animate-rise motion-safe:[animation-delay:240ms] sm:justify-start" />
          <Facts className="mt-10 hidden max-w-md motion-safe:animate-rise motion-safe:[animation-delay:320ms] sm:flex" />
        </div>

        <div className="relative mx-auto w-full max-w-[22.5rem] motion-safe:animate-rise motion-safe:[animation-delay:200ms] lg:mr-0">
          <LessonStepDemo className="h-[29rem] rotate-[1.5deg]" />
          <TutorCorrection className="absolute -bottom-24 -left-20 hidden w-[16.5rem] -rotate-2 sm:block" />
          <div aria-hidden className="absolute -top-5 right-1 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-ink-950 shadow-xl sm:-right-10">
            <Target className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-bold">Daily goal 30/30 XP</span>
          </div>
        </div>

        <Facts className="mt-6 flex sm:hidden" />
      </div>
    </section>
  );
}
