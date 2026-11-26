"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LearnerSummary } from "@/lib/db/summary";
import { getLocalDateString } from "@/lib/local-date";

export type { LearnerSummary } from "@/lib/db/summary";

const SUMMARY_CHANGED_EVENT = "laingfy:learn-summary-changed";

/**
 * Tell every mounted `useLearnSummary` to refetch (e.g. after a lesson or review session saves XP),
 * so the header, dashboard and summary screens stay in sync without prop drilling.
 */
export function notifyLearnSummaryChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SUMMARY_CHANGED_EVENT));
  }
}

export async function fetchLearnSummary(language?: string | null, signal?: AbortSignal): Promise<LearnerSummary> {
  const params = new URLSearchParams({ localDate: getLocalDateString() });
  if (language) {
    params.set("language", language);
  }

  const response = await fetch(`/api/learn/summary?${params.toString()}`, { signal, cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to load progress (${response.status})`);
  }

  return (await response.json()) as LearnerSummary;
}

export interface UseLearnSummaryOptions {
  /** Set false to wait (e.g. until the language is known). Default true. */
  enabled?: boolean;
  /** Refetch when the tab regains focus (useful for the header/dashboard). Default false. */
  refreshOnFocus?: boolean;
}

export interface UseLearnSummaryResult {
  summary: LearnerSummary | null;
  /** True during the first load for the current user/language (not during background refreshes). */
  loading: boolean;
  error: string | null;
  refresh: () => Promise<LearnerSummary | null>;
  /** Local optimistic update; the next refresh replaces it with server data. */
  setSummary: (updater: (current: LearnerSummary | null) => LearnerSummary | null) => void;
}

/**
 * Learner summary for the signed-in user. `language` omitted/null → the account's active language.
 * Keyed on user id + language, so NextAuth's refetch-on-focus does not trigger reloads.
 */
export function useLearnSummary(language?: string | null, options: UseLearnSummaryOptions = {}): UseLearnSummaryResult {
  const { enabled = true, refreshOnFocus = false } = options;
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const key = userId && enabled ? `${userId}|${language ?? ""}` : null;

  const [summary, setSummaryState] = useState<LearnerSummary | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (): Promise<LearnerSummary | null> => {
    if (!key) {
      return null;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const next = await fetchLearnSummary(language, controller.signal);
      if (!controller.signal.aborted) {
        setSummaryState(next);
        setError(null);
        setLoadedKey(key);
      }
      return next;
    } catch (caught) {
      if (controller.signal.aborted) {
        return null;
      }

      setError(caught instanceof Error ? caught.message : "Failed to load progress");
      setLoadedKey(key);
      return null;
    }
  }, [key, language]);

  useEffect(() => {
    if (!key) {
      return;
    }

    void load();
    return () => controllerRef.current?.abort();
  }, [key, load]);

  useEffect(() => {
    if (!key) {
      return;
    }

    const onChange = () => void load();
    window.addEventListener(SUMMARY_CHANGED_EVENT, onChange);
    if (refreshOnFocus) {
      window.addEventListener("focus", onChange);
    }

    return () => {
      window.removeEventListener(SUMMARY_CHANGED_EVENT, onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [key, load, refreshOnFocus]);

  const setSummary = useCallback((updater: (current: LearnerSummary | null) => LearnerSummary | null) => {
    setSummaryState((current) => updater(current));
  }, []);

  const isCurrent = key !== null && loadedKey === key;

  return {
    summary: isCurrent ? summary : null,
    loading: status === "loading" || (key !== null && !isCurrent),
    error: isCurrent ? error : null,
    refresh: load,
    setSummary,
  };
}
