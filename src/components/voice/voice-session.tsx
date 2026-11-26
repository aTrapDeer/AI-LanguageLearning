"use client";

import { motion } from "framer-motion";
import { AlertCircle, Loader2, Mic, PhoneOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TutorUnavailable } from "@/components/chat/tutor-unavailable";
import { LessonShell, SessionSummary } from "@/components/learn";
import { notifyLearnSummaryChanged } from "@/hooks/use-learn-summary";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { getLanguageConfig, type SupportedLanguageCode } from "@/lib/language-config";
import type { TutorUnitDto } from "@/lib/tutor/types";
import type { VoiceMode } from "@/lib/tutor/voice-prompt";
import { cn } from "@/lib/utils";
import { DevicePicker, useAudioInputs } from "./device-picker";
import { useRealtimeVoice } from "./use-realtime-voice";
import { VoiceTranscript } from "./voice-transcript";

interface VoiceInfo {
  available: boolean;
  levelLabel: string;
  currentUnit: TutorUnitDto | null;
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function useElapsed(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSeconds((Date.now() - startedAt) / 1000), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return seconds;
}

const MODE_COPY: Record<VoiceMode, { title: string; blurb: string }> = {
  native: { title: "Native mode", blurb: "Your tutor speaks only the target language and rephrases simply when you're stuck." },
  assisted: { title: "Assisted mode", blurb: "Your tutor speaks the target language with English help and short explanations." },
};

export function VoiceSession({ language: languageCode, mode, unitId }: { language: SupportedLanguageCode; mode: VoiceMode; unitId: string | null }) {
  const language = getLanguageConfig(languageCode)!;
  const reduceMotion = usePrefersReducedMotion();
  const voice = useRealtimeVoice();
  const { inputs, refresh } = useAudioInputs();
  const [deviceId, setDeviceId] = useState("");
  const [info, setInfo] = useState<VoiceInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const live = voice.status === "live";
  const elapsed = useElapsed(live);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/voice/session?language=${encodeURIComponent(languageCode)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Couldn't load voice practice.");
        setInfo((await response.json()) as VoiceInfo);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setInfoError(error instanceof Error ? error.message : "Couldn't load voice practice.");
      });
    return () => controller.abort();
  }, [languageCode]);

  useEffect(() => {
    if (!deviceId && inputs.length > 0) setDeviceId(inputs[0].deviceId);
  }, [deviceId, inputs]);

  useEffect(() => {
    if (live) void refresh();
  }, [live, refresh]);

  useEffect(() => {
    if (voice.status === "ended" && voice.result && voice.result.xpGained > 0) notifyLearnSummaryChanged();
  }, [voice.result, voice.status]);

  const unavailable = info?.available === false || voice.errorCode === "tutor_unavailable";
  const copy = MODE_COPY[mode];
  const unit = info?.currentUnit && (!unitId || info.currentUnit.id === unitId) ? info.currentUnit : null;

  const start = () => void voice.start({ language: languageCode, mode, unitId: unitId ?? unit?.id ?? null, deviceId: deviceId || null });

  if (voice.status === "ended" && voice.result) {
    const result = voice.result;
    const minutes = Math.max(0, Math.round(result.seconds / 60));
    return (
      <LessonShell exitHref="/dashboard" exitLabel="Back to dashboard" topBarCenter={<p className="font-bold">{language.flag} Voice practice</p>}>
        <div className="my-auto py-4">
          <SessionSummary
            title={result.seconds >= 20 ? "Great conversation!" : "Call ended"}
            subtitle={`${formatDuration(result.seconds)} of ${language.name} speaking practice`}
            xpGained={result.xpGained}
            streak={result.activity?.streak}
            leveledUp={result.activity?.leveledUp}
            level={result.activity?.level}
            goalJustReached={result.activity?.goalJustReached}
            dailyXp={result.activity?.dailyXp}
            dailyGoal={result.activity?.dailyGoal}
            stats={[{ label: "Minutes", value: minutes < 1 ? "<1" : minutes }]}
            primaryAction={{ label: "Talk again", onClick: voice.reset }}
            secondaryAction={{ label: "Continue your lessons", href: `/learn/journey?lang=${languageCode}` }}
          >
            <div className="space-y-2 text-sm text-slate-600">
              {result.capReached && <p>You&apos;ve earned today&apos;s voice XP. Extra practice still counts for your skills!</p>}
              {voice.error && <p className="text-rose-600">{voice.error}</p>}
              <p>
                Want to polish what you said?{" "}
                <Link href={`/learn/${languageCode}`} className="font-semibold text-indigo-600 underline-offset-2 hover:underline">
                  Chat with your tutor
                </Link>{" "}
                or{" "}
                <Link href={`/flashcards?lang=${languageCode}`} className="font-semibold text-indigo-600 underline-offset-2 hover:underline">
                  review your words
                </Link>
                .
              </p>
            </div>
          </SessionSummary>
        </div>
      </LessonShell>
    );
  }

  const topBarCenter = (
    <div className="min-w-0">
      <p className="truncate text-base font-bold leading-tight">
        <span aria-hidden>{language.flag} </span>
        {copy.title}
      </p>
      <p className="truncate text-xs text-indigo-100/80">{live ? `Live · ${formatDuration(elapsed)}` : info?.levelLabel ?? language.name}</p>
    </div>
  );

  const footer = !unavailable ? (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-4 pt-2 sm:px-6">
      <DevicePicker
        inputs={inputs}
        value={deviceId}
        onChange={(next) => {
          setDeviceId(next);
          if (live) void voice.switchDevice(next);
        }}
      />
      {live || voice.status === "ending" ? (
        <button
          type="button"
          onClick={() => void voice.end()}
          disabled={voice.status === "ending"}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 text-lg font-bold text-white shadow-lg transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:opacity-70"
        >
          {voice.status === "ending" ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <PhoneOff aria-hidden className="h-5 w-5" />}
          {voice.status === "ending" ? "Saving…" : "End conversation"}
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={voice.status === "connecting" || !info}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 text-lg font-bold text-slate-900 shadow-lg transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:opacity-70"
        >
          {voice.status === "connecting" ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <Mic aria-hidden className="h-5 w-5" />}
          {voice.status === "connecting" ? "Connecting…" : "Start talking"}
        </button>
      )}
    </div>
  ) : undefined;

  return (
    <LessonShell exitHref={`/learn/conversation?lang=${languageCode}`} exitLabel="Back to voice modes" topBarCenter={topBarCenter} footer={footer}>
      {unavailable ? (
        <TutorUnavailable language={languageCode} />
      ) : (
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <motion.div
              aria-hidden
              className={cn(
                "flex h-28 w-28 items-center justify-center rounded-full text-5xl shadow-2xl",
                live ? "bg-gradient-to-br from-emerald-300 to-teal-500" : "bg-white/10 ring-1 ring-white/20"
              )}
              animate={live && voice.tutorSpeaking && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 1.2, repeat: live && voice.tutorSpeaking && !reduceMotion ? Infinity : 0 }}
            >
              {language.flag}
            </motion.div>
            <p role="status" aria-live="polite" className="text-sm font-semibold text-indigo-50">
              {voice.status === "connecting"
                ? "Connecting to your tutor…"
                : live
                  ? voice.tutorSpeaking
                    ? "Your tutor is speaking…"
                    : "Your turn. Just talk!"
                  : "Ready when you are"}
            </p>
            {!live && voice.status !== "connecting" && (
              <div className="max-w-md space-y-1 text-sm text-indigo-100/80">
                <p>{copy.blurb}</p>
                {unit && (
                  <p>
                    You&apos;ll practise <span className="font-semibold text-white">{unit.emoji} {unit.title}</span>.
                  </p>
                )}
                <p>Use headphones for the best experience.</p>
              </div>
            )}
          </div>

          {(voice.error || infoError) && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-50 ring-1 ring-rose-300/40">
              <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
              <span>{voice.error ?? infoError}</span>
            </div>
          )}

          {(live || voice.lines.length > 0) && (
            <div className="flex-1">
              <VoiceTranscript lines={voice.lines} rtl={language.rtl} speechLocale={language.speechLocale} />
            </div>
          )}
        </div>
      )}
    </LessonShell>
  );
}
