"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { v4 as uuidv4 } from "uuid"

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

const ConversationPage = () => {
  const [status, setStatus] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string>("");
  const [activeLanguage, setActiveLanguage] = useState<string>("");
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
  }, [selectedDevice]); // Add selectedDevice as dependency

  useEffect(() => {
    fetchActiveLanguage();
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
  }, [getAudioDevices]); // Add getAudioDevices to dependencies

  const fetchActiveLanguage = async () => {
    try {
      const response = await fetch('/api/user/active-language');
      const data = await response.json();
      setActiveLanguage(data.activeLanguage);
    } catch (err) {
      console.error("Failed to fetch active language:", err);
      setError("Failed to fetch language settings");
    }
  };

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

  const getLanguageInstructions = (lang: string) => {
    const languageNames: { [key: string]: string } = {
      de: "German (Deutsch)",
      es: "Spanish (Español)",
      fr: "French (Français)",
      it: "Italian (Italiano)",
      // Add more languages as needed
    };

    const languageName = languageNames[lang] || lang.toUpperCase();
    
    return `You are a ${languageName} language learning assistant. Please:
    1. Speak ONLY in ${languageName}
    2. Correct any grammar or pronunciation mistakes I make
    3. Provide alternative phrases or expressions when appropriate
    4. Ask engaging questions to keep the conversation going
    5. Adjust your speaking pace to my level
    6. If I make a mistake, first acknowledge what I'm trying to say, then provide the correct form
    7. Focus our conversations on practical, everyday situations
    8. Start with a friendly greeting and ask about my ${languageName} learning goals
    9. Use common expressions and idioms, but explain them when introduced
    10. Occasionally ask me to rephrase my responses to practice different ways of expressing the same idea`;
  };

  const startSession = async () => {
    try {
      if (!activeLanguage) {
        throw new Error("No active language selected");
      }

      cleanup();
      setStatus("Initializing...");

      // Get session from OpenAI first
      const sessionResponse = await fetch("/api/openai-session", {
        method: "POST"
      });
      const sessionData = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(sessionData.error || "Failed to create session");

      console.log("Session data:", sessionData);

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
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

        // Send language learning context
        dc.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: getLanguageInstructions(activeLanguage)
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

      // Send SDP offer to OpenAI Realtime
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const response = await fetch(`${baseUrl}?model=${model}&voice=alloy`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${sessionData.api_key}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to establish WebRTC connection");
      }

      // Set remote description
      const answerSdp = await response.text();
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

  return (
    <div className="container flex flex-col items-center justify-center mx-auto max-w-5xl mt-24 mb-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Language Learning Assistant</h1>
        <p className="text-muted-foreground">Practice conversations and improve your language skills</p>
      </div>

      <div className="w-full bg-card text-card-foreground rounded-xl border shadow-sm p-8 space-y-6">
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
                } max-w-[85%] rounded-lg px-6 py-3 text-base`}
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

export default ConversationPage;