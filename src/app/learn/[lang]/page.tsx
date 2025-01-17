"use client"

import { useState } from 'react';
import { use } from 'react';
import { ApiService, ChatMessage, ChatResponse } from '@/lib/api-service';

interface LanguagePageProps {
  params: Promise<{
    lang: string;
  }>;
}

const languageMap: Record<string, string> = {
  'de': 'German',
  'pt': 'Portuguese',
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
}

export default function LanguagePage({ params }: LanguagePageProps) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const currentLanguage = languageMap[resolvedParams.lang] || 'English';
  
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer>({
    element: null,
    isPlaying: false
  });

  // Handle text submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    setError(null);

    // Add user message to chat history
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
      
      // Add assistant response to chat history
      const assistantEntry: ChatEntry = {
        type: 'assistant',
        message: result.response,
        audio_url: result.audio_url,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, assistantEntry]);
      setMessage('');
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
      
      // Add assistant response to chat history
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
    if (audioPlayer.element) {
      // Stop current audio if playing
      audioPlayer.element.pause();
      audioPlayer.element.currentTime = 0;
    }

    const audio = new Audio(audioUrl);
    audio.onplay = () => setAudioPlayer(prev => ({ ...prev, isPlaying: true }));
    audio.onpause = () => setAudioPlayer(prev => ({ ...prev, isPlaying: false }));
    audio.onended = () => setAudioPlayer(prev => ({ ...prev, isPlaying: false }));
    
    setAudioPlayer({ element: audio, isPlaying: false });
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      setError('Failed to play audio response');
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        {currentLanguage} Language Learning
      </h1>

      {/* Chat History */}
      <div className="mb-4 h-[60vh] overflow-y-auto bg-gray-50 rounded p-4">
        {chatHistory.map((entry, index) => (
          <div
            key={index}
            className={`mb-4 ${
              entry.type === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <div
              className={`inline-block p-3 rounded-lg ${
                entry.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              <pre className="whitespace-pre-wrap">{entry.message}</pre>
              {entry.audio_url && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleAudioPlayback(entry.audio_url!)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    {audioPlayer.isPlaying ? 'Pause' : 'Play'} Audio
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

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
        <input
          type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
            className="flex-1 p-2 border rounded"
            disabled={loading || isRecording}
          />
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`px-4 py-2 rounded ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            } text-white`}
            disabled={loading}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <button
            type="submit"
            disabled={loading || isRecording}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded">
          {error}
      </div>
      )}
    </div>
  );
}