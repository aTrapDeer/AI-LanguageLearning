"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { useLanguage, languages } from "@/contexts/language-context";

export interface LanguageSelectProps {
  /** Show the language name next to the flag ("auto" hides it on narrow screens). */
  showName?: "auto" | "always" | "never";
  className?: string;
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
            "inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
            className
          )}
        >
          <span aria-hidden className="text-xl leading-none">
            {selectedLanguage?.flag ?? "🌐"}
          </span>
          {showName !== "never" && selectedLanguage && (
            <span className={cn(showName === "auto" && "hidden sm:inline")}>{selectedLanguage.name}</span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-5">
        <DialogHeader>
          <DialogTitle>Choose a language</DialogTitle>
          <DialogDescription>Your progress is saved separately for each language.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 pt-2">
          {languages.map((lang) => {
            const active = selectedLanguage?.code === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageSelect(lang)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-12 w-full items-center gap-3 rounded-2xl border-2 px-3 text-left font-semibold transition",
                  active ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-100 text-slate-700 hover:border-indigo-200 hover:bg-slate-50"
                )}
              >
                <span aria-hidden className="text-2xl">
                  {lang.flag}
                </span>
                <span className="flex-1">{lang.name}</span>
                {active && <Check aria-hidden className="h-4 w-4 text-indigo-600" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
