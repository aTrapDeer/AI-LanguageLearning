"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface Language {
  code: string
  from: string
  to: string
  flag: string
  description: string
}

interface Progress {
  language: string
  level: number
  xp: number
}

const AVAILABLE_LANGUAGES: Language[] = [
  {
    code: "de",
    from: "English",
    to: "German",
    flag: "🇩🇪",
    description: "Learn German as an English speaker"
  },
  {
    code: "pt-BR",
    from: "English",
    to: "Portuguese (Brazilian)",
    flag: "🇧🇷",
    description: "Learn Portuguese (Brazilian) as an English speaker"
  },
  {
    code: "zh",
    from: "English",
    to: "Mandarin",
    flag: "🇨🇳",
    description: "Learn Mandarin as an English speaker"
  },
  {
    code: "no",
    from: "English",
    to: "Norwegian",
    flag: "🇳🇴",
    description: "Learn Norwegian as an English speaker"
  }
]

// XP required for each level (increases by 100 each time)
const XP_PER_LEVEL = (level: number) => level * 100

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [progress, setProgress] = useState<Progress[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (session?.user?.id) {
      // Fetch user progress
      fetch("/api/user/progress")
        .then(res => res.json())
        .then(data => setProgress(data))
        .catch(err => console.error("Failed to fetch progress:", err))
    }
  }, [session?.user?.id, status, router])

  const handleLanguageSelect = async (language: Language) => {
    setIsLoading(true)
    try {
      // First, add the language to user's learning languages
      const response = await fetch("/api/user/languages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: language.code }),
      })

      if (!response.ok) {
        throw new Error('Failed to add language')
      }

      // Then navigate to the learning page
      router.push(`/learn/${language.code}`)
    } catch (error) {
      console.error("Failed to select language:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const learningLanguages = session.user.learningLanguages || []

  // Calculate progress percentage for a given language
  const getProgressPercentage = (langCode: string) => {
    const langProgress = progress.find(p => p.language === langCode)
    if (!langProgress) return 0

    const xpForNextLevel = XP_PER_LEVEL(langProgress.level)
    return Math.min((langProgress.xp / xpForNextLevel) * 100, 100)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Language Learning Dashboard</h1>
      
      {/* Current Progress Section */}
      {learningLanguages.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Your Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {learningLanguages.map((langCode) => {
              const language = AVAILABLE_LANGUAGES.find(l => l.code === langCode)
              const langProgress = progress.find(p => p.language === langCode)
              if (!language) return null

              return (
                <div
                  key={langCode}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{language.flag}</span>
                    <div>
                      <h3 className="font-semibold">{language.to}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Level {langProgress?.level || 1}
                      </p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div
                        className="h-2 bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${getProgressPercentage(langCode)}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      XP: {langProgress?.xp || 0} / {XP_PER_LEVEL(langProgress?.level || 1)}
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push(`/learn/${langCode}`)}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "Continue Learning"}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available Languages Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">
          {learningLanguages.length > 0 ? "Start Learning a New Language" : "Choose a Language to Learn"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {AVAILABLE_LANGUAGES.filter(lang => !learningLanguages.includes(lang.code)).map((language) => (
            <div
              key={language.code}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{language.flag}</span>
                <div>
                  <h3 className="font-semibold">{language.to}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {language.description}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleLanguageSelect(language)}
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Start Learning"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 