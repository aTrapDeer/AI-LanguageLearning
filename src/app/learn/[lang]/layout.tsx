"use client"

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen bg-background">
      {children}
    </div>
  )
} 