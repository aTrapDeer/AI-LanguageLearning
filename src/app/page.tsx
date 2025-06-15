"use client";

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal';
import AnimatedGlobe from '@/components/ui/globe';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <BackgroundGradientAnimation
          gradientBackgroundStart="rgb(0, 17, 82)"
          gradientBackgroundEnd="rgb(108, 0, 162)"
          firstColor="18, 113, 255"
          secondColor="221, 74, 255"
          thirdColor="100, 220, 255"
          fourthColor="200, 50, 50"
          fifthColor="180, 180, 50"
          pointerColor="140, 100, 255"
          size="80%"
          blendingValue="hard-light"
          containerClassName="absolute inset-0"
        />
        <AnimatedGlobe />
        <div className="container relative mx-auto px-4 flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-3xl mx-auto space-y-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <VerticalCutReveal
                splitBy="characters"
                staggerDuration={0.05}
                staggerFrom="center"
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
                containerClassName="text-7xl font-extrabold tracking-wider text-center flex justify-center"
                elementLevelClassName="text-white hover:scale-110 transition-transform duration-200"
              >
                LAINGFY
              </VerticalCutReveal>
              <p className="text-xl text-white/80">
                Learn languages naturally with AI
              </p>
            </div>
            <div className="flex justify-center gap-4">
              {session ? (
                <>
                  <Link
                    href="/dashboard"
                    className="px-8 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard"
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Continue Learning
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="px-8 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/login"
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Learn with 
            <span className="bg-gradient-to-r from-indigo-600 to-rose-500 bg-clip-text text-transparent"> L</span>
            <span className="bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent">AI</span>
            <span className="bg-gradient-to-r from-violet-500 to-indigo-600 bg-clip-text text-transparent">GNFY</span>?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Conversation Partner</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Practice real conversations with our AI that adapts to your level and provides instant feedback
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Speech Recognition</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get real-time pronunciation feedback and improve your speaking skills
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Personalized Learning</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Learn at your own pace with content tailored to your interests and goals
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Visual Learning</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Practice describing AI-generated images in your target language for immersive visual learning
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Reinforcement</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Master vocabulary through adaptive flashcards and intelligent review of challenging words
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Language Variety</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose from a diverse selection of languages, with more being added regularly to expand your learning horizons
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Languages Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Available Languages</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-5xl mx-auto">
            <Link href="/learn/de" className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all text-center group">
              <span className="text-4xl mb-3 block">🇩🇪</span>
              <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">German</h3>
            </Link>
            <Link href="/learn/pt-BR" className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all text-center group">
              <span className="text-4xl mb-3 block">🇧🇷</span>
              <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Portuguese (BR)</h3>
            </Link>
            <Link href="/learn/zh" className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all text-center group">
              <span className="text-4xl mb-3 block">🇨🇳</span>
              <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Chinese</h3>
            </Link>
            <Link href="/learn/no" className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all text-center group">
              <span className="text-4xl mb-3 block">🇳🇴</span>
              <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Norwegian</h3>
            </Link>
            <Link href="/learn/ko" className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all text-center group">
              <span className="text-4xl mb-3 block">🇰🇷</span>
              <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Korean</h3>
            </Link>
            <Link href="/learn/ar" className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all text-center group">
              <span className="text-4xl mb-3 block">🇸🇦</span>
              <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Arabic</h3>
            </Link>
          </div>
          <p className="text-center text-gray-600 dark:text-gray-400 mt-8">More languages coming soon!</p>
        </div>
      </section>
    </div>
  );
}
