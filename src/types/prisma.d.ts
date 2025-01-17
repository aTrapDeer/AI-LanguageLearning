export interface User {
  id: string
  name: string | null
  email: string
  learningLanguages: string[]
  accounts: Account[]
  sessions: Session[]
  progress: Progress[]
  learning: Learning[]
}

export interface Progress {
  id: string
  userId: string
  language: string
  level: number
  xp: number
  user: User
}

export interface Learning {
  id: string
  userId: string
  language: string
  word: string
  translation: string
  difficulty: number
  lastRecalled: Date
  nextReview: Date
  successCount: number
  failureCount: number
  notes: string | null
  tags: string[]
  user: User
} 