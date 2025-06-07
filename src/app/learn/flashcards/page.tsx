'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type FlashcardWord = {
  word: string;
  translation: string;
  context?: string;
};

type FlashcardData = {
  language: string;
  level: number;
  words: FlashcardWord[];
};

export default function FlashcardsPage() {
  const searchParams = useSearchParams();
  const { selectedLanguage } = useLanguage();
  const { data: session, status } = useSession();
  const router = useRouter();

  // State management
  const [flashcardData, setFlashcardData] = useState<FlashcardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [startWithEnglish, setStartWithEnglish] = useState(false);
  const [progress, setProgress] = useState<Record<number, 'known' | 'unknown'>>({});
  const [sessionComplete, setSessionComplete] = useState(false);
  const [userLevel, setUserLevel] = useState<number>(3); // Default to level 3
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);

  // Get language from URL params or context
  const langParam = searchParams.get('lang');
  const currentLanguage = selectedLanguage?.code || langParam || 'de';

  const generateFlashcards = useCallback(async (level?: number) => {
    setLoading(true);
    const actualLevel = level || userLevel;
    console.log(`🎯 Generating flashcards for ${currentLanguage} at level ${actualLevel}`);
    try {
      const response = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: currentLanguage,
          level: actualLevel, // Use provided level or user's current level
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate flashcards');
      }

      const data = await response.json();
      setFlashcardData(data);
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowAnswer(false);
      setProgress({});
      setSessionComplete(false);
      setIsAnimating(false);
      setAnimatingOut(false);
    } catch (error) {
      console.error('Error generating flashcards:', error);
    }
    setLoading(false);
  }, [currentLanguage, userLevel]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      const fetchUserProgressAndGenerateFlashcards = async () => {
        try {
          console.log(`🔍 Fetching progress for language: ${currentLanguage}`);
          // Fetch user's progress for the current language
          const progressResponse = await fetch(`/api/user/progress/check?language=${currentLanguage}`);
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            if (progressData.exists && progressData.progress) {
              console.log(`✅ User progress found - Level: ${progressData.progress.level} for ${currentLanguage}`);
              setUserLevel(progressData.progress.level);
              generateFlashcards(progressData.progress.level);
              return;
            }
          }
          // If no progress found or error, use default level
          console.log(`⚠️ No progress found for ${currentLanguage}, using default level: ${userLevel}`);
          generateFlashcards(userLevel);
        } catch (error) {
          console.error('Error fetching user progress:', error);
          console.log(`🔄 Using default level: ${userLevel} due to error`);
          generateFlashcards(userLevel);
        }
      };

      fetchUserProgressAndGenerateFlashcards();
    }
  }, [session, currentLanguage, userLevel, generateFlashcards]);

  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
    setShowAnswer(true);
  };

  const handleAnswer = (known: boolean) => {
    if (isAnimating) return; // Prevent multiple clicks during animation
    
    setProgress({
      ...progress,
      [currentIndex]: known ? 'known' : 'unknown'
    });
    
    if (currentIndex < (flashcardData?.words.length || 0) - 1) {
      setIsAnimating(true);
      setAnimatingOut(true);
      setShowAnswer(false);
      
      // After slide-out animation completes, move to next card
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
        setAnimatingOut(false);
        setIsAnimating(false);
      }, 500); // 500ms for slide-out animation
    } else {
      setSessionComplete(true);
    }
  };

  const resetSession = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowAnswer(false);
    setProgress({});
    setSessionComplete(false);
    setIsAnimating(false);
    setAnimatingOut(false);
  };

  const getStats = () => {
    const total = Object.keys(progress).length;
    const known = Object.values(progress).filter(p => p === 'known').length;
    const unknown = total - known;
    return { total, known, unknown };
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Generating your flashcards...</p>
        </div>
      </div>
    );
  }

  if (!flashcardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-700 mb-4">Failed to load flashcards</p>
          <button
            onClick={() => generateFlashcards()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const stats = getStats();
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="max-w-md mx-auto pt-20">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Session Complete!</h2>
              <p className="text-gray-600">Great job practicing your vocabulary!</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.known}</div>
                <div className="text-sm text-gray-600">Known</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.unknown}</div>
                <div className="text-sm text-gray-600">Review</div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={resetSession}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium"
              >
                Review This Set
              </button>
              <button
                onClick={() => generateFlashcards()}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium"
              >
                New Set
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = flashcardData.words[currentIndex];
  const progressPercent = Math.round(((currentIndex + 1) / flashcardData.words.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Flashcards</h1>
          <p className="text-gray-600">
            Card {currentIndex + 1} of {flashcardData.words.length}
          </p>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Language toggle */}
        <div className="flex items-center justify-center mb-6">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={startWithEnglish}
              onChange={(e) => setStartWithEnglish(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-700">
              Start with English
            </span>
          </label>
        </div>

        {/* Card Stack */}
        <div className="relative w-full h-80 mb-6">
          {/* Background stack cards */}
          {[...Array(Math.min(3, (flashcardData?.words.length || 0) - currentIndex - 1))].map((_, index) => (
            <div
              key={currentIndex + index + 1}
              className="absolute w-full h-full rounded-2xl shadow-lg bg-white border border-gray-200 card-stack-item"
              style={{
                transform: `translateY(${(index + 1) * 8}px) scale(${1 - (index + 1) * 0.03})`,
                zIndex: 10 - index,
                opacity: 0.8 - index * 0.2
              }}
            />
          ))}
          
          {/* Main active card */}
          <div 
            className={`relative w-full h-full cursor-pointer transition-all duration-500 ${
              animatingOut 
                ? 'transform -translate-y-full opacity-0' 
                : 'transform translate-y-0 opacity-100'
            }`}
            style={{ zIndex: 20 }}
            onClick={handleFlipCard}
          >
            <div className={`relative w-full h-full transition-transform duration-300 transform-style-preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front of card */}
              <div className="absolute w-full h-full backface-hidden bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center p-6 border-2 border-gray-100">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-800 mb-4">
                    {startWithEnglish ? currentCard.translation : currentCard.word}
                  </div>
                  {currentCard.context && !startWithEnglish && (
                    <div className="text-sm text-gray-600 italic mb-4">
                      {currentCard.context}
                    </div>
                  )}
                  <div className="mt-6 text-sm text-gray-500">
                    Tap to flip
                  </div>
                </div>
              </div>

              {/* Back of card */}
              <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-6 text-white rotate-y-180">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-4">
                    {startWithEnglish ? currentCard.word : currentCard.translation}
                  </div>
                  {currentCard.context && startWithEnglish && (
                    <div className="text-sm opacity-90 italic">
                      {currentCard.context}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Answer buttons */}
        {showAnswer && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-center text-gray-700 font-medium mb-4">
              Did you know it?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAnswer(false)}
                className="bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-medium shadow-lg active:scale-95 transition-all"
              >
                <div className="text-lg">❌</div>
                <div>No</div>
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className="bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-medium shadow-lg active:scale-95 transition-all"
              >
                <div className="text-lg">✅</div>
                <div>Yes</div>
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 bg-white rounded-xl p-4 shadow-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-gray-800">{Object.keys(progress).length}</div>
              <div className="text-sm text-gray-600">Reviewed</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {Object.values(progress).filter(p => p === 'known').length}
              </div>
              <div className="text-sm text-gray-600">Known</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-600">
                {Object.values(progress).filter(p => p === 'unknown').length}
              </div>
              <div className="text-sm text-gray-600">Learning</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Card stack animations */
        .card-slide-up {
          animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        @keyframes slideUp {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-120%) scale(0.8);
            opacity: 0;
          }
        }
        
        /* Smooth card stack transitions */
        .card-stack-item {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
} 