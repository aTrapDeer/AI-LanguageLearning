"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeMicError } from "@/components/chat/use-recorder";
import { getLocalDateString } from "@/lib/local-date";
import type { VoiceMode } from "@/lib/tutor/voice-prompt";

export type VoiceStatus = "idle" | "connecting" | "live" | "ending" | "ended";

export interface VoiceLine {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
}

export interface VoiceEndResult {
  seconds: number;
  xpGained: number;
  capReached: boolean;
  activity: {
    streak: number;
    dailyXp: number;
    dailyGoal: number;
    goalJustReached: boolean;
    leveledUp: boolean;
    level: number;
  } | null;
}

interface StartOptions {
  language: string;
  mode: VoiceMode;
  unitId: string | null;
  deviceId: string | null;
}

/** An error whose message is already written for the learner (from our API). */
class FriendlyError extends Error {}

let lineCounter = 0;
const nextLineId = () => `line-${Date.now()}-${(lineCounter += 1)}`;

async function readError(response: Response): Promise<{ message: string; code: string | null }> {
  const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
  return { message: body?.error ?? "Couldn't connect to your voice tutor.", code: body?.code ?? null };
}

/**
 * A WebRTC call with the realtime tutor. The server builds the tutor's instructions and records the
 * session; this hook handles the media, the live transcript and ending the session exactly once.
 */
export function useRealtimeVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [result, setResult] = useState<VoiceEndResult | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const liveSinceRef = useRef<number | null>(null);
  const userLineRef = useRef<string | null>(null);
  const tutorLineRef = useRef<string | null>(null);
  const linesRef = useRef<VoiceLine[]>([]);
  const endingRef = useRef(false);

  const updateLines = useCallback((updater: (current: VoiceLine[]) => VoiceLine[]) => {
    setLines((current) => {
      const next = updater(current);
      linesRef.current = next;
      return next;
    });
  }, []);

  const teardown = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    userLineRef.current = null;
    tutorLineRef.current = null;
    setTutorSpeaking(false);
  }, []);

  const endPayload = useCallback(() => {
    const activeSeconds = liveSinceRef.current ? (Date.now() - liveSinceRef.current) / 1000 : 0;
    return {
      sessionId: sessionIdRef.current,
      activeSeconds,
      transcript: linesRef.current.filter((line) => line.final && line.text.trim()).map((line) => ({ role: line.role, text: line.text })),
    };
  }, []);

  const end = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    const payload = endPayload();
    teardown();

    if (!payload.sessionId) {
      setStatus("idle");
      endingRef.current = false;
      return;
    }

    setStatus("ending");
    sessionIdRef.current = null;
    try {
      const response = await fetch("/api/voice/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as VoiceEndResult | null;
      setResult(
        response.ok && body
          ? body
          : { seconds: Math.round(payload.activeSeconds), xpGained: 0, capReached: false, activity: null }
      );
    } catch {
      setResult({ seconds: Math.round(payload.activeSeconds), xpGained: 0, capReached: false, activity: null });
    } finally {
      liveSinceRef.current = null;
      setStatus("ended");
      endingRef.current = false;
    }
  }, [endPayload, teardown]);

  const handleEvent = useCallback(
    (event: MessageEvent<string>) => {
      let message: { type?: string; delta?: string; transcript?: string; text?: string; error?: { message?: string } };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      const ensureUserLine = () => {
        if (!userLineRef.current) {
          const id = nextLineId();
          userLineRef.current = id;
          updateLines((current) => [...current, { id, role: "user", text: "", final: false }]);
        }
        return userLineRef.current;
      };

      switch (message.type) {
        case "input_audio_buffer.speech_started":
          ensureUserLine();
          break;
        case "conversation.item.input_audio_transcription.delta": {
          const id = ensureUserLine();
          updateLines((current) => current.map((line) => (line.id === id ? { ...line, text: line.text + (message.delta ?? "") } : line)));
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const id = ensureUserLine();
          const text = (message.transcript ?? "").trim();
          updateLines((current) =>
            text
              ? current.map((line) => (line.id === id ? { ...line, text, final: true } : line))
              : current.filter((line) => line.id !== id)
          );
          userLineRef.current = null;
          break;
        }
        case "conversation.item.input_audio_transcription.failed": {
          // The tutor still heard the audio; only the written line is missing.
          console.warn("Voice transcription failed:", message.error?.message ?? "no details");
          const id = userLineRef.current;
          if (id) updateLines((current) => current.filter((line) => line.id !== id || line.text.trim()));
          userLineRef.current = null;
          break;
        }
        case "response.output_audio_transcript.delta":
        case "response.output_text.delta": {
          setTutorSpeaking(true);
          if (!tutorLineRef.current) {
            const id = nextLineId();
            tutorLineRef.current = id;
            updateLines((current) => [...current, { id, role: "assistant", text: message.delta ?? "", final: false }]);
          } else {
            const id = tutorLineRef.current;
            updateLines((current) => current.map((line) => (line.id === id ? { ...line, text: line.text + (message.delta ?? "") } : line)));
          }
          break;
        }
        case "response.output_audio_transcript.done":
        case "response.output_text.done": {
          const id = tutorLineRef.current;
          const text = (message.transcript ?? message.text ?? "").trim();
          if (id) {
            updateLines((current) => current.map((line) => (line.id === id ? { ...line, text: text || line.text, final: true } : line)));
          } else if (text) {
            updateLines((current) => [...current, { id: nextLineId(), role: "assistant", text, final: true }]);
          }
          tutorLineRef.current = null;
          break;
        }
        case "response.done":
        case "output_audio_buffer.stopped":
          setTutorSpeaking(false);
          break;
        case "error":
          setError(message.error?.message ?? "The voice tutor ran into a problem.");
          break;
      }
    },
    [updateLines]
  );

  const start = useCallback(
    async ({ language, mode, unitId, deviceId }: StartOptions) => {
      if (status === "connecting" || status === "live") return;
      setError(null);
      setErrorCode(null);
      setResult(null);
      updateLines(() => []);
      setStatus("connecting");

      if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Voice conversations aren't supported in this browser. Try the latest Chrome, Safari or Edge.");
        setStatus("idle");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        });
      } catch (caught) {
        setError(describeMicError(caught));
        setStatus("idle");
        return;
      }

      try {
        streamRef.current = stream;
        const peer = new RTCPeerConnection();
        peerRef.current = peer;

        const audioElement = audioRef.current ?? new Audio();
        audioElement.autoplay = true;
        audioRef.current = audioElement;
        peer.ontrack = (event) => {
          audioElement.srcObject = event.streams[0];
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === "failed") {
            setError("The connection to your tutor dropped. Your practice time so far has been saved.");
            void end();
          }
        };

        stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

        const channel = peer.createDataChannel("oai-events");
        channelRef.current = channel;
        channel.onmessage = handleEvent;
        channel.onopen = () => {
          liveSinceRef.current = Date.now();
          setStatus("live");
          // The tutor speaks first; its instructions were set on the server.
          channel.send(JSON.stringify({ type: "response.create" }));
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        const params = new URLSearchParams({ language, mode, localDate: getLocalDateString() });
        if (unitId) params.set("unit", unitId);
        const response = await fetch(`/api/voice/session?${params.toString()}`, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        });

        if (!response.ok) {
          const { message, code } = await readError(response);
          setErrorCode(code);
          throw new FriendlyError(message);
        }

        sessionIdRef.current = response.headers.get("X-Voice-Session-Id");
        await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
      } catch (caught) {
        const sessionId = sessionIdRef.current;
        teardown();
        setError(
          caught instanceof FriendlyError
            ? caught.message
            : "Couldn't connect to your voice tutor. Check your internet connection and try again."
        );
        setStatus("idle");
        if (sessionId) {
          // The server already opened a session; close it so it doesn't linger.
          sessionIdRef.current = sessionId;
          liveSinceRef.current = null;
          void end().then(() => setStatus("idle"));
        }
      }
    },
    [end, handleEvent, status, teardown, updateLines]
  );

  /** Swaps the microphone mid-call without reconnecting. */
  const switchDevice = useCallback(async (deviceId: string) => {
    const peer = peerRef.current;
    if (!peer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true } });
      const [track] = stream.getAudioTracks();
      const sender = peer.getSenders().find((candidate) => candidate.track?.kind === "audio");
      await sender?.replaceTrack(track);
      streamRef.current?.getTracks().forEach((old) => old.stop());
      streamRef.current = stream;
    } catch (caught) {
      setError(describeMicError(caught));
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setErrorCode(null);
    updateLines(() => []);
    setStatus("idle");
  }, [updateLines]);

  // Leaving the page mid-call still ends the session (and credits the time) on the server.
  useEffect(() => {
    const onPageHide = () => {
      const payload = endPayload();
      if (!payload.sessionId) return;
      navigator.sendBeacon?.("/api/voice/session/end", new Blob([JSON.stringify(payload)], { type: "application/json" }));
      sessionIdRef.current = null;
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      onPageHide();
      teardown();
    };
  }, [endPayload, teardown]);

  return { status, error, errorCode, lines, tutorSpeaking, result, start, end, switchDevice, reset, clearError: () => setError(null) };
}
