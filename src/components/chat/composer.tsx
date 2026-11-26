"use client";

import { ArrowUp, Loader2, Mic, Square, X } from "lucide-react";
import { useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { MAX_LEARNER_MESSAGE_LENGTH } from "@/lib/tutor/prompt";
import { cn } from "@/lib/utils";
import type { RecorderState } from "./use-recorder";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  recorder: { state: RecorderState; start: () => void; stop: () => void; cancel: () => void };
  inputRef?: (element: HTMLTextAreaElement | null) => void;
}

/** Text input with auto-grow, Enter to send (Shift+Enter for a new line) and a mic for speech input. */
export function Composer({ value, onChange, onSend, sending, placeholder, recorder, inputRef }: ComposerProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 48, maxHeight: 140 });
  const recording = recorder.state === "recording";
  const transcribing = recorder.state === "transcribing";
  const canSend = value.trim().length > 0 && !sending && !recording && !transcribing;

  useEffect(() => {
    adjustHeight(value === "");
  }, [adjustHeight, value]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (canSend) onSend();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <div className="relative min-w-0 flex-1">
        <label htmlFor="tutor-input" className="sr-only">
          Your message
        </label>
        <textarea
          id="tutor-input"
          ref={(element) => {
            textareaRef.current = element;
            inputRef?.(element);
          }}
          value={recording ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_LEARNER_MESSAGE_LENGTH}
          rows={1}
          dir="auto"
          placeholder={recording ? "Listening…" : transcribing ? "Transcribing…" : placeholder}
          disabled={recording || transcribing}
          className="block w-full resize-none rounded-3xl border-0 bg-white px-4 py-3 text-[16px] leading-6 text-slate-900 shadow-md placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-300/60 disabled:bg-white/90"
        />
      </div>

      {recording && (
        <button
          type="button"
          onClick={recorder.cancel}
          aria-label="Cancel recording"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      )}

      {canSend ? (
        <button
          type="submit"
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-400 text-slate-900 shadow-lg transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
        >
          <ArrowUp aria-hidden className="h-6 w-6" strokeWidth={2.5} />
        </button>
      ) : (
        <button
          type="button"
          onClick={recording ? recorder.stop : recorder.start}
          disabled={sending || transcribing}
          aria-label={recording ? "Stop recording" : "Speak your message"}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60",
            recording
              ? "bg-rose-500 text-white ring-4 ring-rose-300/50 motion-safe:animate-pulse focus-visible:ring-rose-200"
              : "bg-white text-indigo-600 hover:bg-indigo-50 focus-visible:ring-indigo-300"
          )}
        >
          {transcribing || sending ? (
            <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
          ) : recording ? (
            <Square aria-hidden className="h-5 w-5 fill-current" />
          ) : (
            <Mic aria-hidden className="h-5 w-5" />
          )}
        </button>
      )}
    </form>
  );
}
