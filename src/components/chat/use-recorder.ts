"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "transcribing";

const MAX_RECORDING_MS = 60_000;
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function describeMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it in your browser's site settings, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found. Plug one in or choose another, then try again.";
  }
  if (name === "NotReadableError") {
    return "Your microphone is busy in another app. Close it there and try again.";
  }
  return "Couldn't start the microphone.";
}

/**
 * Push-to-record speech input: records with whatever format the browser supports, sends it to
 * /api/transcribe with the matching MIME type and the target language, and hands back the text.
 */
export function useRecorder(language: string, onText: (text: string) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, "speech");
        form.append("language", language);
        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        const body = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "Couldn't understand the recording.");
        }
        const text = body?.text?.trim() ?? "";
        if (!text) {
          setError("I didn't catch that. Try again a little closer to the mic.");
        } else {
          onTextRef.current(text);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Couldn't understand the recording.");
      } finally {
        setState("idle");
      }
    },
    [language]
  );

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice input isn't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        releaseStream();
        recorderRef.current = null;
        if (cancelledRef.current || chunks.length === 0) {
          setState("idle");
          return;
        }
        void transcribe(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
      };

      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
      timeoutRef.current = window.setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_RECORDING_MS);
    } catch (caught) {
      releaseStream();
      setState("idle");
      setError(describeMicError(caught));
    }
  }, [releaseStream, state, transcribe]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseStream();
    },
    [releaseStream]
  );

  return { state, error, clearError: () => setError(null), start, stop, cancel };
}
