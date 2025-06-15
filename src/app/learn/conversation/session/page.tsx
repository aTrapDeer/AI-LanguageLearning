'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { v4 as uuidv4 } from "uuid"
import { useSearchParams, useRouter } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isFinal: boolean;
  status?: 'speaking' | 'processing' | 'final';
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

const ConversationSessionPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get('mode') || 'native';
  const language = searchParams.get('lang') || 'en';
  
  const [status, setStatus] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string>("");
  const [activeLanguage, setActiveLanguage] = useState<string>(language);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  // WebRTC references
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // For tracking ephemeral user messages
  const ephemeralUserMessageIdRef = useRef<string | null>(null);

  // Add timer ref for speech debouncing
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const SPEECH_DELAY = 5000; // 5 seconds delay

  // Move getAudioDevices outside useEffect to avoid recreating it on every render
  const getAudioDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`
        }));
      
      setAudioDevices(audioInputs);
      
      // Set default device if none selected
      if (!selectedDevice && audioInputs.length > 0) {
        setSelectedDevice(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.error("Error getting audio devices:", err);
      setError("Failed to get audio devices");
    }
  }, [selectedDevice]);

  useEffect(() => {
    setActiveLanguage(language);
    getAudioDevices();

    const audioEl = new Audio();
    audioEl.autoplay = true;
    audioElementRef.current = audioEl;

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);

    return () => {
      cleanup();
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null;
      }
      navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
    };
  }, [language, getAudioDevices]);

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    if (isSessionActive) {
      // Restart session with new device
      await cleanup();
      await startSession();
    }
  };

  const cleanup = () => {
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
    setIsSessionActive(false);
  };

  const getLanguageInstructions = (lang: string, conversationMode: string) => {
    const languageNames: { [key: string]: string } = {
      de: "German (Deutsch)",
      es: "Spanish (Español)",
      fr: "French (Français)",
      it: "Italian (Italiano)",
      ja: "Japanese (日本語)",
      ko: "Korean (한국어)",
      zh: "Chinese (中文)",
      pt: "Portuguese (Português)",
      ru: "Russian (Русский)",
      ar: "Arabic (العربية)",
      hi: "Hindi (हिन्दी)",
      // Add more languages as needed
    };

    const languageName = languageNames[lang] || lang.toUpperCase();
    
    if (conversationMode === 'assisted') {
      return `Hey there! I'm your friendly ${languageName} conversation partner. Think of me as that encouraging friend who happens to be fluent in ${languageName} and loves helping people learn. Here's how I like to chat:

I'll mostly speak in ${languageName} because that's the best way to practice, but I'm here to help you understand everything! When I notice you're struggling or when something interesting comes up, I'll switch to English to explain things clearly.

My conversational style:
- I'm naturally curious about your life, interests, and experiences - just like a real friend would be
- When you make mistakes (totally normal!), I'll gently correct you by first showing I understood what you meant, then casually mentioning the right way to say it
- I love sharing little cultural insights and explaining why we say things certain ways
- I'll ask follow-up questions to keep our conversation flowing naturally
- If you seem confused, I'll pause and explain in English before we continue

I'll start by greeting you warmly in ${languageName} and getting to know what brings you joy in life. Let's have a real conversation - not a lesson, but a genuine chat between friends where you happen to be learning ${languageName} along the way!

Remember, I'm rooting for you and celebrate every bit of progress. Let's make this fun and natural!`;
    } else {
      // Native mode - more conversational instructions
      return `Hi! I'm your ${languageName} conversation buddy - think of me as a friendly local who's excited to chat with you entirely in ${languageName}. 

I believe the best way to learn is through natural, engaging conversations, so that's exactly what we're going to have! I'll only speak ${languageName} with you, just like you'd experience if you were hanging out with a friend who doesn't speak English.

My approach:
- I'm genuinely interested in getting to know you as a person
- I'll naturally adjust how I speak based on your level - speaking more clearly if needed, or using more natural expressions as you improve
- When you make mistakes, I'll respond the way a helpful friend would - I'll show I understood you first, then casually model the correct way to say it
- I love asking questions that get you talking about things you care about
- I'll introduce you to expressions and cultural nuances the way they naturally come up in conversation
- Sometimes I'll encourage you to try saying something in a different way, just to help you practice various expressions

Let's start with a warm greeting and dive into a real conversation. I'm curious about your life, your interests, and what's happening in your world. Ready to chat naturally in ${languageName}?`;
    }
  };

  const startSession = async () => {
    try {
      if (!activeLanguage) {
        throw new Error("No active language selected");
      }

      cleanup();
      setStatus("Initializing...");

      // Get session from OpenAI through our secure backend
      const sessionResponse = await fetch("/api/openai-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || "Failed to create session");
      }

      const sessionData = await sessionResponse.json();
      console.log("Session data:", sessionData);

      if (!sessionData.session_id) {
        throw new Error("No session ID received from server");
      }

      // Create WebRTC peer connection using the ice servers from the session
      const pc = new RTCPeerConnection({
        iceServers: sessionData.ice_servers || [{ urls: "stun:stun.l.google.com:19302" }]
      });
      peerConnectionRef.current = pc;

      // Handle incoming audio track
      pc.ontrack = (event) => {
        console.log("Received audio track");
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = event.streams[0];
        }
      };

      // Create data channel
      const dc = pc.createDataChannel("chat");
      dataChannelRef.current = dc;

      // Set up data channel handlers
      dc.onopen = () => {
        console.log("Data channel open");
        setIsSessionActive(true);
        setStatus("Connected");

        // Send initial configuration with language learning instructions
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            input_audio_transcription: {
              model: "whisper-1"
            }
          }
        }));

        // Send language learning context with mode-specific instructions
        dc.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: getLanguageInstructions(activeLanguage, mode)
              }
            ]
          }
        }));
      };

      dc.onmessage = handleDataChannelMessage;

      // Create and set up audio context
      const audioContext = new AudioContext({
        sampleRate: 16000
      });
      audioContextRef.current = audioContext;

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      audioStreamRef.current = stream;

      // Add audio track to peer connection
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send SDP offer through our secure backend
      const sdpResponse = await fetch(`/api/openai-session/sdp?session_id=${sessionData.session_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || "Failed to establish WebRTC connection");
        } catch {
          throw new Error(`Failed to establish WebRTC connection: ${errorText}`);
        }
      }

      // Set remote description
      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("Connected");
    } catch (err) {
      console.error("Failed to start session:", err);
      setError(err instanceof Error ? err.message : "Failed to start session");
      cleanup();
    }
  };

  const handleDataChannelMessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      console.log("Received message:", msg);

      switch (msg.type) {
        case "input_audio_buffer.speech_started": {
          // Clear any existing timeout when speech starts
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
          }
          getOrCreateEphemeralUserId();
          updateEphemeralUserMessage({ status: "speaking" });
          break;
        }

        case "input_audio_buffer.speech_stopped": {
          // Instead of immediately stopping, set a timeout
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
          }
          
          speechTimeoutRef.current = setTimeout(() => {
            updateEphemeralUserMessage({ status: "processing" });
            if (dataChannelRef.current) {
              dataChannelRef.current.send(JSON.stringify({
                type: "input_audio_buffer.commit"
              }));
            }
          }, SPEECH_DELAY);

          // Keep the status as speaking during the delay
          updateEphemeralUserMessage({ status: "speaking" });
          break;
        }

        case "input_audio_buffer.committed": {
          // Clear any existing timeout as the buffer was committed
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
          }
          updateEphemeralUserMessage({
            text: "Processing speech...",
            status: "processing"
          });
          break;
        }

        case "conversation.item.input_audio_transcription": {
          const partialText = msg.transcript ?? msg.text ?? "User is speaking...";
          updateEphemeralUserMessage({
            text: partialText,
            status: "speaking",
            isFinal: false
          });
            break;
        }

        case "conversation.item.input_audio_transcription.completed": {
          updateEphemeralUserMessage({
            text: msg.transcript || "",
            isFinal: true,
            status: "final"
          });
          clearEphemeralUserMessage();
          break;
        }

        case "response.audio_transcript.delta": {
          const newMessage: Message = {
            id: uuidv4(),
            role: "assistant",
            text: msg.delta,
            timestamp: new Date().toISOString(),
            isFinal: false
          };

          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isFinal) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...lastMsg,
                text: lastMsg.text + msg.delta
              };
              return updated;
            }
            return [...prev, newMessage];
          });
          break;
        }
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  };

  const getOrCreateEphemeralUserId = (): string => {
    let ephemeralId = ephemeralUserMessageIdRef.current;
    if (!ephemeralId) {
      ephemeralId = uuidv4();
      ephemeralUserMessageIdRef.current = ephemeralId;

      const newMessage: Message = {
        id: ephemeralId,
        role: "user",
        text: "",
        timestamp: new Date().toISOString(),
        isFinal: false,
        status: "speaking"
      };

      setMessages(prev => [...prev, newMessage]);
    }
    return ephemeralId;
  };

  const updateEphemeralUserMessage = (partial: Partial<Message>) => {
    const ephemeralId = ephemeralUserMessageIdRef.current;
    if (!ephemeralId) return;

    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === ephemeralId) {
          return { ...msg, ...partial };
        }
        return msg;
      })
    );
  };

  const clearEphemeralUserMessage = () => {
    ephemeralUserMessageIdRef.current = null;
  };

  const getModeDisplayName = () => {
    return mode === 'assisted' ? 'Assisted Mode' : 'Native Mode';
  };

  const getModeDescription = () => {
    return mode === 'assisted' 
      ? 'Getting explanations in English to help perfect your foreign language skills'
      : 'Full immersion practice in your target language';
  };

  return (
    <div className="container flex flex-col items-center justify-center mx-auto max-w-5xl mt-24 mb-12">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 mr-4 flex items-center"
          >
            ← Back
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">{getModeDisplayName()}</h1>
            <p className="text-muted-foreground">{getModeDescription()}</p>
          </div>
        </div>
      </div>

      <div className="w-full bg-card text-card-foreground rounded-xl border shadow-sm p-8 space-y-6">
        {error && (
          <div className="w-full p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="w-full max-w-xs">
            <label htmlFor="microphone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Microphone
            </label>
            <select
              id="microphone"
              value={selectedDevice}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
          
          {status && (
            <div className="flex items-center gap-2 px-4">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-muted-foreground">{status}</span>
            </div>
          )}
        </div>

        <button
          onClick={isSessionActive ? cleanup : startSession}
          className={`relative inline-flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50`}
        >
          <span className={`inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 py-1 text-base font-medium text-white backdrop-blur-3xl ${
            isSessionActive ? 'hover:bg-slate-800' : 'hover:bg-slate-900'
          }`}>
            {isSessionActive ? 'End Session' : 'Start Session'}
          </span>
        </button>

        <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto px-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`${
                  message.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                } max-w-[85%] rounded-lg px-6 py-3 text-base whitespace-pre-wrap`}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Loading component for Suspense fallback
const Loading = () => (
  <div className="container flex flex-col items-center justify-center mx-auto max-w-5xl mt-24 mb-12">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
      <p className="mt-4 text-gray-600">Loading conversation...</p>
    </div>
  </div>
);

// Wrapper component with Suspense boundary
const ConversationSessionPageWrapper = () => {
  return (
    <Suspense fallback={<Loading />}>
      <ConversationSessionPage />
    </Suspense>
  );
};

export default ConversationSessionPageWrapper; 