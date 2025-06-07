import { useEffect, useRef, useState, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface WebSocketHookProps {
  sessionId: string | null;
  apiKey: string | null;
  language: string;
  onMessage: (message: Message) => void;
  onError: (error: string) => void;
  onStatusChange: (status: string) => void;
}

export const useWebSocket = ({
  sessionId,
  apiKey: token,
  language,
  onMessage,
  onError,
  onStatusChange
}: WebSocketHookProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  const connect = useCallback(() => {
    try {
      if (!mountedRef.current) return;
      cleanup();

      console.log('Connecting to WebSocket with session:', sessionId);
      const ws = new WebSocket(
        `wss://api.openai.com/v1/audio/speech`,
        ["json"]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }

        console.log('WebSocket connected, sending auth...');
        ws.send(JSON.stringify({
          api_key: token
        }));

        onStatusChange("Connected");
        setIsConnected(true);
      };

      ws.onmessage = async (event) => {
        if (!mountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', data);
          
          if (data.type === 'error') {
            console.error('WebSocket error message:', data);
            onError(data.error?.message || 'Unknown error');
            return;
          }

          if (data.type === 'text') {
            onMessage({
              role: 'assistant',
              content: data.text
            });
            onStatusChange("");
          } else if (data.type === 'audio') {
            if (data.chunk && audioContextRef.current) {
              try {
                const audioData = new Uint8Array(atob(data.chunk).split('').map(c => c.charCodeAt(0)));
                const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.start();
              } catch (err) {
                console.error('Error playing audio:', err);
              }
            }
          }
        } catch (err) {
          console.error('Error processing message:', err);
        }
      };

      ws.onerror = (error) => {
        if (!mountedRef.current) return;
        console.error('WebSocket error:', error);
        onError('Connection error occurred');
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        console.log('WebSocket closed:', event);
        setIsConnected(false);
        if (!event.wasClean) {
          onError('Connection closed unexpectedly');
          if (mountedRef.current) {
            setTimeout(connect, 3000);
          }
        }
      };
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Connection error:', err);
      onError('Failed to establish connection');
      setIsConnected(false);
    }
  }, [sessionId, token, onStatusChange, onError, onMessage]);

  useEffect(() => {
    if (sessionId && token && mountedRef.current) {
      connect();
    }
    return () => cleanup();
  }, [sessionId, token, connect]);

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsConnected(false);
  };

  const startRecording = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({
          sampleRate: 16000
        });
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64Audio = btoa(reader.result as string);
            wsRef.current?.send(JSON.stringify({
              type: "audio",
              audio: base64Audio,
              model: "gpt-4o-mini-realtime-preview-2024-12-17",
              metadata: {
                language: language,
                timestamp: Date.now()
              }
            }));
          };
          reader.readAsBinaryString(event.data);
        }
      };

      mediaRecorder.start(100);
      onStatusChange("Recording started");
      return true;
    } catch (error) {
      console.error('Recording error:', error);
      onError('Failed to start recording');
      return false;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      onStatusChange("Processing...");
      return true;
    }
    return false;
  };

  return {
    isConnected,
    startRecording,
    stopRecording
  };
}; 