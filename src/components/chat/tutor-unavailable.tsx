import Link from "next/link";
import { BookOpen, Layers, MoonStar } from "lucide-react";

/** Friendly state when no AI provider is configured (or it is down): point to what still works. */
export function TutorUnavailable({ language, compact = false }: { language: string; compact?: boolean }) {
  const links = (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <Link
        href={`/learn/journey?lang=${language}`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-indigo-700 shadow hover:bg-indigo-50"
      >
        <BookOpen aria-hidden className="h-4 w-4" />
        Continue your lessons
      </Link>
      <Link
        href={`/flashcards?lang=${language}`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
      >
        <Layers aria-hidden className="h-4 w-4" />
        Review your words
      </Link>
    </div>
  );

  if (compact) {
    return (
      <div role="status" className="rounded-2xl bg-white/10 p-4 text-sm text-indigo-50 ring-1 ring-white/15">
        <p className="font-semibold text-white">Your tutor is taking a break.</p>
        <p className="mt-1">You can read this conversation, but new messages can&apos;t be answered right now.</p>
        {links}
      </div>
    );
  }

  return (
    <div role="status" className="mx-auto mt-10 max-w-md rounded-3xl bg-white/10 p-6 text-center text-indigo-50 ring-1 ring-white/15">
      <MoonStar aria-hidden className="mx-auto h-10 w-10 text-amber-200" />
      <h1 className="mt-3 text-xl font-extrabold text-white">Your tutor is taking a break</h1>
      <p className="mt-2 text-sm">
        Conversation practice isn&apos;t available right now. Your lessons and review deck still work, so keep your streak going there.
      </p>
      <div className="flex justify-center">{links}</div>
    </div>
  );
}
