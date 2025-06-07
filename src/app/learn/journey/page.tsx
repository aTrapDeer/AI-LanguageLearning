"use client"

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
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

// Create sentence with blanks
type SentenceItem = 
  | { isBlank: true; index: number; word: string | null }
  | { isBlank: false; word: string };

// Fix for Vercel deployment - create a type guard for checking blank items
function isBlankItem(item: SentenceItem): item is { isBlank: true; index: number; word: string | null } {
  return item.isBlank === true;
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
  
  // Image state
  const [sentenceImageUrl, setSentenceImageUrl] = useState<string | null>(null)
  const [isLoadingImage, setIsLoadingImage] = useState(false)
  const [useDefaultImage, setUseDefaultImage] = useState(false)
  const [preloadedImages, setPreloadedImages] = useState<Record<number, string>>({})
  const [isPreloadingImages, setIsPreloadingImages] = useState(false)
  
  const DEFAULT_FALLBACK_IMAGE = 'https://placehold.co/400x200/EAEAEA/CCCCCC?text=Example+Image'

  // State persistence helpers
  const getStorageKey = (userId: string, language: string) => 
    `journey_state_${userId}_${language}`

  const saveJourneyState = () => {
    if (!session?.user?.id || !journey) return
    
    const stateToSave = {
      journey,
      currentRound,
      isTestMode,
      userProgress,
      journeyComplete,
      timestamp: Date.now(),
      preloadedImages
    }
    
    try {
      const storageKey = getStorageKey(session.user.id, lang)
      sessionStorage.setItem(storageKey, JSON.stringify(stateToSave))
      console.log('Journey state saved to sessionStorage')
    } catch (error) {
      console.warn('Failed to save journey state:', error)
    }
  }

  const loadJourneyState = (): boolean => {
    if (!session?.user?.id) return false
    
    try {
      const storageKey = getStorageKey(session.user.id, lang)
      const savedState = sessionStorage.getItem(storageKey)
      
      if (!savedState) return false
      
      const parsedState = JSON.parse(savedState)
      
      // Check if saved state is not too old (max 4 hours)
      const maxAge = 4 * 60 * 60 * 1000 // 4 hours in milliseconds
      if (Date.now() - parsedState.timestamp > maxAge) {
        console.log('Saved journey state is too old, creating new journey')
        sessionStorage.removeItem(storageKey)
        return false
      }
      
      // Validate that the saved journey has the expected structure
      if (!parsedState.journey || !parsedState.journey.rounds || !parsedState.journey.summaryTest) {
        console.log('Invalid saved journey structure, creating new journey')
        sessionStorage.removeItem(storageKey)
        return false
      }
      
      console.log('Restoring journey state from sessionStorage')
      setJourney(parsedState.journey)
      setCurrentRound(parsedState.currentRound || 0)
      setIsTestMode(parsedState.isTestMode || false)
      setUserProgress(parsedState.userProgress || null)
      setJourneyComplete(parsedState.journeyComplete || false)
      setPreloadedImages(parsedState.preloadedImages || {})
      
      return true
    } catch (error) {
      console.warn('Failed to load journey state:', error)
      return false
    }
  }

  const clearJourneyState = () => {
    if (!session?.user?.id) return
    
    try {
      const storageKey = getStorageKey(session.user.id, lang)
      sessionStorage.removeItem(storageKey)
      console.log('Journey state cleared from sessionStorage')
    } catch (error) {
      console.warn('Failed to clear journey state:', error)
    }
  }

  // Save state whenever key state changes
  useEffect(() => {
    if (journey && session?.user?.id) {
      saveJourneyState()
    }
  }, [journey, currentRound, isTestMode, journeyComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup handler for when component unmounts or user leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save final state before page unload
      if (journey && session?.user?.id) {
        saveJourneyState()
      }
    }

    const handleVisibilityChange = () => {
      // Save state when page becomes hidden
      if (document.visibilityState === 'hidden' && journey && session?.user?.id) {
        saveJourneyState()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [journey, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // We intentionally omit generateJourney from deps to prevent refetching on every render
  // as this would cause infinite loops and unnecessary API calls
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status === "authenticated" && session?.user?.id) {
      // Try to load existing journey state first
      const stateLoaded = loadJourneyState()
      
      if (stateLoaded) {
        setLoading(false)
        return
      }

      // If no saved state, fetch user progress and generate new journey
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
  }, [status, session?.user?.id, lang, router]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (showFeedback) return; // Don't allow changes after feedback is shown
    
    if (selectedWords.includes(word)) {
      // Remove word if already selected
      setSelectedWords(selectedWords.filter(w => w !== word))
    } else {
      // Add word to selected words
      setSelectedWords([...selectedWords, word])
    }
  }
  
  // Dedicated function to remove a word from the translation area
  const handleRemoveTranslationWord = (wordIndex: number) => {
    if (showFeedback) return; // Don't allow changes after feedback is shown
    
    // Remove word at specific index from the selectedWords array
    const wordToRemove = selectedWords[wordIndex];
    const updatedWords = [...selectedWords];
    updatedWords.splice(wordIndex, 1);
    setSelectedWords(updatedWords);
    console.log(`Removed word "${wordToRemove}" at index ${wordIndex}`);
  }

  // Handle option selection for missing word rounds
  const handleOptionClick = (option: string) => {
    setSelectedOption(option)
  }

  // Improved mobile-friendly word placement for multi-word exercises
  const handleWordPlacement = (word: string, blankIndex?: number) => {
    // If specific blank index provided, use it
    if (blankIndex !== undefined) {
      // If blank is already filled, swap the words
      if (filledWords[blankIndex]) {
        // Add the displaced word back to available words
        setAvailableWords(prev => [...prev, filledWords[blankIndex]!])
      }
      
      // Update filledWords array
      const newFilledWords = [...filledWords]
      newFilledWords[blankIndex] = word
      setFilledWords(newFilledWords)
      
      // Remove word from available options
      setAvailableWords(prev => prev.filter(w => w !== word))
    } else {
      // Find first empty blank and place word there
      const emptyIndex = filledWords.findIndex(w => w === null)
      if (emptyIndex !== -1) {
        handleWordPlacement(word, emptyIndex)
      }
    }
  }

  // Handle word drag start for multi-word exercises
  const handleDragStart = (word: string) => {
    setIsDragging(word)
  }

  // Handle word drop for multi-word exercises
  const handleDrop = (blankIndex: number) => {
    if (!isDragging) return
    
    handleWordPlacement(isDragging, blankIndex)
    
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
    setSentenceImageUrl(null)
    setIsLoadingImage(false)
    setUseDefaultImage(false)
    
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

  // Enhanced function to generate and optionally store images
  const generateSentenceImage = async (sentence: string, options?: { storeForRound?: number }) => {
    if (!sentence) return null;
    
    const storeForRound = options?.storeForRound;
    const isPreloading = storeForRound !== undefined;
    
    if (!isPreloading) {
      setIsLoadingImage(true);
      setSentenceImageUrl(null); // Reset any previous image
      setUseDefaultImage(false);
    }
    
    try {
      // Create a visual-focused prompt using the complete sentence
      // Clean the sentence by removing any placeholder blanks
      const cleanSentence = sentence.replace(/____/g, '').replace(/\s+/g, ' ').trim();
      
      // Create a visual-focused prompt using the full sentence context
      const visualPrompt = `A simple, clean illustration showing: ${cleanSentence}. Do NOT include any text or words in the image. Create a visual scene only.`;
      
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: visualPrompt, 
          model: "dall-e-3",
          size: "1024x1024"
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        throw new Error('Invalid response from image generation API');
      }
      
      let resultUrl = null;
      
      if (!response.ok) {
        console.error(`Image generation failed with status ${response.status}:`, data?.error || 'Unknown error');
        
        // Check if we got a fallback URL from the API even on error
        if (data?.url) {
          console.log('Using fallback image URL from API error response');
          resultUrl = data.url;
          if (data.fallback && !isPreloading) {
            setUseDefaultImage(true);
          }
        } else {
          console.log('Using default fallback image due to API error');
          resultUrl = DEFAULT_FALLBACK_IMAGE;
          if (!isPreloading) {
            setUseDefaultImage(true);
          }
        }
      } else if (data?.url) {
        console.log(`Received image URL from API (fallback: ${data.fallback || false})`);
        resultUrl = data.url;
        if (data.fallback && !isPreloading) {
          setUseDefaultImage(true);
        }
      } else {
        console.log('No URL in response, using default fallback image');
        resultUrl = DEFAULT_FALLBACK_IMAGE;
        if (!isPreloading) {
          setUseDefaultImage(true);
        }
      }
      
      // Store the result
      if (isPreloading && storeForRound !== undefined && resultUrl) {
        console.log(`Storing preloaded image for round ${storeForRound}`);
        setPreloadedImages(prev => ({...prev, [storeForRound]: resultUrl}));
      } else if (resultUrl) {
        setSentenceImageUrl(resultUrl);
      }
      
      return resultUrl;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Image generation request timed out');
      } else {
        console.error('Error generating image:', error);
      }
      
      const fallbackUrl = DEFAULT_FALLBACK_IMAGE;
      
      if (isPreloading && storeForRound !== undefined) {
        console.log(`Storing fallback image for round ${storeForRound} due to error`);
        setPreloadedImages(prev => ({...prev, [storeForRound]: fallbackUrl}));
      } else {
        setSentenceImageUrl(fallbackUrl);
        setUseDefaultImage(true);
      }
      
      return fallbackUrl;
    } finally {
      if (!isPreloading) {
        setIsLoadingImage(false);
      }
    }
  };
  
  // Function to preload all images for better UX
  const preloadAllImages = async () => {
    if (!journey || isPreloadingImages) return;
    
    console.log("Starting to preload images for all rounds...");
    setIsPreloadingImages(true);
    
    try {
      // Identify all rounds that need images
      const imageGenerationTasks: { sentence: string, roundIndex: number }[] = [];
      
      // Regular rounds
      journey.rounds.forEach((round, index) => {
        if (round.type === 'missing_word') {
          let completeSentence = '';
          
          if ('missingWordIndices' in round && round.missingWordIndices && round.correctWords) {
            // Multi-word format
            const words = round.sentence.split(' ');
            const completeWords = [...words];
            
            // Deduplicate correct words
            const correctWordsDeduped: string[] = [];
            round.correctWords.forEach(word => {
              const alreadyUsedCount = correctWordsDeduped.filter(w => w === word).length;
              const totalNeededCount = round.correctWords.filter(w => w === word).length;
              
              if (alreadyUsedCount < totalNeededCount) {
                correctWordsDeduped.push(word);
              }
            });
            
            // Create complete sentence
            round.missingWordIndices.forEach((wordIndex, i) => {
              if (i < correctWordsDeduped.length) {
                completeWords[wordIndex] = correctWordsDeduped[i];
              }
            });
            
            completeSentence = completeWords.join(' ');
          } else if ('missingWordIndex' in round && typeof round.missingWordIndex === 'number' && round.correctWord) {
            // Legacy single-word format
            const words = round.sentence.split(' ');
            const completeWords = [...words];
            completeWords[round.missingWordIndex] = round.correctWord;
            completeSentence = completeWords.join(' ');
          }
          
          if (completeSentence) {
            imageGenerationTasks.push({ sentence: completeSentence, roundIndex: index });
          }
        }
      });
      
      // Test rounds (with offset to avoid collisions)
      journey.summaryTest.forEach((round, index) => {
        if (round.type === 'missing_word') {
          let completeSentence = '';
          
          if ('missingWordIndices' in round && round.missingWordIndices && round.correctWords) {
            // Multi-word format
            const words = round.sentence.split(' ');
            const completeWords = [...words];
            
            // Deduplicate correct words
            const correctWordsDeduped: string[] = [];
            round.correctWords.forEach(word => {
              const alreadyUsedCount = correctWordsDeduped.filter(w => w === word).length;
              const totalNeededCount = round.correctWords.filter(w => w === word).length;
              
              if (alreadyUsedCount < totalNeededCount) {
                correctWordsDeduped.push(word);
              }
            });
            
            // Create complete sentence
            round.missingWordIndices.forEach((wordIndex, i) => {
              if (i < correctWordsDeduped.length) {
                completeWords[wordIndex] = correctWordsDeduped[i];
              }
            });
            
            completeSentence = completeWords.join(' ');
          } else if ('missingWordIndex' in round && typeof round.missingWordIndex === 'number' && round.correctWord) {
            // Legacy single-word format
            const words = round.sentence.split(' ');
            const completeWords = [...words];
            completeWords[round.missingWordIndex] = round.correctWord;
            completeSentence = completeWords.join(' ');
          }
          
          if (completeSentence) {
            // Use an offset of 1000 for test rounds to avoid conflict with regular rounds
            imageGenerationTasks.push({ sentence: completeSentence, roundIndex: 1000 + index });
          }
        }
      });
      
      console.log(`Found ${imageGenerationTasks.length} rounds requiring images`);
      
      // Process in small batches to avoid rate limiting
      const BATCH_SIZE = 3;
      for (let i = 0; i < imageGenerationTasks.length; i += BATCH_SIZE) {
        const batch = imageGenerationTasks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(task => 
            generateSentenceImage(task.sentence, { storeForRound: task.roundIndex })
          )
        );
        
        // Add a small delay between batches
        if (i + BATCH_SIZE < imageGenerationTasks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`Successfully preloaded ${Object.keys(preloadedImages).length} images`);
    } catch (error) {
      console.error("Error during image preloading:", error);
    } finally {
      setIsPreloadingImages(false);
    }
  };
  
  // Preload images when journey is loaded
  useEffect(() => {
    if (journey && !loading && !isPreloadingImages) {
      preloadAllImages();
    }
  }, [journey, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // We intentionally omit getRoundData and initializeMultiWordExercise from deps
  // to prevent re-initializing exercises on every render
  useEffect(() => {
    if (loading || !journey) return
    
    const roundData = getRoundData()
    if (roundData?.type === 'missing_word' && 'missingWordIndices' in roundData) {
      initializeMultiWordExercise(roundData as MissingWordRound)
    }
  }, [currentRound, isTestMode, journey, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Start preloading images once journey is loaded
  useEffect(() => {
    if (journey && !loading) {
      preloadAllImages();
    }
  }, [journey, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Initialize the multi-word exercise state
  const initializeMultiWordExercise = (round: MissingWordRound) => {
    if (!round.missingWordIndices || !round.correctWords) return
    
    // Create a copy of the options array
    let options = [...round.options];
    
    // Remove duplicates from options
    options = Array.from(new Set(options));
    
    // Get all words from the sentence
    const words = round.sentence.split(' ');
    
    // Get the words that are being removed (the missing words)
    const wordsToRemove = round.missingWordIndices.map(index => words[index]);
    
    // Get words that will remain in the sentence (non-missing words)
    const remainingWords = words.filter((word, index) => !round.missingWordIndices.includes(index));
    
    // Clean up remaining words (remove punctuation for comparison)
    const cleanRemainingWords = remainingWords.map(word => 
      word.replace(/[.,!?;:]$/g, '').toLowerCase().trim()
    );
    
    // Deduplicate correct words while maintaining order
    const correctWordsDeduped: string[] = [];
    round.correctWords.forEach(word => {
      // Only add if it's not already in the array or if it's needed for a duplicate position
      const alreadyUsedCount = correctWordsDeduped.filter(w => w === word).length;
      const totalNeededCount = round.correctWords.filter(w => w === word).length;
      
      if (alreadyUsedCount < totalNeededCount) {
        correctWordsDeduped.push(word);
      }
    });
    
    // Ensure each correct word appears exactly once in the options
    const uniqueCorrectWords = Array.from(new Set([...correctWordsDeduped]));
    
    // Filter out distractors that:
    // 1. Already appear in the remaining sentence text
    // 2. Are duplicates of correct words
    // 3. Are case-insensitive matches of remaining words
    const distractors = options.filter(word => {
      const cleanWord = word.replace(/[.,!?;:]$/g, '').toLowerCase().trim();
      
      // Don't include if it's already a correct word
      if (uniqueCorrectWords.some(correctWord => 
        correctWord.toLowerCase().trim() === cleanWord
      )) {
        return false;
      }
      
      // Don't include if it already appears in the remaining sentence
      if (cleanRemainingWords.includes(cleanWord)) {
        return false;
      }
      
      // Don't include if it's one of the words being removed (but not a correct answer)
      if (wordsToRemove.some(removedWord => 
        removedWord.replace(/[.,!?;:]$/g, '').toLowerCase().trim() === cleanWord
      ) && !uniqueCorrectWords.some(correctWord => 
        correctWord.toLowerCase().trim() === cleanWord
      )) {
        return false;
      }
      
      return true;
    });
    
    // Remove any duplicates that might still exist in distractors
    const uniqueDistractors = Array.from(new Set(distractors));
    
    // Combine correct words with distractors
    const finalOptions = [...uniqueCorrectWords, ...uniqueDistractors];
    
    // Ensure we have enough options but not too many (minimum 3, maximum 8)
    const minOptions = Math.max(3, uniqueCorrectWords.length);
    const maxOptions = 8;
    const limitedOptions = finalOptions.slice(0, Math.min(maxOptions, Math.max(minOptions, finalOptions.length)));
    
    // If we don't have enough options after filtering, add some back
    if (limitedOptions.length < minOptions) {
      console.warn(`Not enough options for missing word exercise. Adding fallback options.`);
      // Add some random words from the original options that weren't included
      const fallbackOptions = options.filter(word => !limitedOptions.includes(word));
      const additionalNeeded = minOptions - limitedOptions.length;
      limitedOptions.push(...fallbackOptions.slice(0, additionalNeeded));
    }
    
    shuffleArray(limitedOptions);
    
    setFilledWords(Array(round.missingWordIndices.length).fill(null));
    setAvailableWords(limitedOptions);
    
    // Check if we have a preloaded image for this round
    const roundIndex = isTestMode ? 1000 + currentRound : currentRound;
    if (preloadedImages[roundIndex]) {
      console.log(`Using preloaded image for round ${roundIndex}`);
      setSentenceImageUrl(preloadedImages[roundIndex]);
      setIsLoadingImage(false);
    } else {
      // Generate image for the complete sentence if preloaded image not available
      // Reconstruct the complete sentence by replacing the blanks with the correct words
      const completeWords = [...words];
      round.missingWordIndices.forEach((index, i) => {
        if (i < correctWordsDeduped.length) {
          completeWords[index] = correctWordsDeduped[i];
        }
      });
      const completeSentence = completeWords.join(' ');
      console.log("Generating image for complete sentence:", completeSentence);
      generateSentenceImage(completeSentence);
    }
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
                clearJourneyState()
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
        
        <div className="relative w-full max-w-3xl mx-auto mt-8 md:mt-20 p-4 md:p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
          <div className="text-sm mb-4">
            {isTestMode ? 'Summary Test' : 'Journey'} - Round {currentRound + 1} of {isTestMode ? journey.summaryTest.length : journey.rounds.length}
          </div>
          
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Match the Translation</h2>
          
          <div className="mb-6 md:mb-8">
            <p className="text-base md:text-lg mb-2">English:</p>
            <div className="p-3 md:p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm md:text-base">
              {englishSentence}
            </div>
          </div>
          
          <div className="mb-6 md:mb-8">
            <p className="text-base md:text-lg mb-2">Translation:</p>
            <div className="flex flex-wrap gap-2 p-3 md:p-4 min-h-16 bg-gray-100 dark:bg-zinc-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700">
              {selectedWords.map((word, i) => (
                <button 
                  key={i} 
                  className="min-h-10 px-3 py-2 bg-blue-100 dark:bg-blue-900 rounded-md shadow-sm animate-bounce-in cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800 active:bg-blue-300 dark:active:bg-blue-700 relative group transition-all touch-manipulation select-none text-sm md:text-base" 
                  onClick={() => handleRemoveTranslationWord(i)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleRemoveTranslationWord(i);
                  }}
                  type="button"
                  disabled={showFeedback}
                  title="Tap to remove this word"
                >
                  {word}
                  {!showFeedback && (
                    <span className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      ×
                    </span>
                  )}
                </button>
              ))}
            </div>
            {selectedWords.length === 0 && (
              <div className="text-center text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2">
                Tap words below to build your translation
              </div>
            )}
            {!showFeedback && selectedWords.length > 0 && (
              <div className="text-center text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2">
                <span className="inline-flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Tap on a word to remove it
                </span>
              </div>
            )}
            {showFeedback && !isCorrect && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Correct translation: {translatedSentence}
              </div>
            )}
          </div>
          
          <div className="mb-6 md:mb-8">
            <p className="text-base md:text-lg mb-2">Available Words:</p>
            <div className="flex flex-wrap gap-2">
              {words.map((word, i) => (
                <button
                  key={i}
                  onClick={() => handleWordClick(word)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    if (!selectedWords.includes(word) && !showFeedback) {
                      handleWordClick(word);
                    }
                  }}
                  disabled={selectedWords.includes(word) || showFeedback}
                  type="button"
                  className={`min-h-10 px-3 py-2 rounded-md transition-all touch-manipulation select-none text-sm md:text-base ${
                    selectedWords.includes(word)
                      ? 'opacity-50 bg-gray-200 dark:bg-zinc-700 cursor-not-allowed'
                      : 'bg-white dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900 active:bg-blue-100 dark:active:bg-blue-800 shadow-sm cursor-pointer border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
          
          {showFeedback ? (
            <div className={`p-3 md:p-4 rounded-lg mb-4 md:mb-6 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
              {isCorrect ? (
                <p className="text-base md:text-lg font-medium">Great job! That&apos;s correct!</p>
              ) : (
                <div>
                  <p className="text-base md:text-lg font-medium mb-3">Not quite right. Try again!</p>
                  <Button onClick={handleRetry} className="min-h-12 touch-manipulation">Retry</Button>
                </div>
              )}
            </div>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={selectedWords.length === 0}
              className="w-full min-h-12 touch-manipulation text-base"
              type="button"
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
      // Multi-word format with improved mobile interface
      const multiWordRound = roundData as MissingWordRound
      const sentence = multiWordRound.sentence || '';
      const missingWordIndices = multiWordRound.missingWordIndices || [];
      const correctWords = multiWordRound.correctWords || [];
      
      // Create sentence with blanks
      const words = sentence.split(' ');
      const sentenceWithBlanks: SentenceItem[] = words.map((word, i) => {
        if (missingWordIndices.includes(i)) {
          const blankIndex = missingWordIndices.indexOf(i);
          return {
            isBlank: true,
            index: blankIndex,
            word: filledWords[blankIndex] || null
          };
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
          
          <div className="relative w-full max-w-3xl mx-auto mt-8 md:mt-20 p-4 md:p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
            <div className="text-sm mb-4">
              {isTestMode ? 'Summary Test' : 'Journey'} - Round {currentRound + 1} of {isTestMode ? journey.summaryTest.length : journey.rounds.length}
            </div>
            
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Fill in the Missing Words</h2>
            
            {sentenceImageUrl && (
              <div className="mb-4 md:mb-6 flex justify-center">
                <div className="relative max-w-full">
                  <Image 
                    src={sentenceImageUrl} 
                    alt="Visual representation of the sentence" 
                    width={400}
                    height={200}
                    style={{ objectFit: 'contain', maxHeight: '10rem', width: 'auto' }}
                    className={`rounded-lg shadow-md max-w-full h-auto ${useDefaultImage ? 'opacity-70' : ''}`}
                    unoptimized={true}
                    onError={(e) => {
                      console.error("Image failed to load");
                      // Use a fallback image
                      const imgElement = e.currentTarget as HTMLImageElement;
                      imgElement.src = DEFAULT_FALLBACK_IMAGE;
                      setUseDefaultImage(true);
                    }}
                  />
                  {useDefaultImage && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 pointer-events-none">
                      Example image not available
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {isLoadingImage && (
              <div className="mb-4 md:mb-6 flex justify-center items-center h-32 md:h-48 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
                  <p className="text-sm md:text-base">Generating image...</p>
                </div>
              </div>
            )}
            
            <div className="mb-4 text-center text-xs md:text-sm text-gray-500 dark:text-gray-400">
              Tap the words below to fill in the blanks
            </div>
            
            <div className="mb-6 md:mb-8">
              <div className="flex flex-wrap gap-1 md:gap-2 p-3 md:p-4 mb-4 md:mb-6 text-center text-base md:text-lg leading-relaxed">
                {sentenceWithBlanks.map((item, i) => (
                  isBlankItem(item) ? (
                    <button 
                      key={i}
                      onClick={() => {
                        if (item.word) {
                          handleRemoveWord(item.index);
                        }
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        if (item.word) {
                          handleRemoveWord(item.index);
                        }
                      }}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={() => handleDrop(item.index)}
                      type="button"
                      className={`inline-flex items-center justify-center min-w-16 md:min-w-20 min-h-10 md:h-10 px-2 md:px-3 border-2 ${
                        item.word 
                          ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800 active:bg-blue-300 dark:active:bg-blue-700' 
                          : 'border-dashed border-gray-400 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
                      } rounded-md mx-1 transition-all touch-manipulation select-none text-sm md:text-base`}
                    >
                      {item.word || '_____'}
                    </button>
                  ) : (
                    <div key={i} className="inline-flex items-center mx-1 text-sm md:text-base">
                      {item.word}
                    </div>
                  )
                ))}
              </div>
              
              <div className="mb-6">
                <p className="text-base md:text-lg mb-3">Available Words:</p>
                <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3 mt-4">
                  {availableWords.map((word, i) => (
                    <button
                      key={i}
                      draggable
                      onDragStart={() => handleDragStart(word)}
                      onClick={() => handleWordPlacement(word)}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleWordPlacement(word);
                      }}
                      type="button"
                      className="min-h-12 px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/40 transition-all touch-manipulation select-none text-sm md:text-base"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {showFeedback ? (
              <div className={`p-3 md:p-4 rounded-lg mb-4 md:mb-6 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                {isCorrect ? (
                  <p className="text-base md:text-lg font-medium">Great job! That&apos;s correct!</p>
                ) : (
                  <div>
                    <p className="text-base md:text-lg font-medium mb-2">Not quite right. The correct placement is:</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {correctWords.map((word, i) => (
                        <span key={i} className="inline-block px-2 py-1 bg-white dark:bg-zinc-800 rounded-md text-sm md:text-base">
                          <span className="font-bold">{word}</span>
                        </span>
                      ))}
                    </div>
                    <Button onClick={handleRetry} className="min-h-12 touch-manipulation">Retry</Button>
                  </div>
                )}
              </div>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={filledWords.some(word => word === null)}
                className="w-full min-h-12 touch-manipulation text-base"
                type="button"
              >
                Submit
              </Button>
            )}
          </div>
        </div>
      );
    } else {
      // Legacy single-word format with improved mobile interface
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
          
          <div className="relative w-full max-w-3xl mx-auto mt-8 md:mt-20 p-4 md:p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
            <div className="text-sm mb-4">
              {isTestMode ? 'Summary Test' : 'Journey'} - Round {currentRound + 1} of {isTestMode ? journey.summaryTest.length : journey.rounds.length}
            </div>
            
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Fill in the Missing Word</h2>
            
            <div className="mb-4 text-center text-xs md:text-sm text-gray-500 dark:text-gray-400">
              Tap the correct word to complete the sentence
            </div>
            
            <div className="mb-6 md:mb-8">
              <p className="text-base md:text-lg mb-4 text-center font-medium leading-relaxed">{sentenceWithBlank}</p>
              
              {selectedOption && (
                <div className="flex justify-center mb-4">
                  <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-md shadow-sm animate-bounce-in text-base md:text-lg">
                    {selectedOption}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-6 md:mt-8">
                {options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionClick(option)}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      if (!showFeedback) {
                        handleOptionClick(option);
                      }
                    }}
                    disabled={showFeedback}
                    type="button"
                    className={`min-h-12 md:min-h-14 px-4 py-3 rounded-md transition-all text-base md:text-lg touch-manipulation select-none ${
                      selectedOption === option 
                        ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500 dark:border-blue-400' 
                        : 'bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 active:bg-gray-200 dark:active:bg-zinc-600 border border-gray-200 dark:border-gray-700'
                    } shadow-sm`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            
            {showFeedback ? (
              <div className={`p-3 md:p-4 rounded-lg mb-4 md:mb-6 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                {isCorrect ? (
                  <p className="text-base md:text-lg font-medium">Great job! That&apos;s correct!</p>
                ) : (
                  <div>
                    <p className="text-base md:text-lg font-medium mb-2">Not quite right. The correct answer is: <span className="font-bold">{correctWord}</span></p>
                    <Button onClick={handleRetry} className="min-h-12 touch-manipulation">Retry</Button>
                  </div>
                )}
              </div>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={!selectedOption}
                className="w-full min-h-12 touch-manipulation text-base"
                type="button"
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
        
        <div className="relative w-full max-w-3xl mx-auto mt-8 md:mt-20 p-4 md:p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
          <div className="text-sm mb-4">
            {isTestMode ? 'Summary Test' : 'Journey'} - Round {currentRound + 1} of {isTestMode ? journey.summaryTest.length : journey.rounds.length}
          </div>
          
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Spell the Word</h2>
          
          <div className="mb-6 md:mb-8">
            <p className="text-base md:text-lg mb-2">English Word:</p>
            <div className="p-3 md:p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg text-center text-lg md:text-xl">
              {englishWord}
            </div>
          </div>
          
          <div className="mb-6 md:mb-8">
            <p className="text-base md:text-lg mb-2">Your Answer:</p>
            <input
              type="text"
              value={spellingInput}
              onChange={handleSpellingChange}
              disabled={showFeedback}
              placeholder="Type the word in the target language"
              className="w-full min-h-12 p-3 text-base md:text-lg border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
              autoFocus
            />
          </div>
          
          {showFeedback && (
            <div className={`p-3 md:p-4 rounded-lg mb-4 md:mb-6 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
              {isCorrect ? (
                <div>
                  <p className="text-base md:text-lg font-medium">Great job!</p>
                  {showCorrectAnswer && (
                    <p className="mt-2">The exact spelling is: <span className="font-bold">{correctSpelling}</span></p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-base md:text-lg font-medium mb-2">Not quite right.</p>
                  {showCorrectAnswer && (
                    <p className="mb-4">The correct spelling is: <span className="font-bold">{correctSpelling}</span></p>
                  )}
                  <Button onClick={handleRetry} className="min-h-12 touch-manipulation">Retry</Button>
                </div>
              )}
            </div>
          )}
          
          {!showFeedback && (
            <Button 
              onClick={handleSubmit} 
              disabled={spellingInput.trim() === ''}
              className="w-full min-h-12 touch-manipulation text-base"
              type="button"
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