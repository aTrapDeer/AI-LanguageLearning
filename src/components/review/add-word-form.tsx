"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { getLanguageConfig } from "@/lib/language-config";
import { addVocabularyWord } from "./api";

export interface AddWordFormProps {
  language: string;
  onAdded: (word: string, created: boolean) => void;
  autoFocus?: boolean;
}

const inputClass =
  "h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none";

export function AddWordForm({ language, onAdded, autoFocus = false }: AddWordFormProps) {
  const config = getLanguageConfig(language);
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [romanization, setRomanization] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!word.trim() || !translation.trim()) {
      setError(!word.trim() ? "Enter the word first." : "Add what it means in English.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await addVocabularyWord({
        language,
        word: word.trim(),
        translation: translation.trim(),
        romanization: config?.needsRomanization ? romanization.trim() || null : null,
      });
      onAdded(result.item.word, result.created);
      setWord("");
      setTranslation("");
      setRomanization("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save this word");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-2xl bg-slate-50 p-3" aria-label="Add a word">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          {config?.name ?? "Word"}
          <input
            value={word}
            onChange={(event) => setWord(event.target.value)}
            maxLength={80}
            required
            autoFocus={autoFocus}
            lang={config?.speechLocale}
            dir={config?.rtl ? "rtl" : "ltr"}
            placeholder={config?.nativeName ? `Word in ${config.nativeName}` : "Word"}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Meaning (English)
          <input
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
            maxLength={160}
            required
            placeholder="e.g. house"
            className={inputClass}
          />
        </label>
      </div>
      {config?.needsRomanization && (
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          {config.romanizationName} (optional)
          <input
            value={romanization}
            onChange={(event) => setRomanization(event.target.value)}
            maxLength={120}
            placeholder="How it's read"
            className={inputClass}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-70"
      >
        {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Plus aria-hidden className="h-4 w-4" />}
        Add to my deck
      </button>
    </form>
  );
}
