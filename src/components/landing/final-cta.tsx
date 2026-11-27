import { LandingCta } from "@/components/dashboard/landing-cta";
import { InkBackdrop } from "./ink-backdrop";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden px-4 py-24 text-white sm:px-6 md:py-32">
      <InkBackdrop glow className="-z-10" />
      <div className="mx-auto max-w-6xl">
        <h2
          id="cta-title"
          className="max-w-3xl text-balance font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.03em] [font-stretch:88%] sm:text-7xl"
        >
          Your first lesson is a few taps away.
        </h2>
        <p className="mt-5 max-w-xl text-lg text-white/75">Pick a language, take one short lesson, and come back tomorrow for your first review.</p>
        <LandingCta className="mt-9 sm:justify-start" />
      </div>
    </section>
  );
}
