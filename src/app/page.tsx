import { BookOpenCheck, Brain, Flame, Languages, MessageCircle, Mic, Plane, RefreshCcw, Route, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { LandingCta } from "@/components/dashboard/landing-cta";
import { BrandBackground } from "@/components/learn";
import { SUPPORTED_LANGUAGES } from "@/lib/language-config";
import { LEVELS } from "@/lib/levels";

type Icon = LucideIcon;

const STEPS: Array<{ icon: Icon; title: string; body: string }> = [
  {
    icon: Route,
    title: "Follow a clear path",
    body: "Ten levels mapped to the CEFR scale, from A1 to C2. Every unit has one can-do goal, like “I can order a drink and a snack”.",
  },
  {
    icon: RefreshCcw,
    title: "Lessons that adapt",
    body: "Short lessons pitched at your level. The words and mistakes you trip over come back in later lessons until they stick.",
  },
  {
    icon: Brain,
    title: "Review at the right moment",
    body: "Every word you learn joins your deck. Spaced repetition brings it back right before you'd forget it — a few minutes a day.",
  },
];

const PRACTICE: Array<{ icon: Icon; title: string; body: string; tone: string }> = [
  {
    icon: MessageCircle,
    title: "A tutor that remembers",
    body: "Chat with a tutor that knows your level, corrects you gently and keeps track of what you're working on.",
    tone: "bg-indigo-100 text-indigo-600",
  },
  {
    icon: Mic,
    title: "Live voice practice",
    body: "Speak out loud in a real-time conversation and get comfortable before it counts.",
    tone: "bg-fuchsia-100 text-fuchsia-600",
  },
  {
    icon: Plane,
    title: "Travel interpreter",
    body: "Push to talk, hear what someone said in English, and get a few replies you can say back.",
    tone: "bg-sky-100 text-sky-600",
  },
  {
    icon: Flame,
    title: "Streaks without guilt",
    body: "Pick a daily goal from 10 to 50 XP, watch your streak grow and celebrate milestones. Miss a day? Just start again.",
    tone: "bg-orange-100 text-orange-600",
  },
];

const GRADES = [
  { label: "Again", interval: "10 min", className: "bg-rose-500" },
  { label: "Hard", interval: "2 d", className: "bg-amber-500" },
  { label: "Good", interval: "3 d", className: "bg-emerald-500" },
  { label: "Easy", interval: "4 d", className: "bg-sky-500" },
];

/** A static picture of the real review card, so visitors see what they'll actually use. */
function ReviewCardPreview() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-sm rotate-1 rounded-3xl bg-white p-5 text-center text-slate-900 shadow-2xl shadow-indigo-950/50">
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide">
        <span className="text-indigo-500">What does this mean?</span>
        <span className="rounded-full bg-sky-100 px-2 text-sky-700">Review</span>
      </div>
      <p lang="de" className="mt-5 text-4xl font-extrabold">
        der Bahnhof
      </p>
      <div className="mx-auto my-4 h-px w-16 bg-slate-200" />
      <p className="text-xl font-bold text-slate-800">train station</p>
      <p lang="de" className="mt-3 rounded-2xl bg-slate-50 p-3 text-left text-sm text-slate-700">
        Wo ist der Bahnhof?
        <span className="block text-xs text-slate-500">Where is the train station?</span>
      </p>
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {GRADES.map((grade) => (
          <div key={grade.label} className={`rounded-xl py-1.5 text-white ${grade.className}`}>
            <p className="text-sm font-extrabold">{grade.label}</p>
            <p className="text-[11px] font-semibold text-white/85">{grade.interval}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const bands = Array.from(new Set(LEVELS.map((level) => level.cefr)));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <section className="relative isolate overflow-hidden px-4 pb-16 pt-24 text-white md:pb-24 md:pt-32">
        <BrandBackground className="-z-10" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="text-center lg:text-left">
            <p className="inline-flex flex-wrap justify-center gap-x-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <span key={lang.code}>
                  <span aria-hidden>{lang.flag}</span> {lang.name.replace(" (Brazilian)", "")}
                </span>
              ))}
            </p>
            <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Learn a language that <span className="bg-gradient-to-r from-amber-300 via-pink-300 to-fuchsia-300 bg-clip-text text-transparent">actually sticks.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/85 sm:text-xl lg:mx-0">
              A clear path from your first “hello” to real conversations. Lessons that adapt to you, reviews timed to your memory, and a
              tutor you can talk to out loud.
            </p>
            <LandingCta className="mt-8 lg:justify-start" />
          </div>
          <ReviewCardPreview />
        </div>
      </section>

      <section className="px-4 py-16 md:py-24" aria-labelledby="how-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="how-title" className="text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            A system, not a random word list
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-slate-600">
            Laingfy remembers what you know, what you&apos;re learning and what keeps tripping you up — and plans your next step around it.
          </p>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                    <step.icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold uppercase tracking-wide text-indigo-500">Step {index + 1}</span>
                </div>
                <h3 className="mt-4 text-xl font-extrabold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <BookOpenCheck aria-hidden className="h-4 w-4 text-emerald-500" /> Your path
            </p>
            <ol className="mt-3 grid grid-cols-6 gap-1.5" aria-label="CEFR levels from A1 to C2">
              {bands.map((band, index) => (
                <li
                  key={band}
                  className="rounded-xl py-2 text-center text-sm font-extrabold text-white"
                  style={{ backgroundColor: `hsl(${250 - index * 22} 70% ${58 - index * 3}%)` }}
                >
                  {band}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-slate-600">
              Start where you are: begin at A1, or tell us your level and jump ahead. You move up by passing every unit in a level.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 md:py-24" aria-labelledby="practice-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="practice-title" className="text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Then use it for real
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRACTICE.map((item) => (
              <li key={item.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}>
                  <item.icon aria-hidden className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-16 md:py-24" aria-labelledby="languages-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="languages-title" className="flex items-center justify-center gap-2 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            <Languages aria-hidden className="h-7 w-7 text-indigo-500" /> Six languages, built for English speakers
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <li key={lang.code} className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <span aria-hidden className="text-4xl">
                  {lang.flag}
                </span>
                <span className="mt-2 font-bold text-slate-900">{lang.name}</span>
                <span lang={lang.speechLocale} dir={lang.rtl ? "rtl" : "ltr"} className="text-sm text-slate-500">
                  {lang.nativeName}
                </span>
                {lang.needsRomanization && <span className="mt-1 text-xs text-slate-400">with {lang.romanizationName}</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative isolate overflow-hidden px-4 py-16 text-center text-white md:py-24">
        <BrandBackground className="-z-10" />
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your first lesson is a few taps away.</h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-white/80">Pick a language, take one short lesson, and come back tomorrow for your first review.</p>
        <LandingCta className="mt-8" />
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        <Link href="/privacy" className="hover:text-slate-800">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:text-slate-800">
          Terms
        </Link>
      </footer>
    </div>
  );
}
