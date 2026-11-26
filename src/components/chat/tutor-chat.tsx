"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LessonShell, StreakBadge } from "@/components/learn";
import { notifyLearnSummaryChanged, useLearnSummary } from "@/hooks/use-learn-summary";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { normalizeVocabularyKey } from "@/lib/exercise-text";
import { getLanguageConfig, type SupportedLanguageCode } from "@/lib/language-config";
import type { TutorReply, TutorVocabulary } from "@/lib/tutor/schema";
import type { TutorScenarioId } from "@/lib/tutor/scenarios";
import type { TutorActivityDto, TutorMessageDto, TutorSessionDto, TutorStateResponse } from "@/lib/tutor/types";
import { ChatMenu } from "./chat-menu";
import { Composer } from "./composer";
import { FeedbackCard } from "./feedback-card";
import { LearnerBubble } from "./learner-bubble";
import { ScenarioPicker } from "./scenario-picker";
import { SuggestionChips } from "./suggestion-chips";
import { fetchTutorState, saveTutorWord, sendTutorMessage, startTutorSession, TutorApiError } from "./tutor-api";
import { TutorBubble } from "./tutor-bubble";
import { TutorUnavailable } from "./tutor-unavailable";
import { TypingIndicator } from "./typing-indicator";
import { useLocalPreference } from "./use-local-preference";
import { useRecorder } from "./use-recorder";
import { useTutorAudio } from "./use-tutor-audio";
import type { SaveState } from "./vocab-chip";

interface TutorChatProps {
  language: SupportedLanguageCode;
  /** From `?scenario=` / `?unit=`: start that conversation straight away. */
  initialScenarioId: TutorScenarioId | null;
  initialUnitId: string | null;
}

interface Toast {
  id: number;
  text: string;
}

const PENDING_ID = "pending-user-message";

export function TutorChat({ language: languageCode, initialScenarioId, initialUnitId }: TutorChatProps) {
  const language = getLanguageConfig(languageCode)!;
  const router = useRouter();
  const { data: authSession } = useSession();
  const userId = authSession?.user?.id ?? null;
  const reduceMotion = usePrefersReducedMotion();
  const { summary } = useLearnSummary(languageCode);

  const [state, setState] = useState<TutorStateResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<TutorSessionDto | null>(null);
  const [messages, setMessages] = useState<TutorMessageDto[]>([]);
  const [view, setView] = useState<"chat" | "picker">("chat");
  const [starting, setStarting] = useState<TutorScenarioId | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [showTranslation, setShowTranslation] = useLocalPreference("laingfy:tutor:show-translation", false);
  const [showRomanization, setShowRomanization] = useLocalPreference("laingfy:tutor:show-romanization", false);
  const [slowAudio, setSlowAudio] = useLocalPreference("laingfy:tutor:slow-audio", false);

  const audio = useTutorAudio(languageCode, slowAudio ? "slow" : "normal");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoStartedRef = useRef(false);
  const capNotifiedRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  const recorder = useRecorder(languageCode, (text) => {
    setDraft((current) => (current.trim() ? `${current.trim()} ${text}` : text));
    inputRef.current?.focus();
  });

  const showToast = useCallback((text: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), text });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  // Keyed on the user id: NextAuth hands out a new session object on every window focus.
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoadError(null);

    fetchTutorState(languageCode, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setState(next);
        setSession(next.session);
        setMessages(next.messages);
        setUnavailable(!next.available);
        setSaveStates(Object.fromEntries(next.savedWords.map((key) => [key, "saved" as SaveState])));
        capNotifiedRef.current = next.xp.rewardedTurnsToday >= next.xp.dailyTurnCap;
        setView(next.session ? "chat" : "picker");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Couldn't load your conversation.");
      });

    return () => controller.abort();
  }, [languageCode, reloadKey, userId]);

  const startConversation = useCallback(
    async (scenarioId: TutorScenarioId, unitId: string | null) => {
      setStarting(scenarioId);
      setStartError(null);
      audio.stop();
      try {
        const result = await startTutorSession(languageCode, scenarioId, unitId);
        setSession(result.session);
        setMessages(result.messages);
        setDraft("");
        setSendError(null);
        setView("chat");
      } catch (error) {
        if (error instanceof TutorApiError && error.code === "tutor_unavailable") {
          setUnavailable(true);
        } else {
          setStartError(error instanceof Error ? error.message : "Couldn't start the conversation.");
        }
      } finally {
        setStarting(null);
      }
    },
    [audio, languageCode]
  );

  // Deep links (`?unit=` after a lesson, `?scenario=`) start a fresh conversation once, then the
  // query is dropped so a reload resumes instead of starting yet another conversation.
  useEffect(() => {
    if (!state || autoStartedRef.current || !state.available) return;
    if (!initialScenarioId && !initialUnitId) return;
    autoStartedRef.current = true;
    const scenarioId = initialScenarioId ?? "unit";
    void startConversation(scenarioId, initialUnitId).then(() => router.replace(`/learn/${languageCode}`, { scroll: false }));
  }, [initialScenarioId, initialUnitId, languageCode, router, startConversation, state]);

  useEffect(() => {
    // Scroll LessonShell's scrolling <main> directly: scrollIntoView's smooth scroll gets cancelled when
    // several messages arrive in quick succession.
    const frame = window.requestAnimationFrame(() => {
      const scroller = bottomRef.current?.closest("main");
      scroller?.scrollTo({ top: scroller.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, sending, reduceMotion, view]);

  const onActivity = useCallback(
    (activity: TutorActivityDto | null) => {
      if (!activity) return;
      if (activity.xpGained > 0 || activity.goalJustReached) notifyLearnSummaryChanged();

      if (activity.goalJustReached) {
        showToast(`🎯 Daily goal reached! +${activity.xpGained} XP`);
      } else if (activity.xpGained > 0) {
        showToast(`+${activity.xpGained} XP`);
      } else if (activity.capReached && !capNotifiedRef.current) {
        showToast("You've earned today's chat XP. Keep chatting for practice!");
      }
      if (activity.capReached) capNotifiedRef.current = true;
    },
    [showToast]
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !session || sending) return;

    setSending(true);
    setSendError(null);
    setDraft("");
    audio.stop();
    const pending: TutorMessageDto = { id: PENDING_ID, role: "user", content: text, payload: null, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, pending]);

    try {
      const result = await sendTutorMessage(session.id, text);
      setMessages((current) => [...current.filter((message) => message.id !== PENDING_ID), result.userMessage, result.assistantMessage]);
      onActivity(result.activity);
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== PENDING_ID));
      setDraft((current) => current || text);
      if (error instanceof TutorApiError && error.code === "tutor_unavailable") {
        setUnavailable(true);
      } else {
        setSendError(error instanceof Error ? error.message : "Your message didn't send.");
      }
    } finally {
      setSending(false);
    }
  }, [audio, draft, onActivity, sending, session]);

  // Only unit practice tags saved words with the unit; role-play words aren't that unit's vocabulary.
  const unitId = session?.scenarioId === "unit" ? session.unitId : null;
  const saveWord = useCallback(
    async (item: TutorVocabulary, context: TutorReply | null) => {
      const key = normalizeVocabularyKey(item.word);
      setSaveStates((current) => ({ ...current, [key]: "saving" }));
      try {
        await saveTutorWord({
          language: languageCode,
          word: item.word,
          translation: item.translation,
          romanization: item.romanization,
          exampleSentence: context?.reply ?? null,
          exampleTranslation: context?.translation ?? null,
          unitId,
        });
        setSaveStates((current) => ({ ...current, [key]: "saved" }));
        notifyLearnSummaryChanged();
      } catch {
        setSaveStates((current) => ({ ...current, [key]: "error" }));
      }
    },
    [languageCode, unitId]
  );

  const latestTutor = useMemo(() => [...messages].reverse().find((message) => message.role === "assistant") ?? null, [messages]);
  const suggestions = !sending && latestTutor?.payload ? latestTutor.payload.suggestions : [];

  const placeholder = `Write in ${language.name}…`;
  const loading = !state && !loadError;

  const topBarCenter = (
    <div className="min-w-0">
      <p className="truncate text-base font-bold leading-tight">
        <span aria-hidden>{language.flag} </span>
        {view === "picker" || !session ? `${language.name} tutor` : session.title}
      </p>
      {state && <p className="truncate text-xs text-indigo-100/80">{state.levelLabel}</p>}
    </div>
  );

  const topBarEnd = (
    <>
      {summary && <StreakBadge streak={summary.streak.current} todayDone={summary.streak.todayDone} atRisk={summary.streak.atRisk} size="sm" />}
      <ChatMenu
        language={languageCode}
        onNewConversation={!unavailable && session && view === "chat" ? () => setView("picker") : null}
        toggles={[
          { id: "translation", label: "Always show translations", checked: showTranslation, onChange: setShowTranslation },
          ...(language.needsRomanization
            ? [{ id: "romanization", label: `Always show ${language.romanizationName ?? "romanization"}`, checked: showRomanization, onChange: setShowRomanization }]
            : []),
          { id: "slow", label: "Slow audio", checked: slowAudio, onChange: setSlowAudio },
        ]}
      />
    </>
  );

  const footer =
    view === "chat" && session ? (
      <div className="mx-auto w-full max-w-2xl space-y-2 px-3 pb-3 pt-2 sm:px-6">
        {unavailable ? (
          <TutorUnavailable language={languageCode} compact />
        ) : (
          <>
            <SuggestionChips suggestions={suggestions} rtl={language.rtl} onPick={(text) => {
              setDraft(text);
              inputRef.current?.focus();
            }} />
            {(sendError || recorder.error || audio.error) && (
              <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-50 ring-1 ring-rose-300/40">
                <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
                <span className="min-w-0 flex-1">{sendError ?? recorder.error ?? audio.error}</span>
                {sendError && (
                  <button type="button" onClick={() => void send()} className="inline-flex shrink-0 items-center gap-1 font-semibold text-white underline-offset-2 hover:underline">
                    <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                    Retry
                  </button>
                )}
              </div>
            )}
            <Composer
              value={draft}
              onChange={(value) => {
                setDraft(value);
                if (sendError) setSendError(null);
                if (recorder.error) recorder.clearError();
              }}
              onSend={() => void send()}
              sending={sending}
              placeholder={placeholder}
              recorder={recorder}
              inputRef={(element) => {
                inputRef.current = element;
              }}
            />
          </>
        )}
      </div>
    ) : undefined;

  return (
    <LessonShell exitHref="/dashboard" exitLabel="Back to dashboard" topBarCenter={topBarCenter} topBarEnd={topBarEnd} footer={footer}>
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-50 flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              role="status"
              aria-live="polite"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.9 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-full rounded-full bg-amber-300 px-4 py-1.5 text-center text-sm font-bold text-slate-900 shadow-lg"
            >
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center" role="status">
          <TypingIndicator label="Loading your conversation" />
        </div>
      )}

      {loadError && (
        <div role="alert" className="mx-auto mt-10 max-w-sm rounded-2xl bg-white/10 p-5 text-center text-sm ring-1 ring-white/15">
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-3 rounded-full bg-white px-4 py-2 font-semibold text-indigo-700">
            Try again
          </button>
        </div>
      )}

      {state && view === "picker" && (
        unavailable ? (
          <TutorUnavailable language={languageCode} />
        ) : (
          <>
            {startError && (
              <p role="alert" className="mb-3 rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-50 ring-1 ring-rose-300/40">
                {startError}
              </p>
            )}
            <ScenarioPicker
              languageName={language.name}
              levelLabel={state.levelLabel}
              currentUnit={state.currentUnit}
              starting={starting}
              onPick={(scenarioId) => void startConversation(scenarioId, scenarioId === "unit" ? state.currentUnit?.id ?? null : null)}
              onBack={session ? () => setView("chat") : undefined}
            />
          </>
        )
      )}

      {state && view === "chat" && session && (
        <div className="flex flex-col gap-3 pb-2" aria-live="polite" aria-relevant="additions">
          {messages.map((message) =>
            message.role === "user" ? (
              <LearnerBubble key={message.id} text={message.content} pending={message.id === PENDING_ID} />
            ) : (
              <Fragment key={message.id}>
                {message.payload && (message.payload.corrections.length > 0 || message.payload.praise) && (
                  <FeedbackCard corrections={message.payload.corrections} praise={message.payload.praise} rtl={language.rtl} />
                )}
                <TutorBubble
                  text={message.content}
                  payload={message.payload}
                  language={language}
                  showTranslation={showTranslation}
                  showRomanization={showRomanization}
                  audio={{
                    playing: audio.playingId === message.id,
                    loading: audio.loadingId === message.id,
                    onToggle: () => audio.toggle(message.id, message.content),
                  }}
                  getSaveState={(item) => saveStates[normalizeVocabularyKey(item.word)] ?? "idle"}
                  onSaveWord={(item) => void saveWord(item, message.payload)}
                />
              </Fragment>
            )
          )}
          {sending && <TypingIndicator className="self-start" />}
          <div ref={bottomRef} />
        </div>
      )}
    </LessonShell>
  );
}
