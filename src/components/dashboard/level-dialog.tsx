"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEVELS } from "@/lib/levels";
import { cn } from "@/lib/utils";

export interface LevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  languageName: string;
  currentLevel: number;
  onChanged: () => void;
}

/** Lets a learner move their level, with a confirmation step before anything changes. */
export function LevelDialog({ open, onOpenChange, language, languageName, currentLevel, onChanged }: LevelDialogProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setError(null);
    }
  }, [open]);

  const target = selected !== null ? LEVELS[selected - 1] : null;

  const apply = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/user/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level: target.level }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn't change your level");
      }
      onChanged();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't change your level");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-5 text-slate-900">
        <DialogHeader>
          <DialogTitle>{target ? `Move to level ${target.level}?` : `Your ${languageName} level`}</DialogTitle>
          <DialogDescription>
            {target
              ? `You'll go from level ${currentLevel} to level ${target.level} (${target.cefr} ${target.label}). Your XP, streak and saved words stay; your path will show level ${target.level}'s units.`
              : "Lessons feel too easy or too hard? Pick the level that fits. You can change it again any time."}
          </DialogDescription>
        </DialogHeader>

        {target ? (
          <div className="mt-2 grid gap-2">
            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={apply}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 font-bold text-white hover:bg-indigo-500 disabled:opacity-70"
            >
              {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
              Yes, move me to level {target.level}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              disabled={saving}
              className="h-11 rounded-2xl border-2 border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Pick a different level
            </button>
          </div>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {LEVELS.map((level) => {
              const isCurrent = level.level === currentLevel;
              return (
                <li key={level.level}>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => setSelected(level.level)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition",
                      isCurrent ? "border-indigo-500 bg-indigo-50" : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-extrabold text-white">
                      {level.cefr}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">
                        Level {level.level} · {level.label}
                        {isCurrent && <span className="ml-2 text-xs font-semibold text-indigo-600">Current</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
