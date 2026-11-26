import Link from "next/link";
import { Check, Languages, MessagesSquare } from "lucide-react";
import { LessonShell } from "@/components/learn";
import type { LanguageConfig } from "@/lib/language-config";
import type { VoiceMode } from "@/lib/tutor/voice-prompt";

const MODES: Array<{ id: VoiceMode; title: string; description: string; features: string[]; icon: typeof Languages; tone: string }> = [
  {
    id: "native",
    title: "Native mode",
    description: "Full immersion: your tutor speaks only the target language.",
    features: ["Stays in the target language", "Rephrases simply when you're stuck", "Corrects by saying it right"],
    icon: Languages,
    tone: "from-sky-400 to-indigo-500",
  },
  {
    id: "assisted",
    title: "Assisted mode",
    description: "The target language with English support when you need it.",
    features: ["English meanings for new phrases", "Short explanations of mistakes", "Ask for help in English anytime"],
    icon: MessagesSquare,
    tone: "from-emerald-400 to-teal-500",
  },
];

/** Choose how the spoken conversation should go. Both modes adapt to the learner's level. */
export function VoiceModePicker({ language, unitId }: { language: LanguageConfig; unitId: string | null }) {
  const hrefFor = (mode: VoiceMode) => {
    const params = new URLSearchParams({ lang: language.code, mode });
    if (unitId) params.set("unit", unitId);
    return `/learn/conversation/session?${params.toString()}`;
  };

  return (
    <LessonShell exitHref="/dashboard" exitLabel="Back to dashboard" topBarCenter={<p className="truncate font-bold">{language.flag} Speak {language.name}</p>}>
      <div className="flex flex-col gap-5 pb-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">Have a real conversation</h1>
          <p className="mt-1 text-sm text-indigo-100/80">
            Talk out loud with your tutor. It knows your level, your current unit and the words you&apos;re learning.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.map((mode) => (
            <Link
              key={mode.id}
              href={hrefFor(mode.id)}
              scroll={false}
              className="group flex flex-col rounded-3xl bg-white p-5 text-slate-900 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
            >
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${mode.tone} text-white`}>
                <mode.icon aria-hidden className="h-6 w-6" />
              </span>
              <span className="mt-3 text-lg font-extrabold">{mode.title}</span>
              <span className="mt-1 text-sm text-slate-600">{mode.description}</span>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                {mode.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <span className={`mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r ${mode.tone} font-bold text-white`}>
                Start {mode.title.toLowerCase()}
              </span>
            </Link>
          ))}
        </div>

        <p className="text-center text-sm text-indigo-100/80">
          Prefer typing?{" "}
          <Link href={`/learn/${language.code}`} className="font-semibold text-white underline-offset-2 hover:underline">
            Chat with your tutor
          </Link>
        </p>
      </div>
    </LessonShell>
  );
}
