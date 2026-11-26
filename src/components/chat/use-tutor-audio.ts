"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "@/hooks/use-speech";

export type AudioSpeed = "normal" | "slow";

export interface UseTutorAudioResult {
  playingId: string | null;
  loadingId: string | null;
  error: string | null;
  /** Toggles playback of `text` for message `id` (tap again to stop). */
  toggle: (id: string, text: string) => void;
  stop: () => void;
}

/**
 * Plays tutor messages on demand: neural TTS from /api/tts (cached per message and speed for the page
 * lifetime), falling back to the device's own voice when that fails or the daily limit is reached.
 */
export function useTutorAudio(language: string, speed: AudioSpeed): UseTutorAudioResult {
  const { supported: deviceVoice, speak, cancel } = useSpeech(language);
  const cacheRef = useRef(new Map<string, string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const serverDisabledRef = useRef(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    audioRef.current?.pause();
    cancel();
    setPlayingId(null);
    setLoadingId(null);
  }, [cancel]);

  const speakWithDevice = useCallback(
    (id: string, text: string) => {
      if (!deviceVoice) {
        setError("Audio isn't available on this device right now.");
        setPlayingId(null);
        return;
      }
      setPlayingId(id);
      speak(text, { rate: speed === "slow" ? 0.7 : 0.95, onEnd: () => setPlayingId((current) => (current === id ? null : current)) });
    },
    [deviceVoice, speak, speed]
  );

  const playUrl = useCallback(
    (id: string, url: string, text: string) => {
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.onended = () => setPlayingId((current) => (current === id ? null : current));
      audio.onerror = () => speakWithDevice(id, text);
      audio.src = url;
      setPlayingId(id);
      audio.play().catch(() => speakWithDevice(id, text));
    },
    [speakWithDevice]
  );

  const toggle = useCallback(
    (id: string, text: string) => {
      if (playingId === id || loadingId === id) {
        stop();
        return;
      }

      stop();
      setError(null);
      // Created inside the tap so mobile browsers treat later playback as user-initiated.
      audioRef.current = audioRef.current ?? new Audio();

      const key = `${id}|${speed}`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        playUrl(id, cached, text);
        return;
      }

      if (serverDisabledRef.current) {
        speakWithDevice(id, text);
        return;
      }

      const controller = new AbortController();
      requestRef.current = controller;
      setLoadingId(id);

      void (async () => {
        try {
          const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, language, speed }),
            signal: controller.signal,
          });
          if (!response.ok) {
            if (response.status === 429 || response.status === 503) {
              serverDisabledRef.current = true;
            }
            throw new Error(`tts ${response.status}`);
          }
          const url = URL.createObjectURL(await response.blob());
          cacheRef.current.set(key, url);
          if (!controller.signal.aborted) {
            setLoadingId(null);
            playUrl(id, url, text);
          }
        } catch {
          if (!controller.signal.aborted) {
            setLoadingId(null);
            speakWithDevice(id, text);
          }
        }
      })();
    },
    [language, loadingId, playUrl, playingId, speakWithDevice, speed, stop]
  );

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      requestRef.current?.abort();
      audioRef.current?.pause();
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  return { playingId, loadingId, error, toggle, stop };
}
