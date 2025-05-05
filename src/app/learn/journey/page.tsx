"use client"

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation'
import { getProgress, createProgress } from "@/lib/supabase-db"
import { Button } from "@/components/ui/button"

// Types for the different round types
type MatchingRound = {
  type: 'matching'
  englishSentence: string
  translatedSentence: string
  words: string[]
}

// New multiple missing words format
type MissingWordRound = {
  type: 'missing_word'
  sentence: string
  missingWordIndices: number[]
  correctWords: string[]
  options: string[]
  isSingleWord?: boolean
}

// Legacy single missing word format
interface LegacyMissingWordRound {
  type: 'missing_word'
  sentence: string
  missingWordIndex: number
  correctWord: string
  options: string[]
}

type SpellingRound = {
  type: 'spelling'
  englishWord: string
  correctSpelling: string
}

// Support both formats
type Round = MatchingRound | MissingWordRound | SpellingRound | LegacyMissingWordRound

// The complete journey structure
type Journey = {
  language: string
  level: number
  rounds: Round[]
  summaryTest: Round[]
}

// Type for user progress from database
type UserProgress = {
  id: string
  user_id: string
  language: string
  level: number
  xp: number
  created_at: string
  updated_at: string
}

function JourneyPageContent() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const lang = searchParams.get('lang') || 'en'
  
  const [loading, setLoading] = useState(true)
  const [journey, setJourney] = useState<Journey | null>(null)
  const [currentRound, setCurrentRound] = useState(0)
  const [isTestMode, setIsTestMode] = useState(false)
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  
  // UI states
  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [spellingInput, setSpellingInput] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false)
  const [journeyComplete, setJourneyComplete] = useState(false)
  
  // New state for multi-word exercises
  const [filledWords, setFilledWords] = useState<(string | null)[]>([])
  const [availableWords, setAvailableWords] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState<string | null>(null)

  // We intentionally omit generateJourney from deps to prevent refetching on every render
  // as this would cause infinite loops and unnecessary API calls
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status === "authenticated" && session?.user?.id) {
      const fetchUserProgress = async () => {
        try {
          console.log(`Fetching progress for user ${session.user.id} and language ${lang}`)
          
          // Check for proper user ID
          if (!session.user.id) {
            console.error("User ID is missing in the session")
            generateJourney(lang, 1)
            return
          }
          
          // Supabase expects user_id, not userId - make sure the correct field is used
          const progress = await getProgress(session.user.id, lang)
          console.log("Progress data received:", progress)
          
          if (progress) {
            setUserProgress(progress)
            // Make sure we use level from the progress data
            generateJourney(lang, progress.level || 1)
          } else {
            // If no progress data found, create a new progress entry for this user/language
            console.log("No progress found, creating entry with default level 1")
            try {
              // Create initial progress record for this language if it doesn't exist
              await createProgress({
                userId: session.user.id,
                language: lang,
                level: 1,
                xp: 0
              })
              
              // Start with level 1
              generateJourney(lang, 1)
            } catch (createError) {
              console.error("Error creating progress entry:", createError)
              generateJourney(lang, 1)
            }
          }
        } catch (error) {
          console.error("Error fetching user progress:", error)
          // Log more details about the error
          if (error instanceof Error) {
            console.error("Error name:", error.name)
            console.error("Error message:", error.message)
            console.error("Error stack:", error.stack)
          }
          // Default to level 1 if error
          generateJourney(lang, 1)
        }
      }

      fetchUserProgress()
    }
  }, [status, session, lang, router]) // eslint-disable-line react-hooks/exhaustive-deps

  // Generate the journey content based on user's level
  const generateJourney = async (language: string, level: number) => {
    setLoading(true)
    try {
      console.log(`Generating journey for language ${language} at level ${level}`)
      
      const response = await fetch('/api/journey/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language, level }),
      })

      if (!response.ok) {
        console.error(`API error (${response.status})`)
        throw new Error(`Failed to generate journey: ${response.status}`)
      }

      const data = await response.json()
      
      // Validate journey data
      if (!data || !data.rounds || !Array.isArray(data.rounds) || data.rounds.length === 0) {
        console.error('Invalid journey data received: missing or empty rounds array')
        throw new Error('Invalid journey data structure')
      }
      
      if (!data.summaryTest || !Array.isArray(data.summaryTest) || data.summaryTest.length === 0) {
        console.error('Invalid journey data received: missing or empty summaryTest array')
        throw new Error('Invalid journey data structure')
      }
      
      console.log(`Journey successfully generated with ${data.rounds.length} rounds and ${data.summaryTest.length} test rounds`)
      setJourney(data)
    } catch (error) {
      console.error("Error generating journey:", error)
      
      // Create fallback journey
      createFallbackJourney(language, level)
    } finally {
      setLoading(false)
    }
  }

  // Create a simple fallback journey in case of API errors
  const createFallbackJourney = (language: string, level: number) => {
    console.log("Creating fallback journey due to API errors")
    
    // Create a more language-agnostic fallback
    const fallback: Journey = {
      language,
      level,
      rounds: [
        {
          type: 'matching',
          englishSentence: 'Hello, how are you?',
          translatedSentence: `Hello in ${language}`,
          words: [`Hello`, `in`, `${language}`]
        },
        {
          type: 'missing_word',
          sentence: 'Simple sentence with a missing word',
          missingWordIndex: 2,
          correctWord: 'missing',
          options: ['missing', 'table', 'chair', 'blue'] // Exactly 4 options
        } as LegacyMissingWordRound,
        {
          type: 'spelling',
          englishWord: 'book',
          correctSpelling: 'book'
        }
      ],
      summaryTest: [
        {
          type: 'matching',
          englishSentence: 'Thank you very much',
          translatedSentence: `Thank you in ${language}`,
          words: [`Thank`, `you`, `in`, `${language}`]
        }
      ]
    }
    
    // For known languages, provide better fallbacks
    if (language === 'de') {
      // Update matching round
      const matchingRound = fallback.rounds[0] as MatchingRound;
      matchingRound.translatedSentence = 'Hallo, wie geht es dir?';
      matchingRound.words = ['Hallo,', 'wie', 'geht', 'es', 'dir?'];
      
      // Update missing word round
      const missingWordRound = fallback.rounds[1] as LegacyMissingWordRound;
      missingWordRound.sentence = 'Ich trinke gerne Kaffee am Morgen';
      missingWordRound.missingWordIndex = 2;
      missingWordRound.correctWord = 'gerne';
      missingWordRound.options = ['gerne', 'Schlüssel', 'Fenster', 'rot'];
      
      // Update spelling round
      const spellingRound = fallback.rounds[2] as SpellingRound;
      spellingRound.correctSpelling = 'Buch';
      
      // Update test round
      const testRound = fallback.summaryTest[0] as MatchingRound;
      testRound.translatedSentence = 'Vielen Dank';
      testRound.words = ['Vielen', 'Dank'];
    } else if (language === 'es') {
      // Update matching round
      const matchingRound = fallback.rounds[0] as MatchingRound;
      matchingRound.translatedSentence = '¡Hola! ¿Cómo estás?';
      matchingRound.words = ['¡Hola!', '¿Cómo', 'estás?'];
      
      // Update missing word round
      const missingWordRound = fallback.rounds[1] as LegacyMissingWordRound;
      missingWordRound.sentence = 'Me gusta tomar café por la mañana';
      missingWordRound.missingWordIndex = 2;
      missingWordRound.correctWord = 'tomar';
      missingWordRound.options = ['tomar', 'puerta', 'casa', 'verde'];
      
      // Update spelling round
      const spellingRound = fallback.rounds[2] as SpellingRound;
      spellingRound.correctSpelling = 'libro';
      
      // Update test round
      const testRound = fallback.summaryTest[0] as MatchingRound;
      testRound.translatedSentence = 'Muchas gracias';
      testRound.words = ['Muchas', 'gracias'];
    } else if (language === 'fr') {
      // Update matching round
      const matchingRound = fallback.rounds[0] as MatchingRound;
      matchingRound.translatedSentence = 'Bonjour, comment ça va?';
      matchingRound.words = ['Bonjour,', 'comment', 'ça', 'va?'];
      
      // Update missing word round
      const missingWordRound = fallback.rounds[1] as LegacyMissingWordRound;
      missingWordRound.sentence = "J'aime boire du café le matin";
      missingWordRound.missingWordIndex = 2;
      missingWordRound.correctWord = 'boire';
      missingWordRound.options = ['boire', 'fenêtre', 'chaise', 'jaune'];
      
      // Update spelling round
      const spellingRound = fallback.rounds[2] as SpellingRound;
      spellingRound.correctSpelling = 'livre';
      
      // Update test round
      const testRound = fallback.summaryTest[0] as MatchingRound;
      testRound.translatedSentence = 'Merci beaucoup';
      testRound.words = ['Merci', 'beaucoup'];
    }
    
    // Randomize the word order for matching rounds
    fallback.rounds.forEach(round => {
      if (round.type === 'matching' && Array.isArray(round.words)) {
        shuffleArray(round.words);
      }
    });
    
    fallback.summaryTest.forEach(round => {
      if (round.type === 'matching' && Array.isArray(round.words)) {
        shuffleArray(round.words);
      }
    });
    
    setJourney(fallback);
  }
  
  // Fisher-Yates shuffle algorithm
  const shuffleArray = <T,>(array: T[]): void => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Handle word selection for matching rounds
  const handleWordClick = (word: string) => {
    if (selectedWords.includes(word)) {
      // Remove word if already selected
      setSelectedWords(selectedWords.filter(w => w !== word))
    } else {
      // Add word to selected words
      setSelectedWords([...selectedWords, word])
    }
  }

  // Handle option selection for missing word rounds
  const handleOptionClick = (option: string) => {
    setSelectedOption(option)
  }

  // Handle word drag start for multi-word exercises
  const handleDragStart = (word: string) => {
    setIsDragging(word)
  }

  // Handle word drop for multi-word exercises
  const handleDrop = (blankIndex: number) => {
    if (!isDragging) return
    
    // Update filledWords array
    const newFilledWords = [...filledWords]
    newFilledWords[blankIndex] = isDragging
    setFilledWords(newFilledWords)
    
    // Remove word from available options
    setAvailableWords(availableWords.filter(word => word !== isDragging))
    
    // Reset dragging state
    setIsDragging(null)
  }

  // Handle removing a word from a blank
  const handleRemoveWord = (blankIndex: number) => {
    if (!filledWords[blankIndex]) return
    
    // Add word back to available options
    setAvailableWords([...availableWords, filledWords[blankIndex]!])
    
    // Remove word from filled words
    const newFilledWords = [...filledWords]
    newFilledWords[blankIndex] = null
    setFilledWords(newFilledWords)
  }

  // Handle spelling input
  const handleSpellingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpellingInput(e.target.value)
  }

  // Handle submission of current round
  const handleSubmit = () => {
    if (!journey) return

    const currentRoundData = getRoundData()
    if (!currentRoundData) return

    let correct = false

    switch (currentRoundData.type) {
      case 'matching': {
        // Check if selected words match the correct order
        const matchingRound = currentRoundData as MatchingRound
        if (!matchingRound.translatedSentence) {
          console.error("Missing translatedSentence in matching round data")
          setIsCorrect(false)
          setShowFeedback(true)
          return
        }
        const correctWords = matchingRound.translatedSentence.split(' ')
        correct = selectedWords.length === correctWords.length && 
          selectedWords.every((word, i) => word === correctWords[i])
        break
      }
      case 'missing_word': {
        // Handle both multi-word and legacy single-word formats
        if ('missingWordIndices' in currentRoundData) {
          // Multi-word format
          const multiWordRound = currentRoundData as MissingWordRound
          if (!multiWordRound.correctWords || !Array.isArray(multiWordRound.correctWords)) {
            console.error("Missing correctWords in missing word round data")
            setIsCorrect(false)
            setShowFeedback(true)
            return
          }
          
          // Check if all blanks are filled
          if (filledWords.some(word => word === null)) {
            correct = false
          } else {
            // Check if all words match their expected positions
            correct = filledWords.every((word, i) => word === multiWordRound.correctWords[i])
          }
        } else if ('missingWordIndex' in currentRoundData) {
          // Legacy single-word format
          const legacyRound = currentRoundData as LegacyMissingWordRound
          if (!legacyRound.correctWord) {
            console.error("Missing correctWord in missing word round data")
            setIsCorrect(false)
            setShowFeedback(true)
            return
          }
          correct = selectedOption === legacyRound.correctWord
        } else {
          console.error("Invalid missing word round data structure")
          setIsCorrect(false)
          setShowFeedback(true)
          return
        }
        break
      }
      case 'spelling': {
        // Allow for some flexibility in spelling (case insensitive, trim whitespace)
        const spellingRound = currentRoundData as SpellingRound
        if (!spellingRound.correctSpelling) {
          console.error("Missing correctSpelling in spelling round data")
          setIsCorrect(false)
          setShowFeedback(true)
          return
        }
        const userInput = spellingInput.trim().toLowerCase()
        const correctAnswer = spellingRound.correctSpelling.trim().toLowerCase()
        
        // Check for exact match or close match
        if (userInput === correctAnswer) {
          correct = true
        } else if (userInput.length > 0 && calculateSimilarity(userInput, correctAnswer) > 0.8) {
          // If it's close enough, mark as correct but show the proper spelling
          correct = true
          setShowCorrectAnswer(true)
        } else {
          correct = false
          setShowCorrectAnswer(true)
        }
        break
      }
    }

    setIsCorrect(correct)
    setShowFeedback(true)

    // If correct, move to next round after a short delay
    if (correct) {
      setTimeout(() => {
        moveToNextRound()
      }, 1500)
    }
  }

  // Calculate string similarity for spelling tolerance
  const calculateSimilarity = (a: string, b: string): number => {
    if (a.length === 0) return 0
    if (b.length === 0) return 0
    
    // Simple Levenshtein distance calculation
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null))
    
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        )
      }
    }
    
    // Return similarity as a number between 0 and 1
    return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length)
  }

  // Move to next round
  const moveToNextRound = () => {
    setShowFeedback(false)
    setIsCorrect(false)
    setShowCorrectAnswer(false)
    setSelectedWords([])
    setSelectedOption(null)
    setSpellingInput('')
    setFilledWords([])
    setAvailableWords([])
    setIsDragging(null)
    
    const maxRounds = isTestMode 
      ? journey!.summaryTest.length
      : journey!.rounds.length
    
    if (currentRound + 1 < maxRounds) {
      setCurrentRound(currentRound + 1)
    } else if (!isTestMode) {
      // If regular rounds are done, move to test mode
      setIsTestMode(true)
      setCurrentRound(0)
    } else {
      // If test mode is also done, journey is complete
      setJourneyComplete(true)
    }
  }

  // Retry the current round
  const handleRetry = () => {
    setShowFeedback(false)
    setSelectedWords([])
    setSelectedOption(null)
    setSpellingInput('')
    setShowCorrectAnswer(false)
    
    // Reset multi-word exercise state if needed
    const currentRoundData = getRoundData();
    if (currentRoundData?.type === 'missing_word' && 'missingWordIndices' in currentRoundData) {
      initializeMultiWordExercise(currentRoundData as MissingWordRound)
    }
  }

  // Get current round data
  const getRoundData = () => {
    if (!journey) return null
    return isTestMode 
      ? journey.summaryTest[currentRound]
      : journey.rounds[currentRound]
  }

  // We intentionally omit getRoundData and initializeMultiWordExercise from deps
  // to prevent re-initializing exercises on every render
  useEffect(() => {
    if (loading || !journey) return
    
    const roundData = getRoundData()
    if (roundData?.type === 'missing_word' && 'missingWordIndices' in roundData) {
      initializeMultiWordExercise(roundData as MissingWordRound)
    }
  }, [currentRound, isTestMode, journey, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize the multi-word exercise state
  const initializeMultiWordExercise = (round: MissingWordRound) => {
    if (!round.missingWordIndices || !round.correctWords) return
    
    // Create a copy of the options array and shuffle it
    const shuffledOptions = [...round.options]
    shuffleArray(shuffledOptions)
    setFilledWords(Array(round.missingWordIndices.length).fill(null))
    setAvailableWords(shuffledOptions)
  }

  // Render loading state
  if (loading || !journey) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Preparing your language journey...</div>
      </div>
    )
  }

  // Render journey complete state
  if (journeyComplete) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
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
        <div className="relative max-w-lg mx-auto p-8 bg-white dark:bg-zinc-900 rounded-lg shadow-xl text-center animate-fade-in">
          <h1 className="text-3xl font-bold mb-4">Journey Complete!</h1>
          <p className="text-lg mb-6">Congratulations! You&apos;ve completed your language journey for today.</p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setJourneyComplete(false)
                setIsTestMode(false)
                setCurrentRound(0)
                generateJourney(lang, userProgress?.level || 1)
              }}
            >
              Start New Journey
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Get current round data
  const roundData = getRoundData()
  if (!roundData) return null;

  // Render matching round
  if (roundData.type === 'matching') {
    const matchingRound = roundData as MatchingRound;
    // Add defensive check to ensure words array exists
    const words = matchingRound.words || [];
    const englishSentence = matchingRound.englishSentence || '';
    const translatedSentence = matchingRound.translatedSentence || '';

    return (
      <div className="relative min-h-screen flex flex-col items-center p-4">
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
        
        <div className="relative w-full max-w-3xl mx-auto mt-20 p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
          <div className="text-sm mb-4">
            {isTestMode ? 'Summary Test' : 'Journey'} - Round {currentRound + 1} of {isTestMode ? journey.summaryTest.length : journey.rounds.length}
          </div>
          
          <h2 className="text-2xl font-bold mb-6">Match the Translation</h2>
          
          <div className="mb-8">
            <p className="text-lg mb-2">English:</p>
            <div className="p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg">
              {englishSentence}
            </div>
          </div>
          
          <div className="mb-8">
            <p className="text-lg mb-2">Translation:</p>
            <div className="flex flex-wrap gap-2 p-4 min-h-16 bg-gray-100 dark:bg-zinc-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700">
              {selectedWords.map((word, i) => (
                <div key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-md shadow-sm animate-bounce-in">
                  {word}
                </div>
              ))}
            </div>
            {showFeedback && !isCorrect && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Correct translation: {translatedSentence}
              </div>
            )}
          </div>
          
          <div className="mb-8">
            <p className="text-lg mb-2">Available Words:</p>
            <div className="flex flex-wrap gap-2">
              {words.map((word, i) => (
                <button
                  key={i}
                  onClick={() => handleWordClick(word)}
                  disabled={selectedWords.includes(word) || showFeedback}
                  className={`px-3 py-1 rounded-md transition-all ${
                    selectedWords.includes(word)
                      ? 'opacity-50 bg-gray-200 dark:bg-zinc-700'
                      : 'bg-white dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900 shadow-sm'
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
          
          {showFeedback ? (
            <div className={`p-4 rounded-lg mb-6 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
              {isCorrect ? (
                <p className="text-lg font-medium">Great job! That&apos;s correct!</p>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">Not quite right. Try again!</p>
                  <Button onClick={handleRetry}>Retry</Button>
                </div>
              )}
            </div>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={selectedWords.length === 0}
              className="w-full"
            >
              Submit
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Render missing word round
  if (roundData.type === 'missing_word') {
    // Handle both multi-word and legacy single-word formats
    if ('missingWordIndices' in roundData) {
      // Multi-word format with drag and drop interface
      const multiWordRound = roundData as MissingWordRound
      const sentence = multiWordRound.sentence || '';
      const missingWordIndices = multiWordRound.missingWordIndices || [];
      const correctWords = multiWordRound.correctWords || [];
      
      // Create sentence with blanks
      const words = sentence.split(' ');
      const sentenceWithBlanks = words.map((word, i) => {
        if (missingWordIndices.includes(i)) {
          const blankIndex = missingWordIndices.indexOf(i);
          return { isBlank: true, index: blankIndex, word: filledWords[blankIndex] || null };
        }
        return { isBlank: false, word };
      });

      return (
        <div className="relative min-h-screen flex flex-col items-center p-4">
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
          
          <div className="relative w-full max-w-3xl mx-auto mt-20 p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
            <div className="text-sm mb-4">
              {isTestMode ? 'Summary Test' : 'Journey'} - Round {currentRound + 1} of {isTestMode ? journey.summaryTest.length : journey.rounds.length}
            </div>
            
            <h2 className="text-2xl font-bold mb-6">Fill in the Missing Words</h2>
            
            <div className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Drag the words to the correct positions in the sentence
            </div>
            
            <div className="mb-8">
              <div className="flex flex-wrap gap-2 p-4 mb-6 text-center text-lg">
                {sentenceWithBlanks.map((item, i) => (
                  item.isBlank ? (
                    <div 
                      key={i}
                      onClick={() => {
                        if (item.word && item.index !== undefined) {
                          handleRemoveWord(item.index);
                        }
                      }}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={() => {
                        if (item.index !== undefined) {
                          handleDrop(item.index);
                        }
                      }}
                      className={`inline-flex items-center justify-center min-w-20 h-10 px-2 border-2 ${
                        item.word 
                          ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 cursor-pointer' 
                          : 'border-dashed border-gray-400 dark:border-gray-600'
                      } rounded-md`}
                    >
                      {item.word || '______'}
                    </div>
                  ) : (
                    <div key={i} className="inline-flex items-center">
                      {item.word}
                    </div>
                  )
                ))}
              </div>
              
              <div className="mb-6">
                <p className="text-lg mb-2">Available Words:</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  {availableWords.map((word, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => handleDragStart(word)}
                      onClick={() => {
                        // Find first empty blank and place word there
                        const emptyIndex = filledWords.findIndex(w => w === null);
                        if (emptyIndex !== -1) handleDrop(emptyIndex);
                      }}
                      className="px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm cursor-move hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      {word}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {showFeedback ? (
              <div className={`p-4 rounded-lg mb-6 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                {isCorrect ? (
                  <p className="text-lg font-medium">Great job! That&apos;s correct!</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">Not quite right. The correct placement is:</p>
                    {correctWords.map((word, i) => (
                      <span key={i} className="inline-block mr-2 mb-2 px-2 py-1 bg-white dark:bg-zinc-800 rounded-md">
                        <span className="font-bold">{word}</span>
                        {i < correctWords.length - 1 ? " " : ""}
                      </span>
                    ))}
                    <div className="mt-4">
                      <Button onClick={handleRetry}>Retry</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={filledWords.some(word => word === null)}
                className="w-full"
              >
                Submit
              </Button>
            )}
          </div>
        </div>
      );
    } else {
      // Legacy single-word format
      const legacyRound = roundData as LegacyMissingWordRound
      const sentence = legacyRound.sentence || '';
      const missingWordIndex = typeof legacyRound.missingWordIndex === 'number' ? legacyRound.missingWordIndex : 0;
      const correctWord = legacyRound.correctWord || '';
      const options = legacyRound.options || [];
      
      // Create sentence with blank
      const words = sentence.split(' ');
      if (words.length > missingWordIndex) {
        words[missingWordIndex] = '______';
      }
      const sentenceWithBlank = words.join(' ');

      return (
        <div className="relative min-h-screen flex flex-col items-center p-4">
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
          
          <div className="relative w-full max-w-3xl mx-auto mt-20 p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
            <div className="text-sm mb-4">
              {isTestMode ? 'Summary Test' : 'Journey'} - Round {currentRound + 1} of {isTestMode ? journey.summaryTest.length : journey.rounds.length}
            </div>
            
            <h2 className="text-2xl font-bold mb-6">Fill in the Missing Word</h2>
            
            <div className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Select the correct word to complete the sentence
            </div>
            
            <div className="mb-8">
              <p className="text-lg mb-4 text-center font-medium">{sentenceWithBlank}</p>
              
              {selectedOption && (
                <div className="flex justify-center mb-4">
                  <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-md shadow-sm animate-bounce-in text-lg">
                    {selectedOption}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 mt-8">
                {options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionClick(option)}
                    disabled={showFeedback}
                    className={`px-4 py-3 rounded-md transition-all text-lg ${
                      selectedOption === option 
                        ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500 dark:border-blue-400' 
                        : 'bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 border border-gray-200 dark:border-gray-700'
                    } shadow-sm`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            
            {showFeedback ? (
              <div className={`p-4 rounded-lg mb-6 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                {isCorrect ? (
                  <p className="text-lg font-medium">Great job! That&apos;s correct!</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">Not quite right. The correct answer is: <span className="font-bold">{correctWord}</span></p>
                    <Button onClick={handleRetry}>Retry</Button>
                  </div>
                )}
              </div>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={!selectedOption}
                className="w-full"
              >
                Submit
              </Button>
            )}
          </div>
        </div>
      )
    }
  }

  // Render spelling round
  if (roundData.type === 'spelling') {
    const spellingRound = roundData as SpellingRound;
    const englishWord = spellingRound.englishWord || '';
    const correctSpelling = spellingRound.correctSpelling || '';
    
    return (
      <div className="relative min-h-screen flex flex-col items-center p-4">
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
        
        <div className="relative w-full max-w-3xl mx-auto mt-20 p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
          <div className="text-sm mb-4">
            {isTestMode ? 'Summary Test' : 'Journey'} - Round {currentRound + 1} of {isTestMode ? journey.summaryTest.length : journey.rounds.length}
          </div>
          
          <h2 className="text-2xl font-bold mb-6">Spell the Word</h2>
          
          <div className="mb-8">
            <p className="text-lg mb-2">English Word:</p>
            <div className="p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg text-center text-xl">
              {englishWord}
            </div>
          </div>
          
          <div className="mb-8">
            <p className="text-lg mb-2">Your Answer:</p>
            <input
              type="text"
              value={spellingInput}
              onChange={handleSpellingChange}
              disabled={showFeedback}
              placeholder="Type the word in the target language"
              className="w-full p-3 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
          
          {showFeedback && (
            <div className={`p-4 rounded-lg mb-6 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
              {isCorrect ? (
                <div>
                  <p className="text-lg font-medium">Great job!</p>
                  {showCorrectAnswer && (
                    <p className="mt-2">The exact spelling is: <span className="font-bold">{correctSpelling}</span></p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">Not quite right.</p>
                  {showCorrectAnswer && (
                    <p className="mb-4">The correct spelling is: <span className="font-bold">{correctSpelling}</span></p>
                  )}
                  <Button onClick={handleRetry}>Retry</Button>
                </div>
              )}
            </div>
          )}
          
          {!showFeedback && (
            <Button 
              onClick={handleSubmit} 
              disabled={spellingInput.trim() === ''}
              className="w-full"
            >
              Submit
            </Button>
          )}
        </div>
      </div>
    )
  }

  return null
}

// Main component wrapped with Suspense
export default function JourneyPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading journey...</div>}>
      <JourneyPageContent />
    </Suspense>
  )
} 