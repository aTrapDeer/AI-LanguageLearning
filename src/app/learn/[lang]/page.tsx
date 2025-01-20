"use client"

import { useState, useRef, useEffect } from 'react';
import { ApiService, ChatMessage } from '@/lib/api-service';
import { AIInputWithLoading } from '@/components/ui/ai-input-with-loading';

interface LanguagePageProps {
  params: {
    lang: string;
  };
}

const languageMap: Record<string, string> = {
  'de': 'German',
  'pt-BR': 'Portuguese (Brazilian)',
  'zh': 'Chinese',
  'no': 'Norwegian',
  'en': 'English'
};

interface ChatEntry {
  type: 'user' | 'assistant';
  message: string;
  audio_url?: string;
  timestamp: Date;
}

interface AudioPlayer {
  element: HTMLAudioElement | null;
  isPlaying: boolean;
  currentAudioUrl: string | null;
}

export default function LanguagePage({ params }: LanguagePageProps) {
  const currentLanguage = languageMap[params.lang] || 'English';
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer>({
    element: null,
    isPlaying: false,
    currentAudioUrl: null
  });

  const handleSubmit = async (message: string) => {
    if (!message.trim()) return;
    
    setLoading(true);
    setError(null);

    const userEntry: ChatEntry = {
      type: 'user',
      message: message,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, userEntry]);

    try {
      const chatMessage: ChatMessage = {
        message,
        language: currentLanguage
      };

      const result = await ApiService.sendMessage(chatMessage);
      
      const assistantEntry: ChatEntry = {
        type: 'assistant',
        message: result.response,
        audio_url: result.audio_url,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, assistantEntry]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  // Handle voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await handleAudioSubmission(audioBlob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      setError('Failed to access microphone');
      console.error('Microphone error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleAudioSubmission = async (audioBlob: Blob) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', currentLanguage);

      const result = await ApiService.sendAudio(formData);
      
      const assistantEntry: ChatEntry = {
        type: 'assistant',
        message: result.response,
        audio_url: result.audio_url,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, assistantEntry]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
    } finally {
      setLoading(false);
    }
  };

  const handleAudioPlayback = (audioUrl: string) => {
    // If there's a current audio playing and it's the same URL
    if (audioPlayer.element && audioPlayer.currentAudioUrl === audioUrl) {
      if (audioPlayer.isPlaying) {
        audioPlayer.element.pause();
      } else {
        audioPlayer.element.play();
      }
      return;
    }

    // If there's a different audio playing, stop it
    if (audioPlayer.element) {
      audioPlayer.element.pause();
      audioPlayer.element.currentTime = 0;
    }

    const audio = new Audio(audioUrl);
    audio.onplay = () => setAudioPlayer(prev => ({ ...prev, isPlaying: true }));
    audio.onpause = () => setAudioPlayer(prev => ({ ...prev, isPlaying: false }));
    audio.onended = () => setAudioPlayer(prev => ({ 
      ...prev, 
      isPlaying: false,
      currentAudioUrl: null 
    }));
    
    setAudioPlayer({ 
      element: audio, 
      isPlaying: false,
      currentAudioUrl: audioUrl 
    });
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      setError('Failed to play audio response');
    });
  };

  // Add this function to handle scrolling
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Update useEffect to scroll when chat history changes
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">
          {currentLanguage} Language Learning
        </h1>
      </div>

      {/* Chat History */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
        {chatHistory.map((entry, index) => (
          <div
            key={index}
            className={`mb-4 ${
              entry.type === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <div
              className={`inline-block p-4 rounded-2xl max-w-[80%] ${
                entry.type === 'user'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 text-black dark:text-white'
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans">{entry.message}</pre>
              {entry.audio_url && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleAudioPlayback(entry.audio_url!)}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                  >
                    {audioPlayer.currentAudioUrl === entry.audio_url && audioPlayer.isPlaying ? 'Pause' : 'Play'} Audio
                  </button>
                </div>
              )}
              <div className="text-xs mt-1 opacity-70">
                {entry.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed Input Area */}
      <div className="border-t p-4 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto flex gap-2 items-end">
          <div className="flex-1">
            {error && (
              <div className="mb-2 text-sm text-red-500">
                {error}
              </div>
            )}
            <AIInputWithLoading
              onSubmit={handleSubmit}
              placeholder="Type your message..."
              loadingDuration={2000}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm"
            />
          </div>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-4 rounded-full shadow-sm transition-all ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-indigo-500 hover:bg-indigo-600'
            } text-white`}
            disabled={loading}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isRecording ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              )}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}