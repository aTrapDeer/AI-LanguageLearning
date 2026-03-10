"use client"

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/language-context";
import { getSupportedLanguage, isSupportedLanguageCode, SUPPORTED_LANGUAGES } from "@/lib/language-config";
import { Copy, Loader2, Mic, Radio, Sparkles, Square } from "lucide-react";

type AudioDevice = {
  deviceId: string;
  label: string;
};

type TravelTurn = {
  id: string;
  transcript: string;
  translation: string;
  status: "listening" | "processing" | "translating" | "complete";
  createdAt: string;
};

type TravelResponseOption = {
  label: string;
  tone: string;
  translation: string;
  backTranslation: string;
  pronunciation: string;
  usageNote: string;
};

function createTurnId() {
  return `travel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function TravelPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { selectedLanguage } = useLanguage();

  const requestedLanguage = searchParams.get("lang");
  const activeLanguageCode = useMemo(() => {
    if (requestedLanguage && isSupportedLanguageCode(requestedLanguage)) {
      return requestedLanguage;
    }

    if (selectedLanguage?.code && isSupportedLanguageCode(selectedLanguage.code)) {
      return selectedLanguage.code;
    }

    return SUPPORTED_LANGUAGES[0].code;
  }, [requestedLanguage, selectedLanguage]);

  const activeLanguage = getSupportedLanguage(activeLanguageCode) ?? SUPPORTED_LANGUAGES[0];

  const [connectionStatus, setConnectionStatus] = useState("Ready to connect");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [error, setError] = useState<string>("");
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [turns, setTurns] = useState<TravelTurn[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyOptions, setReplyOptions] = useState<TravelResponseOption[]>([]);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);
  const [copiedOption, setCopiedOption] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);

  const getAudioDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 6)}`,
        }));

      setAudioDevices(audioInputs);
      if (!selectedDevice && audioInputs.length > 0) {
        setSelectedDevice(audioInputs[0].deviceId);
      }
    } catch (deviceError) {
      console.error("Failed to enumerate audio devices:", deviceError);
      setError("Microphone access is required for Travel mode.");
    }
  }, [selectedDevice]);

  const cleanup = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    currentTurnIdRef.current = null;
    setIsSessionActive(false);
    setIsHolding(false);
    setConnectionStatus("Ready to connect");
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/travel?lang=${activeLanguageCode}`)}`);
      return;
    }

    if (status === "authenticated" && session?.user?.accountSetup === false) {
      router.replace("/account-setup");
    }
  }, [activeLanguageCode, router, session?.user?.accountSetup, status]);

  useEffect(() => {
    getAudioDevices();
    navigator.mediaDevices.addEventListener("devicechange", getAudioDevices);

    return () => {
      cleanup();
      navigator.mediaDevices.removeEventListener("devicechange", getAudioDevices);
    };
  }, [cleanup, getAudioDevices]);

  useEffect(() => {
    if (!isHolding) {
      return;
    }

    const handlePointerRelease = () => {
      if (!audioStreamRef.current) {
        return;
      }

      audioStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      setIsHolding(false);
      setConnectionStatus("Processing translation...");
    };

    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);

    return () => {
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, [isHolding]);

  const travelInstructions = useMemo(() => {
    return `You are Travel mode for a traveler who understands English and needs help with ${activeLanguage.name}.

Your job:
- Listen to what is being said in ${activeLanguage.name}.
- Translate it into clear, natural English.
- Do not answer as the speaker.
- Do not ask follow-up questions.
- Keep the translation concise and practical for someone in the middle of a real-world travel situation.
- If part of the audio is unclear, briefly say so instead of inventing details.`;
  }, [activeLanguage.name]);

  const ensureActiveTurn = useCallback(() => {
    let turnId = currentTurnIdRef.current;

    if (!turnId) {
      turnId = createTurnId();
      currentTurnIdRef.current = turnId;
      setTurns((previousTurns) => [
        {
          id: turnId!,
          transcript: "",
          translation: "",
          status: "listening",
          createdAt: new Date().toISOString(),
        },
        ...previousTurns,
      ]);
    }

    return turnId;
  }, []);

  const updateTurn = useCallback((turnId: string, updater: (turn: TravelTurn) => TravelTurn) => {
    setTurns((previousTurns) =>
      previousTurns.map((turn) => (turn.id === turnId ? updater(turn) : turn))
    );
  }, []);

  const handleRealtimeMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "input_audio_buffer.speech_started": {
          ensureActiveTurn();
          setConnectionStatus("Listening...");
          break;
        }
        case "input_audio_buffer.speech_stopped": {
          const turnId = ensureActiveTurn();
          updateTurn(turnId, (turn) => ({ ...turn, status: "processing" }));
          setConnectionStatus("Transcribing...");
          break;
        }
        case "conversation.item.input_audio_transcription.delta": {
          const turnId = ensureActiveTurn();
          const delta = message.delta || "";
          updateTurn(turnId, (turn) => ({
            ...turn,
            transcript: `${turn.transcript}${delta}`,
            status: "listening",
          }));
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const turnId = ensureActiveTurn();
          updateTurn(turnId, (turn) => ({
            ...turn,
            transcript: message.transcript || turn.transcript,
            status: "translating",
          }));
          setConnectionStatus("Translating...");
          break;
        }
        case "response.output_text.delta":
        case "response.output_audio_transcript.delta": {
          const turnId = ensureActiveTurn();
          const delta = message.delta || "";
          updateTurn(turnId, (turn) => ({
            ...turn,
            translation: `${turn.translation}${delta}`,
            status: "translating",
          }));
          break;
        }
        case "response.output_text.done":
        case "response.output_audio_transcript.done": {
          const turnId = currentTurnIdRef.current;
          if (turnId) {
            updateTurn(turnId, (turn) => ({
              ...turn,
              translation: message.text || message.transcript || turn.translation,
              status: "complete",
            }));
            currentTurnIdRef.current = null;
          }
          setConnectionStatus("Ready to translate");
          break;
        }
        case "error": {
          setError(message.error?.message || "Realtime translation failed.");
          setConnectionStatus("Error");
          break;
        }
      }
    } catch (messageError) {
      console.error("Failed to process realtime event:", messageError);
    }
  }, [ensureActiveTurn, updateTurn]);

  const startSession = useCallback(async () => {
    try {
      cleanup();
      setError("");
      setConnectionStatus("Connecting...");

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        setIsSessionActive(true);
        setConnectionStatus("Ready to translate");
        dataChannel.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions: travelInstructions,
              output_modalities: ["text"],
              audio: {
                input: {
                  transcription: {
                    model: "gpt-4o-mini-transcribe",
                  },
                  turn_detection: {
                    type: "semantic_vad",
                    create_response: true,
                    interrupt_response: true,
                  },
                  noise_reduction: {
                    type: "near_field",
                  },
                },
              },
            },
          })
        );
      };

      dataChannel.onmessage = handleRealtimeMessage;
      dataChannel.onerror = () => {
        setError("The realtime translation channel disconnected.");
        setConnectionStatus("Error");
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });

      audioStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
        peerConnection.addTrack(track, stream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const response = await fetch("/api/openai-session/sdp", {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Failed to start realtime translation");
      }

      const answerSdp = await response.text();
      await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (sessionError) {
      console.error("Failed to start Travel session:", sessionError);
      setError(sessionError instanceof Error ? sessionError.message : "Failed to start Travel session");
      cleanup();
    }
  }, [cleanup, handleRealtimeMessage, selectedDevice, travelInstructions]);

  const startHoldingToTalk = async () => {
    if (!isSessionActive) {
      await startSession();
    }

    if (!audioStreamRef.current || dataChannelRef.current?.readyState !== "open") {
      setConnectionStatus("Connecting...");
      return;
    }

    audioStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

    setError("");
    setIsHolding(true);
    setConnectionStatus("Listening...");
  };

  const generateReplyOptions = async () => {
    if (!replyDraft.trim()) {
      return;
    }

    setIsGeneratingReplies(true);
    setError("");

    try {
      const response = await fetch("/api/travel/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: activeLanguageCode,
          message: replyDraft.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate reply options");
      }

      setReplyOptions(data.options || []);
    } catch (replyError) {
      console.error("Failed to generate reply options:", replyError);
      setError(replyError instanceof Error ? replyError.message : "Failed to generate reply options");
    } finally {
      setIsGeneratingReplies(false);
    }
  };

  const copyReplyOption = async (translation: string) => {
    try {
      await navigator.clipboard.writeText(translation);
      setCopiedOption(translation);
      window.setTimeout(() => setCopiedOption(null), 1600);
    } catch (clipboardError) {
      console.error("Failed to copy translated reply:", clipboardError);
      setError("Unable to copy that translation right now.");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading Travel mode...</div>
      </div>
    );
  }

  if (!session || session.user.accountSetup === false) {
    return null;
  }

  return (
    <div className="relative min-h-screen pb-10">
      <BackgroundGradientAnimation
        gradientBackgroundStart="rgb(0, 17, 82)"
        gradientBackgroundEnd="rgb(108, 0, 162)"
        firstColor="18, 113, 255"
        secondColor="221, 74, 255"
        thirdColor="100, 220, 255"
        fourthColor="200, 50, 50"
        fifthColor="180, 180, 50"
        pointerColor="140, 100, 255"
        size="100%"
        blendingValue="soft-light"
        interactive={false}
        containerClassName="fixed inset-0 opacity-20"
      />

      <div className="relative container mx-auto px-4 pt-24">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="rounded-3xl border bg-white/90 p-6 shadow-xl backdrop-blur dark:bg-zinc-950/85">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                  <Sparkles className="h-4 w-4" />
                  Travel interpreter
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    Live help for real-world conversations
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
                    Hold the button while someone is speaking in {activeLanguage.name}. Travel mode will capture the phrase,
                    transcribe it, and stream back the English meaning. Then type what you want to say and get ready-to-use
                    reply options in {activeLanguage.name}.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Language</div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-2xl">{activeLanguage.flag}</span>
                    <div>
                      <div className="font-semibold">{activeLanguage.name}</div>
                      <div className="text-sm text-muted-foreground">Active for Travel mode</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                    <Radio className={`h-4 w-4 ${isSessionActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                    {connectionStatus}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border bg-white/90 p-6 shadow-lg backdrop-blur dark:bg-zinc-950/85">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Listen and translate</h2>
                    <p className="text-sm text-muted-foreground">
                      Connect once, then press and hold whenever you want to translate what someone is saying nearby.
                    </p>
                  </div>

                  <div className="w-full max-w-xs">
                    <label htmlFor="travel-microphone" className="mb-2 block text-sm font-medium">
                      Microphone
                    </label>
                    <select
                      id="travel-microphone"
                      value={selectedDevice}
                      onChange={(event) => setSelectedDevice(event.target.value)}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:bg-zinc-900"
                    >
                      {audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-4 md:flex-row">
                  <Button
                    type="button"
                    variant={isSessionActive ? "outline" : "default"}
                    className="min-h-12"
                    onClick={() => {
                      if (isSessionActive) {
                        cleanup();
                        return;
                      }

                      void startSession();
                    }}
                  >
                    {isSessionActive ? (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Disconnect
                      </>
                    ) : (
                      <>
                        <Radio className="mr-2 h-4 w-4" />
                        Connect Travel mode
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      void startHoldingToTalk();
                    }}
                    onPointerUp={() => {
                      if (!audioStreamRef.current) {
                        return;
                      }

                      audioStreamRef.current.getAudioTracks().forEach((track) => {
                        track.enabled = false;
                      });

                      setIsHolding(false);
                      setConnectionStatus("Processing translation...");
                    }}
                    onPointerLeave={() => {
                      if (!isHolding || !audioStreamRef.current) {
                        return;
                      }

                      audioStreamRef.current.getAudioTracks().forEach((track) => {
                        track.enabled = false;
                      });

                      setIsHolding(false);
                      setConnectionStatus("Processing translation...");
                    }}
                    onPointerCancel={() => {
                      if (!audioStreamRef.current) {
                        return;
                      }

                      audioStreamRef.current.getAudioTracks().forEach((track) => {
                        track.enabled = false;
                      });

                      setIsHolding(false);
                      setConnectionStatus("Processing translation...");
                    }}
                    disabled={!isSessionActive && connectionStatus === "Connecting..."}
                    className={`flex min-h-16 flex-1 items-center justify-center rounded-2xl border px-6 py-4 text-base font-semibold transition ${
                      isHolding
                        ? "border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                        : "border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    }`}
                  >
                    <Mic className="mr-3 h-5 w-5" />
                    {isHolding ? "Listening now - release to translate" : "Hold to translate"}
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border bg-background/80 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Heard in {activeLanguage.name}</div>
                    <div className="mt-3 min-h-28 whitespace-pre-wrap text-sm leading-6">
                      {turns[0]?.transcript || "Your live transcript will appear here while someone is speaking."}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background/80 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">English meaning</div>
                    <div className="mt-3 min-h-28 whitespace-pre-wrap text-sm leading-6">
                      {turns[0]?.translation || "The translated meaning will stream here as soon as Travel mode processes the audio."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border bg-white/90 p-6 shadow-lg backdrop-blur dark:bg-zinc-950/85">
                <h2 className="text-xl font-semibold">Travel log</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Recent phrases stay here so you can quickly glance back at what was said and what it meant.
                </p>

                <div className="mt-5 max-h-[32rem] space-y-4 overflow-y-auto pr-1">
                  {turns.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                      No translations yet. Connect Travel mode and hold the button while someone speaks.
                    </div>
                  ) : (
                    turns.map((turn) => (
                      <div key={turn.id} className="rounded-2xl border bg-background/70 p-4">
                        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                          <span>{turn.status === "complete" ? "Completed" : turn.status}</span>
                          <span>{new Date(turn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Original speech
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6">
                              {turn.transcript || "Listening..."}
                            </p>
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Translation
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6">
                              {turn.translation || "Working on the translation..."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-white/90 p-6 shadow-lg backdrop-blur dark:bg-zinc-950/85">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Plan your reply</h2>
                <p className="text-sm text-muted-foreground">
                  Type what you want to say in English and get several translated reply options in {activeLanguage.name}.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <Textarea
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder="Type your response in English, for example: Excuse me, could you say that again more slowly?"
                  className="min-h-[140px] resize-none"
                />

                <Button
                  type="button"
                  onClick={generateReplyOptions}
                  disabled={isGeneratingReplies || !replyDraft.trim()}
                  className="w-full min-h-12"
                >
                  {isGeneratingReplies ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating reply options...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Translate my reply
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-6 space-y-4">
                {replyOptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                    Your translated response options will appear here.
                  </div>
                ) : (
                  replyOptions.map((option) => (
                    <div key={`${option.label}-${option.translation}`} className="rounded-2xl border bg-background/80 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">{option.tone}</div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void copyReplyOption(option.translation)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {copiedOption === option.translation ? "Copied" : "Copy"}
                        </Button>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Say this in {activeLanguage.name}
                          </div>
                          <p className="text-base font-medium leading-7">{option.translation}</p>
                        </div>

                        {option.pronunciation && (
                          <div>
                            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Pronunciation help
                            </div>
                            <p className="text-sm leading-6 text-muted-foreground">{option.pronunciation}</p>
                          </div>
                        )}

                        <div>
                          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            English meaning
                          </div>
                          <p className="text-sm leading-6">{option.backTranslation}</p>
                        </div>

                        <div>
                          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            When to use it
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">{option.usageNote}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TravelPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading Travel mode...</div>}>
      <TravelPageContent />
    </Suspense>
  );
}
