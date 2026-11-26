"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BrandBackground } from "@/components/learn";
import { useLearnSummary } from "@/hooks/use-learn-summary";
import { getSupportedLanguageName } from "@/lib/language-config";
import type { PathResponse, PathUnit } from "@/lib/lesson/api-types";
import { PathHeader } from "./path-header";
import { UnitNode } from "./unit-node";
import { UnitPanel } from "./unit-panel";

const OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56];

function usePath(language: string, level: number | null) {
  const [path, setPath] = useState<PathResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (level === null) return;
    const controller = new AbortController();
    setError(null);
    fetch(`/api/lessons/path?${new URLSearchParams({ language, level: String(level) })}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Couldn't load your path.");
        setPath((await response.json()) as PathResponse);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Couldn't load your path.");
      });
    return () => controller.abort();
  }, [language, level]);

  return { path: path && path.level === level && path.language === language ? path : null, error };
}

/** The current unit: an unfinished one, else the first unlocked unit not yet passed. */
function pickCurrent(units: PathUnit[]): PathUnit | null {
  return (
    units.find((unit) => unit.unlocked && unit.inProgress !== null) ??
    units.find((unit) => unit.unlocked && !unit.completed) ??
    null
  );
}

export function PathView({ language, notice }: { language: string; notice?: string | null }) {
  const { summary, loading, error: summaryError } = useLearnSummary(language);
  const [viewLevel, setViewLevel] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (summary && viewLevel === null) setViewLevel(summary.level);
  }, [summary, viewLevel]);

  const { path, error: pathError } = usePath(language, viewLevel);
  const units = useMemo(() => path?.units ?? [], [path]);
  const current = useMemo(() => pickCurrent(units), [units]);
  const selected = units.find((unit) => unit.id === selectedId) ?? current ?? units[units.length - 1] ?? null;

  useEffect(() => setSelectedId(null), [viewLevel]);

  const languageName = getSupportedLanguageName(language);
  const setupHref = `/account-setup?${new URLSearchParams({ mode: "add-language", lang: language, redirect: `/learn/journey?lang=${language}` })}`;

  let body: ReactNode;
  if (summary && !summary.hasProgress) {
    body = (
      <div className="mt-10 rounded-3xl bg-white p-6 text-center text-slate-900 shadow-xl">
        <div aria-hidden className="text-5xl">
          🌍
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">Start learning {languageName}</h1>
        <p className="mt-2 text-slate-600">Add {languageName} to your account and we&apos;ll set up your path at the right level.</p>
        <Link href={setupHref} className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 font-bold text-white">
          Add {languageName}
        </Link>
      </div>
    );
  } else if (summaryError || pathError) {
    body = (
      <div className="mt-10 rounded-3xl bg-white p-6 text-center text-slate-900 shadow-xl" role="alert">
        <p className="font-bold">{summaryError ?? pathError}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 h-11 rounded-xl bg-indigo-600 px-5 font-bold text-white">
          Reload
        </button>
      </div>
    );
  } else if (loading || !summary || !path || viewLevel === null) {
    body = (
      <div className="space-y-4" aria-busy="true" aria-label="Loading your path">
        <div className="h-40 rounded-3xl bg-white/10 motion-safe:animate-pulse" />
        {OFFSETS.slice(0, 6).map((offset, index) => (
          <div key={index} className="flex justify-center" style={{ transform: `translateX(${offset}px)` }}>
            <div className="h-[76px] w-[76px] rounded-full bg-white/10 motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    );
  } else {
    const index = selected ? units.findIndex((unit) => unit.id === selected.id) : -1;
    body = (
      <>
        <PathHeader
          language={language}
          summary={summary}
          viewLevel={viewLevel}
          completedInView={units.filter((unit) => unit.completed).length}
          totalInView={units.length}
          onLevelChange={setViewLevel}
        />
        {notice && (
          <p role="status" className="mt-3 rounded-2xl bg-amber-300/20 px-4 py-2 text-center text-sm font-semibold text-amber-100">
            {notice}
          </p>
        )}
        <ol className="relative mx-auto mt-8 flex max-w-xs flex-col items-center gap-6 pb-4" aria-label={`Level ${viewLevel} units`}>
          {units.map((unit, unitIndex) => (
            <li key={unit.id}>
              <UnitNode
                unit={unit}
                offset={OFFSETS[unitIndex % OFFSETS.length]}
                isCurrent={current?.id === unit.id}
                isSelected={selected?.id === unit.id}
                onSelect={() => setSelectedId(unit.id)}
              />
            </li>
          ))}
        </ol>
        {selected && (
          <div className="sticky bottom-0 z-10 -mx-4 mt-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <UnitPanel unit={selected} language={language} learnerLevel={path.learnerLevel} previousTitle={index > 0 ? units[index - 1].title : null} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative isolate min-h-full text-white">
      <BrandBackground className="-z-10 fixed" />
      <div className="mx-auto w-full max-w-md px-4 pb-2 pt-4 sm:pt-8">{body}</div>
    </div>
  );
}
