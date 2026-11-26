"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { VoiceLine } from "./use-realtime-voice";

/** Live captions of the call, newest at the bottom. */
export function VoiceTranscript({ lines, rtl, speechLocale }: { lines: VoiceLine[]; rtl: boolean; speechLocale: string }) {
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  if (lines.length === 0) {
    return <p className="text-center text-sm text-indigo-100/70">Your conversation will appear here as you talk.</p>;
  }

  return (
    <ol className="flex flex-col gap-2" aria-label="Conversation transcript">
      {lines.map((line) => (
        <li
          key={line.id}
          lang={line.role === "assistant" ? speechLocale : undefined}
          dir={line.role === "assistant" && rtl ? "rtl" : "auto"}
          className={cn(
            "w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
            line.role === "user" ? "ml-auto rounded-tr-md bg-indigo-500 text-white" : "rounded-tl-md bg-white text-slate-900",
            !line.final && "opacity-70"
          )}
        >
          {line.text || (line.role === "user" ? "…" : "")}
        </li>
      ))}
      <li ref={endRef} aria-hidden className="h-0" />
    </ol>
  );
}
