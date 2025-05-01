"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, Check, Languages, Star, Trophy, Sparkles, Brain, BookOpen } from "lucide-react"

// Available languages with their icon colors
const LANGUAGES = [
  { value: "es", label: "Spanish", emoji: "🇪🇸", color: "bg-red-50 border-red-200 hover:bg-red-100" },
  { value: "fr", label: "French", emoji: "🇫🇷", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { value: "de", label: "German", emoji: "🇩🇪", color: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100" },
  { value: "it", label: "Italian", emoji: "🇮🇹", color: "bg-green-50 border-green-200 hover:bg-green-100" },
  { value: "pt", label: "Portuguese", emoji: "🇵🇹", color: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" },
  { value: "ru", label: "Russian", emoji: "🇷🇺", color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100" },
  { value: "zh", label: "Chinese", emoji: "🇨🇳", color: "bg-red-50 border-red-200 hover:bg-red-100" },
  { value: "ja", label: "Japanese", emoji: "🇯🇵", color: "bg-pink-50 border-pink-200 hover:bg-pink-100" },
  { value: "ko", label: "Korean", emoji: "🇰🇷", color: "bg-purple-50 border-purple-200 hover:bg-purple-100" },
  { value: "ar", label: "Arabic", emoji: "🇸🇦", color: "bg-teal-50 border-teal-200 hover:bg-teal-100" },
]

// Proficiency levels with engaging descriptions and visuals
const PROFICIENCY_LEVELS = [
  { 
    value: "1", 
    label: "Just Starting", 
    description: "Know little to nothing", 
    icon: BookOpen,
    color: "bg-blue-50 border-blue-200",
    activeColor: "bg-blue-100 border-blue-300",
    emoji: "🌱"
  },
  { 
    value: "2", 
    label: "Beginner", 
    description: "Understand some basics", 
    icon: Brain,
    color: "bg-green-50 border-green-200",
    activeColor: "bg-green-100 border-green-300",
    emoji: "🚀"
  },
  { 
    value: "3", 
    label: "Intermediate", 
    description: "Can hold basic conversations", 
    icon: Star,
    color: "bg-yellow-50 border-yellow-200",
    activeColor: "bg-yellow-100 border-yellow-300",
    emoji: "🔆"
  },
  { 
    value: "4", 
    label: "Advanced", 
    description: "Comfortable but not yet fluent", 
    icon: Trophy,
    color: "bg-orange-50 border-orange-200",
    activeColor: "bg-orange-100 border-orange-300",
    emoji: "🏆"
  },
  { 
    value: "5", 
    label: "Fluent", 
    description: "Can handle complex conversations", 
    icon: Sparkles,
    color: "bg-purple-50 border-purple-200",
    activeColor: "bg-purple-100 border-purple-300",
    emoji: "✨"
  }
]

export function AccountSetup({ userId }: { userId: string }) {
  const router = useRouter()
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [activeLanguage, setActiveLanguage] = useState<string>("")
  const [proficiencyLevels, setProficiencyLevels] = useState<Record<string, string>>({})
  const [currentLanguageIndex, setCurrentLanguageIndex] = useState<number>(0)
  const [step, setStep] = useState<"select" | "active" | "proficiency">("select")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get current language we're asking proficiency for
  const currentLanguage = selectedLanguages[currentLanguageIndex] || "";
  
  // Handle language selection toggle
  const toggleLanguage = (language: string) => {
    setSelectedLanguages(prev => 
      prev.includes(language)
        ? prev.filter(lang => lang !== language)
        : [...prev, language]
    )
  }

  // Handle next step button
  const handleNextStep = () => {
    if (step === "select") {
      if (selectedLanguages.length === 0) {
        setError("Please select at least one language to learn")
        return
      }
      setError(null)
      setStep("active")
      
      // Set default active language if none selected
      if (!activeLanguage && selectedLanguages.length > 0) {
        setActiveLanguage(selectedLanguages[0])
      }
    } else if (step === "active") {
      if (!activeLanguage) {
        setError("Please select an active language")
        return
      }
      setError(null)
      setStep("proficiency")
      setCurrentLanguageIndex(0) // Start with first language
      
      // Initialize proficiency levels if empty
      const initialProficiencyLevels = { ...proficiencyLevels }
      selectedLanguages.forEach(lang => {
        if (!initialProficiencyLevels[lang]) {
          initialProficiencyLevels[lang] = "1" // Default to beginner
        }
      })
      setProficiencyLevels(initialProficiencyLevels)
    }
  }

  // Handle previous step button
  const handlePreviousStep = () => {
    if (step === "active") {
      setStep("select")
    } else if (step === "proficiency") {
      if (currentLanguageIndex > 0) {
        setCurrentLanguageIndex(prev => prev - 1)
      } else {
        setStep("active")
      }
    }
  }

  // Handle proficiency selection for current language
  const handleProficiencySelect = (level: string) => {
    setProficiencyLevels(prev => ({
      ...prev,
      [currentLanguage]: level
    }))
  }

  // Handle next language button in proficiency step
  const handleNextLanguage = () => {
    if (!proficiencyLevels[currentLanguage]) {
      setError("Please select your proficiency level")
      return
    }
    
    setError(null)
    
    if (currentLanguageIndex < selectedLanguages.length - 1) {
      setCurrentLanguageIndex(prev => prev + 1)
    } else {
      handleSubmit()
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    // Make sure we have proficiency for all languages
    const missingProficiency = selectedLanguages.some(lang => !proficiencyLevels[lang])
    
    if (missingProficiency) {
      setError("Please select proficiency levels for all languages")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      console.log("Submitting account setup with data:", {
        userId,
        selectedLanguages,
        activeLanguage,
        proficiencyLevels
      });
      
      const response = await fetch("/api/user/account-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          learningLanguages: selectedLanguages,
          activeLanguage,
          proficiencyLevels: proficiencyLevels
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error("API Error Response:", data);
        throw new Error(data.error || "Failed to complete account setup")
      }

      console.log("Account setup successful:", data);
      
      // Redirect to dashboard on success
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      console.error("Account setup error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get current step number for progress indicator
  const getCurrentStepNumber = () => {
    switch (step) {
      case "select": return 1;
      case "active": return 2;
      case "proficiency": return 3;
      default: return 1;
    }
  }

  // Get current language name
  const getCurrentLanguageName = () => {
    return LANGUAGES.find(l => l.value === currentLanguage)?.label || 'this language';
  }
  
  // Get progress percentage based on proficiency step
  const getProgressPercentage = () => {
    if (step !== "proficiency") return 0;
    return (currentLanguageIndex / selectedLanguages.length) * 100;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full max-w-2xl mx-auto overflow-hidden shadow-lg border-2">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center space-x-2">
            <Languages className="h-6 w-6" />
            <CardTitle className="text-2xl font-bold">Welcome to Language Learning!</CardTitle>
          </div>
          <CardDescription className="text-indigo-100 text-base mt-2">
            {step === "select" 
              ? "What language(s) would you like to learn? Select all that interest you!" 
              : step === "active"
                ? "Choose one language to focus on first"
                : `What's your proficiency level in ${getCurrentLanguageName()}?`}
          </CardDescription>
          
          {step === "proficiency" && selectedLanguages.length > 1 && (
            <div className="mt-2 text-indigo-100">
              <div className="w-full bg-indigo-400 h-1 rounded-full mt-2">
                <div 
                  className="bg-white h-1 rounded-full" 
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
              <div className="text-xs mt-1">
                Language {currentLanguageIndex + 1} of {selectedLanguages.length}
              </div>
            </div>
          )}
        </CardHeader>

        {/* Progress steps */}
        <div className="flex items-center px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white">
            <span className="text-sm font-medium">1</span>
          </div>
          <div className="mx-2 h-1 w-8 bg-indigo-600"></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getCurrentStepNumber() >= 2 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}>
            <span className="text-sm font-medium">2</span>
          </div>
          <div className={`mx-2 h-1 w-8 ${getCurrentStepNumber() >= 2 ? "bg-indigo-600" : "bg-gray-200"}`}></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getCurrentStepNumber() >= 3 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}>
            <span className="text-sm font-medium">3</span>
          </div>
        </div>

        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            {step === "select" ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <p className="text-gray-600 mb-4 font-medium">
                  Pick the languages you want to learn. You can always add more later!
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {LANGUAGES.map((language) => (
                    <div 
                      key={language.value} 
                      className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        selectedLanguages.includes(language.value) 
                          ? `ring-2 ring-indigo-500 ${language.color} border-transparent`
                          : 'bg-white border-gray-200 hover:border-indigo-200'
                      }`}
                      onClick={() => toggleLanguage(language.value)}
                    >
                      {selectedLanguages.includes(language.value) && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center"
                        >
                          <Check className="h-3 w-3 text-white" />
                        </motion.div>
                      )}
                      <div className="flex flex-col items-center space-y-2">
                        <span className="text-2xl" role="img" aria-label={language.label}>
                          {language.emoji}
                        </span>
                        <Label className="font-medium text-center">{language.label}</Label>
                        <input 
                          type="checkbox"
                          className="sr-only"
                          checked={selectedLanguages.includes(language.value)}
                          onChange={() => toggleLanguage(language.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : step === "active" ? (
              <motion.div
                key="active"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-gray-600 mb-6 font-medium">
                  Great choices! Now, which language would you like to start learning first?
                </p>
                <div className="space-y-4">
                  <RadioGroup 
                    value={activeLanguage} 
                    onValueChange={setActiveLanguage}
                    className="space-y-3"
                  >
                    {selectedLanguages.map((langCode) => {
                      const language = LANGUAGES.find(l => l.value === langCode)
                      return (
                        <motion.div 
                          key={langCode}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: 0.1 * selectedLanguages.indexOf(langCode) }}
                        >
                          <div 
                            className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              activeLanguage === langCode 
                                ? `ring-2 ring-indigo-500 ${language?.color} border-transparent` 
                                : 'border-gray-200 hover:border-indigo-200'
                            }`}
                            onClick={() => setActiveLanguage(langCode)}
                          >
                            <RadioGroupItem value={langCode} id={`active-${langCode}`} className="text-indigo-600" />
                            <span className="text-xl mr-2">{language?.emoji}</span>
                            <Label htmlFor={`active-${langCode}`} className="font-medium">{language?.label}</Label>
                          </div>
                        </motion.div>
                      )
                    })}
                  </RadioGroup>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`proficiency-${currentLanguage}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-gray-600 mb-6 font-medium">
                  Let&apos;s personalize your learning journey! What&apos;s your current proficiency level in{' '}
                  <span className="font-semibold">
                    {LANGUAGES.find(l => l.value === currentLanguage)?.label || 'this language'}
                  </span>?
                </p>
                
                <RadioGroup 
                  value={proficiencyLevels[currentLanguage] || ""} 
                  onValueChange={handleProficiencySelect}
                  className="space-y-4"
                >
                  {PROFICIENCY_LEVELS.map((level, index) => (
                    <motion.div
                      key={level.value}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <div 
                        className={`flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          proficiencyLevels[currentLanguage] === level.value 
                            ? `ring-2 ring-indigo-500 ${level.activeColor} border-transparent` 
                            : `${level.color} hover:brightness-95`
                        }`}
                        onClick={() => handleProficiencySelect(level.value)}
                      >
                        <RadioGroupItem 
                          value={level.value} 
                          id={`level-${level.value}`} 
                          className="text-indigo-600 mt-1" 
                        />
                        
                        <div className="ml-3 flex-1">
                          <div className="flex items-center">
                            <span className="text-xl mr-2">{level.emoji}</span>
                            <Label 
                              htmlFor={`level-${level.value}`} 
                              className="font-bold text-gray-900"
                            >
                              {level.label}
                            </Label>
                          </div>
                          <p className="text-gray-600 mt-1">{level.description}</p>
                          
                          {/* Progress bar visualization */}
                          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${level.value === "1" ? 0 : (parseInt(level.value) - 1) * 25}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>Novice</span>
                            <span>Fluent</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </RadioGroup>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-2 text-red-500" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                  clipRule="evenodd" 
                />
              </svg>
              {error}
            </motion.div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between items-center p-6 bg-gray-50 border-t">
          {step === "select" ? (
            <div className="flex justify-end w-full">
              <Button 
                onClick={handleNextStep} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex justify-between w-full">
              <Button 
                variant="outline" 
                onClick={handlePreviousStep}
                className="px-4 py-2 rounded-lg"
              >
                Back
              </Button>
              
              {step === "active" ? (
                <Button 
                  onClick={handleNextStep}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-all"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  onClick={currentLanguageIndex < selectedLanguages.length - 1 ? handleNextLanguage : handleSubmit}
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-all"
                >
                  {isSubmitting ? "Setting up..." : 
                   currentLanguageIndex < selectedLanguages.length - 1 ? 
                     "Next Language" : "Let's Start Learning!"}
                  {!isSubmitting && <ChevronRight className="h-4 w-4" />}
                </Button>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  )
} 