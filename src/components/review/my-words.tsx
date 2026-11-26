"use client";

import { Loader2, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { notifyLearnSummaryChanged } from "@/hooks/use-learn-summary";
import type { VocabularyListItem, VocabularyListResponse } from "@/lib/review/types";
import type { Maturity } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { AddWordForm } from "./add-word-form";
import { deleteVocabularyWord, fetchVocabulary } from "./api";
import { MATURITY_META, WordRow } from "./word-row";

export interface MyWordsProps {
  language: string;
  /** Open the add form straight away (e.g. from the empty-deck screen). */
  startAdding?: boolean;
  onDeckChanged?: () => void;
}

const MATURITY_ORDER: Maturity[] = ["new", "learning", "young", "mature"];

export function MyWords({ language, startAdding = false, onDeckChanged }: MyWordsProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [data, setData] = useState<VocabularyListResponse | null>(null);
  const [extra, setExtra] = useState<VocabularyListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [adding, setAdding] = useState(startAdding);
  const [flash, setFlash] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => setAdding(startAdding), [startAdding]);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const next = await fetchVocabulary({ language, query: debouncedQuery, signal: controller.signal });
      if (!controller.signal.aborted) {
        setData(next);
        setExtra([]);
        setError(null);
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : "Couldn't load your words");
      }
    }
  }, [language, debouncedQuery]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const loadMore = async () => {
    if (!data) return;
    setLoadingMore(true);
    try {
      const next = await fetchVocabulary({ language, query: debouncedQuery, offset: data.items.length + extra.length });
      setExtra((current) => [...current, ...next.items]);
      setData((current) => (current ? { ...current, hasMore: next.hasMore } : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't load more words");
    } finally {
      setLoadingMore(false);
    }
  };

  const changed = () => {
    notifyLearnSummaryChanged();
    onDeckChanged?.();
    void load();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVocabularyWord(id);
      setFlash("Word removed.");
      changed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't remove this word");
    }
  };

  const handleAdded = (word: string, created: boolean) => {
    setFlash(created ? `Added "${word}". It's ready to review now.` : `"${word}" is already in your deck.`);
    changed();
  };

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(timer);
  }, [flash]);

  const counts = data?.counts;
  const items = data ? [...data.items, ...extra] : [];

  return (
    <div className="rounded-3xl bg-white p-4 shadow-xl shadow-indigo-950/10 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-slate-900">
          My words{counts ? <span className="ml-2 text-base font-bold text-slate-400">{counts.total}</span> : null}
        </h2>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          aria-expanded={adding}
          className="inline-flex h-9 items-center gap-1 rounded-xl bg-indigo-50 px-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
        >
          {adding ? <X aria-hidden className="h-4 w-4" /> : <Plus aria-hidden className="h-4 w-4" />}
          {adding ? "Close" : "Add word"}
        </button>
      </div>

      {counts && (
        <dl className="mt-3 grid grid-cols-4 gap-2">
          {MATURITY_ORDER.map((maturity) => (
            <div key={maturity} className={cn("rounded-xl px-1 py-2 text-center", MATURITY_META[maturity].className)}>
              <dt className="text-[11px] font-bold uppercase tracking-wide">{MATURITY_META[maturity].label}</dt>
              <dd className="text-lg font-extrabold tabular-nums">{counts[maturity]}</dd>
            </div>
          ))}
        </dl>
      )}

      {adding && (
        <div className="mt-4">
          <AddWordForm language={language} onAdded={handleAdded} autoFocus />
        </div>
      )}

      {flash && (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {flash}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {(counts?.total ?? 0) > 0 && (
        <label className="relative mt-4 block">
          <span className="sr-only">Search your words</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search words or meanings"
            className="h-11 w-full rounded-xl border-2 border-slate-200 pl-9 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
        </label>
      )}

      {!debouncedQuery && data && data.weakest.length > 0 && (
        <section className="mt-4" aria-labelledby="weakest-words">
          <h3 id="weakest-words" className="text-xs font-bold uppercase tracking-wide text-rose-600">
            Needs practice
          </h3>
          <ul className="divide-y divide-slate-100">
            {data.weakest.map((item) => (
              <WordRow key={`weak-${item.id}`} item={item} language={language} onDelete={handleDelete} />
            ))}
          </ul>
        </section>
      )}

      {data ? (
        <section className="mt-4" aria-labelledby="all-words">
          <h3 id="all-words" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {debouncedQuery ? `Matches for "${debouncedQuery}"` : "Recently added"}
          </h3>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {debouncedQuery ? "No words match that search." : "No words yet. Add one above, or finish a lesson."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <WordRow key={item.id} item={item} language={language} onDelete={handleDelete} />
              ))}
            </ul>
          )}
          {data.hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {loadingMore && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
              Show more
            </button>
          )}
        </section>
      ) : (
        !error && <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
      )}
    </div>
  );
}
