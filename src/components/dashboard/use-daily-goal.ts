"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { notifyLearnSummaryChanged } from "@/hooks/use-learn-summary";
import { getLocalDateString } from "@/lib/local-date";
import type { GoalResponse } from "@/lib/review/types";

export interface UseDailyGoalResult {
  data: GoalResponse | null;
  error: string | null;
  saving: boolean;
  setGoal: (goal: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/** The learner's daily XP goal and the last 7 days of XP. */
export function useDailyGoal(): UseDailyGoalResult {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [data, setData] = useState<GoalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/user/goal?localDate=${getLocalDateString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load your goal (${response.status})`);
      setData((await response.json()) as GoalResponse);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load your goal");
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const setGoal = useCallback(async (goal: number) => {
    setSaving(true);
    try {
      const response = await fetch("/api/user/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, localDate: getLocalDateString() }),
      });
      if (!response.ok) throw new Error("Couldn't change your goal");
      setData((await response.json()) as GoalResponse);
      setError(null);
      notifyLearnSummaryChanged();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't change your goal");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { data, error, saving, setGoal, refresh };
}
