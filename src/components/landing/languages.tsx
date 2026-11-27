import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "@/lib/language-config";
import { cn } from "@/lib/utils";
import { InkBackdrop } from "./ink-backdrop";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/** "Hello" in each language, with a reading aid where the script isn't Latin. */
const HELLO: Record<SupportedLanguageCode, { word: string; reading?: string; long?: boolean }> = {
  de: { word: "Hallo" },
  "pt-BR": { word: "Olá" },
  zh: { word: "你好", reading: "nǐ hǎo" },
  no: { word: "Hei" },
  ko: { word: "안녕하세요", reading: "annyeonghaseyo", long: true },
  ar: { word: "مرحبا", reading: "marḥaban" },
};

export function Languages() {
  return (
    <section aria-labelledby="languages-title" className="relative isolate overflow-hidden px-4 py-20 text-white sm:px-6 md:py-32">
      <InkBackdrop className="-z-10" />
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="languages-title"
          tone="dark"
          eyebrow="Six languages"
          title="Built for English speakers."
          lede="Instructions, hints and corrections come in English. Chinese, Korean and Arabic also show a reading aid — Pinyin, romanization or transliteration — alongside the script."
        />
        <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/10 md:grid-cols-3">
          {SUPPORTED_LANGUAGES.map((lang, index) => {
            const hello = HELLO[lang.code];
            return (
              <Reveal as="li" key={lang.code} delay={index * 60} className="flex min-h-[11rem] flex-col justify-between bg-ink-950/60 p-5 backdrop-blur-sm sm:min-h-[13rem] sm:p-7">
                <div>
                  <p
                    lang={lang.speechLocale}
                    dir={lang.rtl ? "rtl" : "ltr"}
                    className={cn(
                      "font-display font-extrabold leading-none tracking-tight text-white",
                      hello.long ? "whitespace-nowrap text-[1.6rem] sm:text-5xl" : "text-[2.6rem] sm:text-6xl",
                      lang.rtl && "text-left"
                    )}
                  >
                    {hello.word}
                  </p>
                  {hello.reading && <p className="mt-2 font-mono text-xs text-ember-300">{hello.reading}</p>}
                </div>
                <div className="mt-6">
                  <p className="flex items-center gap-2 text-[15px] font-semibold">
                    <span aria-hidden>{lang.flag}</span> {lang.name.replace(" (Brazilian)", "")}
                  </p>
                  <p className="mt-0.5 text-xs text-white/60">
                    {lang.code === "pt-BR" ? "Brazilian Portuguese" : lang.needsRomanization ? `with ${lang.romanizationName}` : lang.nativeName}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
