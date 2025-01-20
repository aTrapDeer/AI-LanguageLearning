"use client"

import { Metadata } from "next"
import { use } from "react"

const languageMap: Record<string, string> = {
  'de': 'German',
  'pt-BR': 'Portuguese (Brazilian)',
  'zh': 'Chinese',
  'no': 'Norwegian',
  'en': 'English'
};

export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const language = languageMap[params.lang] || 'Language';
  return {
    title: `${language} Learning Session`,
    description: `Learn ${language} with AI assistance`,
  }
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default function Layout({ children, params }: LayoutProps) {
  const resolvedParams = use(params);
  return (
    <div className="h-screen bg-background">
      {children}
    </div>
  )
} 