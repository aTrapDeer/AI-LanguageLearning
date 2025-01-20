import { Metadata } from "next"

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
  params: { lang: string };
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen bg-background">
      {children}
    </div>
  )
} 