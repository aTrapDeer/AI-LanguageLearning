"use client";

import { useEffect, useMemo, useState } from "react";
import { createRng, seedFromString, shuffle } from "@/lib/lesson/rng";
import type { ChoiceOption, GradeResult } from "@/lib/lesson/types";
import { cn } from "@/lib/utils";
import { useNumberKeys } from "../hooks";
import { OptionButton, type OptionState } from "../option-button";
import { TargetText } from "../target-text";

export interface OptionListProps {
  stepId: string;
  options: ChoiceOption[];
  answerId: string;
  language: string;
  showRomanization: boolean;
  revealed: GradeResult | null;
  retry: number;
  onSelect: (optionId: string | null) => void;
  layout?: "list" | "grid";
}

/** Multiple-choice options with 1–4 hotkeys; reshuffled on a retry so position can't be memorised. */
export function OptionList({ stepId, options, answerId, language, showRomanization, revealed, retry, onSelect, layout = "list" }: OptionListProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const ordered = useMemo(
    () => (retry > 0 ? shuffle(options, createRng(seedFromString(`${stepId}:${retry}`))) : options),
    [options, retry, stepId]
  );

  useEffect(() => {
    setSelected(null);
  }, [stepId, retry]);

  const choose = (id: string) => {
    if (revealed) return;
    setSelected(id);
    onSelect(id);
  };

  useNumberKeys(ordered.length, (index) => choose(ordered[index].id), !revealed);

  const stateFor = (option: ChoiceOption): OptionState => {
    if (!revealed) return option.id === selected ? "selected" : "idle";
    if (option.id === answerId) return "correct";
    if (option.id === selected) return "wrong";
    return "dimmed";
  };

  return (
    <div role="group" aria-label="Answer options" className={cn("grid gap-3", layout === "grid" ? "grid-cols-2" : "grid-cols-1")}>
      {ordered.map((option, index) => (
        <OptionButton
          key={option.id}
          state={stateFor(option)}
          onClick={() => choose(option.id)}
          disabled={Boolean(revealed)}
          hotkey={index + 1}
          layout={layout === "grid" ? "tile" : "row"}
        >
          {option.isTarget ? (
            <TargetText
              text={option.text}
              language={language}
              romanization={option.romanization}
              showRomanization={showRomanization}
              className="text-xl"
              romanizationClassName="text-xs"
            />
          ) : (
            option.text
          )}
        </OptionButton>
      ))}
    </div>
  );
}
