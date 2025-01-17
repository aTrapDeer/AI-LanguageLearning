import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Language Learning Session",
  description: "Learn a new language with AI assistance",
}

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
} 