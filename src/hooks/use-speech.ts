"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLanguageConfig } from "@/lib/language-config";
import { pickVoice } from "@/lib/speech";

export interface SpeakOptions {
  /** 0.1–10, default 0.9 (slightly slower than native speed for learners). */
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
}

export interface UseSpeechResult {
  /** The browser can speak this language with a matching voice. Hide speech UI when false. */
  supported: boolean;
  /** Voices have been enumerated (some browsers load them asynchronously). */
  ready: boolean;
  speaking: boolean;
  voice: SpeechSynthesisVoice | null;
  speak: (text: string, options?: SpeakOptions) => void;
  cancel: () => void;
}

function getSynth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** Text-to-speech with the device's own voices for a taught language (no network, no cost). */
export function useSpeech(language: string | null | undefined): UseSpeechResult {
  const config = language ? getLanguageConfig(language) : null;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const synth = getSynth();
    if (!synth) {
      setReady(true);
      return;
    }

    const load = () => {
      const list = synth.getVoices();
      setVoices(list);
      if (list.length > 0) {
        setReady(true);
      }
    };

    load();
    synth.addEventListener?.("voiceschanged", load);
    // Some browsers never fire voiceschanged when there are no voices at all.
    const timeout = window.setTimeout(() => setReady(true), 1500);

    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      window.clearTimeout(timeout);
    };
  }, []);

  const voice = config ? pickVoice(voices, config) : null;

  const cancel = useCallback(() => {
    getSynth()?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      const synth = getSynth();
      const trimmed = text.trim();
      if (!synth || !voice || !config || !trimmed) {
        return;
      }

      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.voice = voice;
      utterance.lang = voice.lang || config.speechLocale;
      utterance.rate = options.rate ?? 0.9;
      utterance.pitch = options.pitch ?? 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        options.onEnd?.();
      };
      utterance.onerror = () => setSpeaking(false);
      utteranceRef.current = utterance;
      synth.speak(utterance);
    },
    [config, voice]
  );

  useEffect(() => () => getSynth()?.cancel(), []);

  return { supported: Boolean(voice), ready, speaking, voice, speak, cancel };
}
