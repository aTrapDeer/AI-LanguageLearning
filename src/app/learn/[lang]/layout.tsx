"use client"

import { use } from "react"

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