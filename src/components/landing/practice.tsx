import { MessageCircle, Mic, Plane } from "lucide-react";
import { InkBackdrop } from "./ink-backdrop";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { TravelInterpreter } from "./vignettes/travel-interpreter";
import { TutorChat } from "./vignettes/tutor-chat";
import { VoiceLive } from "./vignettes/voice-live";

export function Practice() {
  return (
    <section aria-labelledby="practice-title" className="bg-paper px-4 py-20 sm:px-6 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="practice-title"
          eyebrow="Beyond the lessons"
          title="Then use it for real."
          lede="Practise with someone who never runs out of patience — in writing, out loud, or when you're standing on a platform abroad."
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-[1.15fr_1fr] lg:grid-rows-2">
          <Reveal className="relative isolate overflow-hidden rounded-[1.75rem] p-6 text-white sm:p-8 lg:row-span-2">
            <InkBackdrop className="-z-10" />
            <MessageCircle aria-hidden className="h-6 w-6 text-ember-300" />
            <h3 className="mt-4 font-display text-3xl font-bold tracking-tight">A tutor that remembers</h3>
            <p className="mt-2 max-w-md text-white/75">
              Chat with a tutor that knows your level, corrects you gently and keeps track of what you&apos;re working on.
            </p>
            <TutorChat className="mt-8" />
          </Reveal>
          <Reveal delay={80} className="rounded-[1.75rem] bg-gradient-to-br from-ember-300 to-ember-500 p-6 text-ink-950 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[1fr_1.1fr] sm:items-center">
              <div>
                <Mic aria-hidden className="h-6 w-6" />
                <h3 className="mt-4 font-display text-3xl font-bold tracking-tight">Live voice practice</h3>
                <p className="mt-2 text-ink-900/80">Speak out loud in a real-time conversation and get comfortable before it counts.</p>
              </div>
              <VoiceLive />
            </div>
          </Reveal>
          <Reveal delay={160} className="rounded-[1.75rem] bg-sky-100 p-6 text-ink-950 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[1fr_1.1fr] sm:items-center">
              <div>
                <Plane aria-hidden className="h-6 w-6 text-sky-800" />
                <h3 className="mt-4 font-display text-3xl font-bold tracking-tight">Travel interpreter</h3>
                <p className="mt-2 text-ink-700">Hold to talk, hear what someone said in English, and get a few replies you can say back.</p>
              </div>
              <TravelInterpreter />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
