"use client";

import { useEffect, useRef, useState } from "react";
import { getSupportedLanguageName } from "@/lib/language-config";
import type { TypeStep } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";
import { targetLang } from "../target-text";
import { PromptHeader } from "./prompt-header";
import type { ExerciseProps } from "./types";

const SPECIAL_CHARACTERS: Record<string, string[]> = {
  de: ["ä", "ö", "ü", "ß"],
  "pt-BR": ["á", "â", "ã", "à", "ç", "é", "ê", "í", "ó", "ô", "õ", "ú"],
  no: ["æ", "ø", "å"],
};

/** Typed recall from English. Grading forgives case, punctuation and accents (with a gentle note). */
export function TypeExercise({ step, language, revealed, retry, onDraft }: ExerciseProps<TypeStep>) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const languageName = getSupportedLanguageName(language).replace(/ \(.*\)$/, "");
  const specials = SPECIAL_CHARACTERS[language] ?? [];

  useEffect(() => {
    setValue("");
    inputRef.current?.focus({ preventScroll: true });
  }, [step.id, retry]);

  const update = (next: string) => {
    setValue(next);
    onDraft(next.trim() ? { type: "type", text: next } : null);
  };

  const insert = (character: string) => {
    const input = inputRef.current;
    if (!input) return update(value + character);
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    update(value.slice(0, start) + character + value.slice(end));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + character.length, start + character.length);
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PromptHeader>Type this in {languageName}</PromptHeader>
      <p className="py-2 text-center text-3xl font-extrabold">“{step.prompt}”</p>

      <div className="space-y-3">
        <label htmlFor={`${step.id}-input`} className="sr-only">
          Your answer in {languageName}
        </label>
        <input
          ref={inputRef}
          id={`${step.id}-input`}
          lang={targetLang(language)}
          value={value}
          onChange={(event) => update(event.target.value)}
          disabled={Boolean(revealed)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder={`Type in ${languageName}…`}
          className={cn(
            "h-16 w-full rounded-2xl border-2 bg-white px-4 text-2xl font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4",
            revealed
              ? revealed.correct
                ? "border-emerald-400 ring-4 ring-emerald-300/50"
                : "border-rose-400 ring-4 ring-rose-300/50"
              : "border-white focus:border-sky-400 focus:ring-sky-300/50"
          )}
        />
        {specials.length > 0 && !revealed && (
          <div className="flex flex-wrap gap-2" aria-label="Special characters">
            {specials.map((character) => (
              <button
                key={character}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(character)}
                className="h-11 min-w-11 rounded-xl border border-white/25 bg-white/10 px-3 text-lg font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {character}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
