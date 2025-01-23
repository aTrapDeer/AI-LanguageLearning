"use client"

import { useState, useRef, useEffect, use } from 'react';
import { ApiService, ChatMessage } from '@/lib/api-service';
import { AIInputWithLoading } from '@/components/ui/ai-input-with-loading';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

interface LanguagePageProps {
  params: Promise<{ lang: string }>;
}

const validLanguageCodes = ['en', 'de', 'pt-BR', 'zh', 'no'] as const;
type LanguageCode = typeof validLanguageCodes[number];

type SupportedLanguage = 'English' | 'German' | 'Portuguese (Brazilian)' | 'Chinese' | 'Norwegian';

const languageMap: Record<LanguageCode, SupportedLanguage> = {
  'en': 'English',
  'de': 'German',
  'pt-BR': 'Portuguese (Brazilian)',
  'zh': 'Chinese',
  'no': 'Norwegian'
} as const;

function isValidLanguageCode(code: string): code is LanguageCode {
  return validLanguageCodes.includes(code as LanguageCode);
}

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
  const resolvedParams = use(params);
  const languageCode = isValidLanguageCode(resolvedParams.lang) ? resolvedParams.lang : 'en';
  const currentLanguage: SupportedLanguage = languageMap[languageCode];
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>(currentLanguage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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

  // Fetch active language from the database
  useEffect(() => {
    const fetchActiveLanguage = async () => {
      try {
        const response = await fetch('/api/user/active-language');
        if (response.ok) {
          const data = await response.json();
          if (data.activeLanguage && isValidLanguageCode(data.activeLanguage)) {
            setActiveLanguage(languageMap[data.activeLanguage as LanguageCode]);
          }
        }
      } catch (error) {
        console.error('Error fetching active language:', error);
      }
    };

    fetchActiveLanguage();
  }, []);

  // Add debug logging
  useEffect(() => {
    console.log('Language Code:', languageCode);
    console.log('Current Language:', currentLanguage);
  }, [languageCode, currentLanguage]);

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
      // Log the request
      console.log('Sending chat message with language:', activeLanguage);
      
      const chatMessage: ChatMessage = {
        message,
        language: activeLanguage // Use the active language from database
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
      console.error('Chat error:', err);
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
      formData.append('language', activeLanguage); // Use the active language from database

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
    <div className="flex flex-col min-h-screen max-h-screen">
      {/* Header - Smaller on mobile, regular on desktop */}
      <div className="flex items-center justify-between p-2 md:p-4 border-b bg-background h-12 md:h-16">
        <h1 className="text-lg md:text-2xl font-bold truncate">
          {activeLanguage} Learning
        </h1>
        <div className="flex items-center gap-2">
          {/* Mobile menu */}
          <div className="md:hidden relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            {mobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 py-2 bg-white dark:bg-gray-800 rounded-md shadow-lg border z-50">
                <Link 
                  href="/dashboard"
                  className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Back to Home
                </Link>
                <button
                  onClick={() => signOut()}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Back to Home</Link>
            </Button>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat History - Add padding top for first message */}
        <div 
          ref={chatContainerRef} 
          className="flex-1 overflow-y-auto px-2 md:px-4 py-3 md:py-6 space-y-3 md:space-y-6"
        >
          {/* Add a spacer div for mobile */}
          <div className="h-2 md:h-0" aria-hidden="true" />
          
          {chatHistory.map((entry, index) => (
            <div
              key={index}
              className={`${
                entry.type === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block p-2 md:p-4 rounded-2xl max-w-[85%] md:max-w-[80%] text-sm md:text-base ${
                  entry.type === 'user'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-black dark:text-white'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{entry.message}</pre>
                {entry.audio_url && (
                  <div className="mt-1 md:mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleAudioPlayback(entry.audio_url!)}
                      className="px-2 md:px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs md:text-sm"
                    >
                      {audioPlayer.currentAudioUrl === entry.audio_url && audioPlayer.isPlaying ? 'Pause' : 'Play'} Audio
                    </button>
                  </div>
                )}
                <div className="text-[10px] md:text-xs mt-1 opacity-70">
                  {entry.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area - More space on mobile */}
        <div className="border-t bg-white dark:bg-gray-900 p-2 md:p-4 w-full">
          <div className="max-w-5xl mx-auto flex gap-2 items-end">
            <div className="flex-1">
              {error && (
                <div className="mb-2 text-xs md:text-sm text-red-500">
                  {error}
                </div>
              )}
              <AIInputWithLoading
                onSubmit={handleSubmit}
                placeholder="Type your message..."
                loadingDuration={2000}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm min-h-[44px] md:min-h-[inherit]"
              />
            </div>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-3 md:p-4 rounded-full shadow-sm transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-indigo-500 hover:bg-indigo-600'
              } text-white`}
              disabled={loading}
            >
              <svg
                className="w-5 h-5 md:w-6 md:h-6"
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
    </div>
  );
}