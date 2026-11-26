import Link from "next/link";
import { ArrowRight, MessageCircle, Mic, Plane } from "lucide-react";

/** Free practice outside the path: tutor chat, live voice, travel interpreter. */
export function PracticeModes({ language }: { language: string }) {
  const lang = encodeURIComponent(language);
  const modes = [
    {
      href: `/learn/${lang}`,
      title: "Chat tutor",
      description: "Text with a tutor that knows your level and remembers your mistakes.",
      icon: MessageCircle,
      tone: "bg-indigo-100 text-indigo-600",
    },
    {
      href: `/learn/conversation?lang=${lang}`,
      title: "Voice conversation",
      description: "Speak out loud in a live, real-time conversation.",
      icon: Mic,
      tone: "bg-fuchsia-100 text-fuchsia-600",
    },
    {
      href: `/travel?lang=${lang}`,
      title: "Travel interpreter",
      description: "Hear what's said around you and get replies you can say back.",
      icon: Plane,
      tone: "bg-sky-100 text-sky-600",
    },
  ];

  return (
    <section aria-labelledby="practice-title">
      <h2 id="practice-title" className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        Practice your way
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {modes.map((mode) => (
          <li key={mode.title}>
            <Link
              href={mode.href}
              className="group flex h-full items-start gap-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${mode.tone}`}>
                <mode.icon aria-hidden className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-bold text-slate-900">
                  {mode.title}
                  <ArrowRight aria-hidden className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-0.5 block text-sm text-slate-600">{mode.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
