import Link from "next/link";
import { ArrowRight, MessageCircle, Mic, Plane, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";

interface Mode {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}

/** Free practice outside the path: tutor chat, live voice, travel interpreter. */
export function PracticePanel({ language, className }: { language: string; className?: string }) {
  const lang = encodeURIComponent(language);
  const modes: Mode[] = [
    {
      href: `/learn/${lang}`,
      title: "Chat tutor",
      description: "Knows your level, corrects you gently, remembers what you're working on.",
      icon: MessageCircle,
      tone: "bg-ink-900 text-ink-100",
    },
    {
      href: `/learn/conversation?lang=${lang}`,
      title: "Voice conversation",
      description: "Speak out loud in a live, real-time conversation.",
      icon: Mic,
      tone: "bg-ember-400 text-ink-950",
    },
    {
      href: `/travel?lang=${lang}`,
      title: "Travel interpreter",
      description: "Hear what's said around you and get replies you can say back.",
      icon: Plane,
      tone: "bg-sky-200 text-sky-900",
    },
  ];

  return (
    <Panel labelledBy="practice-title" className={cn("p-3 sm:p-3", className)}>
      <h2 id="practice-title" className="px-3 pb-1 pt-2 font-display text-xl font-bold tracking-tight text-ink-950">
        Practise your way
      </h2>
      <ul className="divide-y divide-ink-900/[0.06]">
        {modes.map((mode) => (
          <li key={mode.title}>
            <Link
              href={mode.href}
              className="group flex items-center gap-4 rounded-2xl px-3 py-3.5 transition hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
            >
              <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem]", mode.tone)}>
                <mode.icon aria-hidden className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-950">{mode.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-600">{mode.description}</span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-700" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
