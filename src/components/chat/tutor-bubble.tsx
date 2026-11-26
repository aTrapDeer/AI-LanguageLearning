"use client";

import { Eye, EyeOff, Loader2, Square, Volume2 } from "lucide-react";
import { useState } from "react";
import type { LanguageConfig } from "@/lib/language-config";
import type { TutorReply, TutorVocabulary } from "@/lib/tutor/schema";
import { cn } from "@/lib/utils";
import { VocabChip, type SaveState } from "./vocab-chip";

interface TutorBubbleProps {
  text: string;
  payload: TutorReply | null;
  language: LanguageConfig;
  showTranslation: boolean;
  showRomanization: boolean;
  audio: { playing: boolean; loading: boolean; onToggle: () => void };
  getSaveState: (item: TutorVocabulary) => SaveState;
  onSaveWord: (item: TutorVocabulary) => void;
}

/** A tutor message: target-language text first; translation and romanization a tap away. */
export function TutorBubble({
  text,
  payload,
  language,
  showTranslation,
  showRomanization,
  audio,
  getSaveState,
  onSaveWord,
}: TutorBubbleProps) {
  const [revealed, setRevealed] = useState(false);
  const romanization = payload?.romanization ?? null;
  const translation = payload?.translation ?? null;
  const hasHidden = Boolean(translation || romanization);
  const translationVisible = Boolean(translation) && (revealed || showTranslation);
  const romanizationVisible = Boolean(romanization) && (revealed || showRomanization);
  const prefsShowAll = (!translation || showTranslation) && (!romanization || showRomanization);

  return (
    <div className="flex w-full max-w-[92%] flex-col gap-1.5 sm:max-w-[80%]">
      <div className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-slate-900 shadow-md">
        <p
          lang={language.speechLocale}
          dir={language.rtl ? "rtl" : "ltr"}
          className={cn("whitespace-pre-wrap break-words text-[17px] leading-relaxed", language.rtl && "text-right text-[19px]")}
        >
          {text}
        </p>

        {romanizationVisible && <p className="mt-1 text-sm italic leading-snug text-slate-500">{romanization}</p>}
        {translationVisible && (
          <p dir="ltr" className="mt-2 border-t border-slate-100 pt-2 text-sm leading-snug text-slate-600">
            {translation}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={audio.onToggle}
            aria-label={audio.playing ? "Stop audio" : "Listen"}
            aria-pressed={audio.playing}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            {audio.loading ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : audio.playing ? (
              <Square aria-hidden className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Volume2 aria-hidden className="h-4 w-4" />
            )}
            {audio.playing ? "Stop" : "Listen"}
          </button>
          {hasHidden && !prefsShowAll && (
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-expanded={revealed}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {revealed ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
              {revealed ? "Hide" : romanization && !showRomanization ? "Reading & meaning" : "Translate"}
            </button>
          )}
        </div>
      </div>

      {payload?.tip && (
        <p className="rounded-xl bg-white/10 px-3 py-2 text-[13px] leading-snug text-indigo-50">
          <span className="font-semibold text-amber-200">Tip: </span>
          {payload.tip}
        </p>
      )}

      {payload && payload.vocabulary.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Words from this message">
          {payload.vocabulary.map((item) => (
            <VocabChip
              key={item.word}
              item={item}
              rtl={language.rtl}
              state={getSaveState(item)}
              onSave={() => onSaveWord(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
