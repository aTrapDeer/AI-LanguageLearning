"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { getLanguageConfig } from "@/lib/language-config";
import { formatDueIn } from "@/lib/review/intervals";
import type { VocabularyListItem } from "@/lib/review/types";
import type { Maturity } from "@/lib/srs";
import { cn } from "@/lib/utils";

export const MATURITY_META: Record<Maturity, { label: string; className: string }> = {
  new: { label: "New", className: "bg-amber-100 text-amber-800" },
  learning: { label: "Learning", className: "bg-rose-100 text-rose-700" },
  young: { label: "Young", className: "bg-sky-100 text-sky-700" },
  mature: { label: "Mature", className: "bg-emerald-100 text-emerald-700" },
};

export interface WordRowProps {
  item: VocabularyListItem;
  language: string;
  onDelete: (id: string) => Promise<void>;
}

export function WordRow({ item, language, onDelete }: WordRowProps) {
  const config = getLanguageConfig(language);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const meta = MATURITY_META[item.maturity];
  const due = formatDueIn(item.nextReview, new Date());

  const remove = async () => {
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span lang={config?.speechLocale} dir={config?.rtl ? "rtl" : "ltr"} className="break-words text-base font-bold text-slate-900">
            {item.word}
          </span>
          {item.romanization && <span className="text-sm text-slate-500">{item.romanization}</span>}
        </div>
        <p className="truncate text-sm text-slate-600">{item.translation}</p>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-rose-600 px-3 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-70"
          >
            {deleting && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
            Remove
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-9 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Keep
          </button>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", meta.className)}>{meta.label}</span>
            {due && <span className="text-[11px] text-slate-400">{due === "now" ? "due now" : due}</span>}
          </div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${item.word}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        </>
      )}
    </li>
  );
}
