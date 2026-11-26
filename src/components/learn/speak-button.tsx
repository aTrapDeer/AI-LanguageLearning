"use client";

import { Volume2 } from "lucide-react";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

export interface SpeakButtonProps {
  /** Text to read, in the target language. */
  text: string;
  /** Language code from language-config, e.g. "de". */
  language: string;
  /** Speech rate, default 0.9. */
  rate?: number;
  label?: string;
  surface?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
}

/** Reads text aloud with a device voice. Renders nothing when no voice for the language exists. */
export function SpeakButton({ text, language, rate, label, surface = "light", size = "md", className }: SpeakButtonProps) {
  const { supported, speaking, speak, cancel } = useSpeech(language);

  if (!supported || !text.trim()) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => (speaking ? cancel() : speak(text, { rate }))}
      aria-label={label ?? `Listen: ${text}`}
      aria-pressed={speaking}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2",
        size === "sm" ? "h-8 w-8" : "h-11 w-11",
        surface === "dark"
          ? "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/70"
          : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 focus-visible:ring-indigo-300",
        speaking && "motion-safe:animate-pulse",
        className
      )}
    >
      <Volume2 aria-hidden className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </button>
  );
}
