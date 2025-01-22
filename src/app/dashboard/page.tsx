"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { useLanguage } from "@/contexts/language-context";
import {
  ChatBubbleIcon,
  CardStackIcon,
  SpeakerLoudIcon,
  ImageIcon,
} from "@radix-ui/react-icons";

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { selectedLanguage } = useLanguage();

  const features = [
    {
      Icon: ChatBubbleIcon,
      name: "AI Chat Assistant",
      description: "Practice conversations with our AI language tutor that adapts to your level and provides instant feedback.",
      href: `/learn/chat?lang=${selectedLanguage?.code || 'en'}`,
      cta: "Start Chatting",
      background: <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-transparent dark:from-indigo-900/30" />,
      className: "md:col-span-2 md:row-span-2",
    },
    {
      Icon: ImageIcon,
      name: "Visual Learning",
      description: "Learn through images and visual associations to enhance memory retention.",
      href: `/learn/visual?lang=${selectedLanguage?.code || 'en'}`,
      cta: "Explore",
      background: <div className="absolute inset-0 bg-gradient-to-br from-rose-100 to-transparent dark:from-rose-900/30" />,
      className: "",
    },
    {
      Icon: CardStackIcon,
      name: "Flashcard Vocabulary",
      description: "Build your vocabulary with smart flashcards that adapt to your learning pace.",
      href: `/learn/flashcards?lang=${selectedLanguage?.code || 'en'}`,
      cta: "Practice Vocab",
      background: <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-transparent dark:from-amber-900/30" />,
      className: "md:row-span-2",
    },
    {
      Icon: SpeakerLoudIcon,
      name: "Audio Conversations",
      description: "Practice pronunciation and listening with AI-powered audio conversations.",
      href: `/learn/conversation?lang=${selectedLanguage?.code || 'en'}`,
      cta: "Start Speaking",
      background: <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-transparent dark:from-emerald-900/30" />,
      className: "md:col-span-2",
    },
  ];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

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

  return (
    <div className="relative min-h-screen pb-8">
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
      <div className="relative container mx-auto px-4 py-8 mt-20">
        <BentoGrid>
          {features.map((feature) => (
            <BentoCard key={feature.name} {...feature} />
          ))}
        </BentoGrid>
      </div>
    </div>
  );
} 