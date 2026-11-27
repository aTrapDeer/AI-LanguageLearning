import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InkBackdrop } from "@/components/landing/ink-backdrop";
import { getLanguageConfig } from "@/lib/language-config";

/** Shown when the selected language has no progress yet: one clear step to set it up. */
export function SetupLanguage({ language, languageName }: { language: string; languageName: string }) {
  const config = getLanguageConfig(language);

  return (
    <section aria-labelledby="setup-title" className="relative isolate mt-5 overflow-hidden rounded-[1.75rem] p-6 text-white sm:p-10">
      <InkBackdrop glow className="-z-10" />
      {config && (
        <p aria-hidden lang={config.speechLocale} dir={config.rtl ? "rtl" : "ltr"} className="font-display text-6xl font-extrabold text-white/15 sm:text-8xl">
          {config.nativeName}
        </p>
      )}
      <h2 id="setup-title" className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        Set up {languageName}
      </h2>
      <p className="mt-2 max-w-md text-white/75">Tell us roughly where you are and we&apos;ll start you at the right level. Your other languages keep their progress.</p>
      <Link
        href={`/account-setup?mode=add-language&lang=${encodeURIComponent(language)}&redirect=/dashboard`}
        className="group mt-6 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-ember-400 px-7 text-[17px] font-bold text-ink-950 transition hover:bg-ember-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
      >
        Start {languageName}
        <ArrowRight aria-hidden className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </Link>
    </section>
  );
}
