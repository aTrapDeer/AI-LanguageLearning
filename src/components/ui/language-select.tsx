"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { getLanguageConfig } from "@/lib/language-config";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { useLanguage, languages } from "@/contexts/language-context";

export interface LanguageSelectProps {
  /** Show the language name next to the flag ("auto" hides it on narrow screens). */
  showName?: "auto" | "always" | "never";
  className?: string;
}

/** Short English name for tight spaces ("Portuguese" rather than "Portuguese (Brazilian)"). */
function shortName(name: string) {
  return name.replace(/\s*\(.*\)$/, "");
}

export function LanguageSelect({ showName = "auto", className }: LanguageSelectProps) {
  const { selectedLanguage, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleLanguageSelect = (lang: (typeof languages)[number]) => {
    setOpen(false);
    if (lang.code !== selectedLanguage?.code) {
      setLanguage(lang);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Learning ${selectedLanguage?.name ?? "a language"}. Change language`}
          className={cn(
            "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink-900 transition hover:bg-ink-900/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500",
            className
          )}
        >
          <span aria-hidden className="text-xl leading-none">
            {selectedLanguage?.flag ?? "🌐"}
          </span>
          {showName !== "never" && selectedLanguage && (
            <span className={cn("items-center gap-1", showName === "auto" ? "hidden sm:inline-flex" : "inline-flex")}>
              {shortName(selectedLanguage.name)}
              <ChevronDown aria-hidden className="h-3.5 w-3.5 text-ink-500" />
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-[1.75rem] border-ink-900/10 bg-white p-5 text-ink-950 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-display text-2xl font-bold tracking-tight">Choose a language</DialogTitle>
          <DialogDescription className="text-ink-600">Your progress is saved separately for each language.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 pt-1">
          {languages.map((lang) => {
            const active = selectedLanguage?.code === lang.code;
            const config = getLanguageConfig(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageSelect(lang)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500",
                  active ? "border-ink-900 bg-ink-50" : "border-ink-900/[0.08] hover:border-ink-900/25 hover:bg-paper"
                )}
              >
                <span aria-hidden className="text-2xl">
                  {lang.flag}
                </span>
                <span className="min-w-0 flex-1 font-semibold">{lang.name}</span>
                {config && (
                  <span lang={config.speechLocale} dir={config.rtl ? "rtl" : "ltr"} className="text-sm text-ink-500">
                    {shortName(config.nativeName)}
                  </span>
                )}
                <Check aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-900", !active && "invisible")} />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
