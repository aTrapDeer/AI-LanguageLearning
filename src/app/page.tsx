import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30" />
        <div className="container relative mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
              Learn Languages with AI
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Experience personalized language learning powered by advanced AI. Practice speaking, writing, and understanding with instant feedback.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/register" className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-500 text-white rounded-lg font-medium hover:from-indigo-500 hover:to-violet-400 transition-all">
                Start Learning
              </Link>
              <Link href="/learn/de" className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700">
                Try Demo
              </Link>
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
          </div>
        </div>
      </section>

      {/* Languages Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Available Languages</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
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
          </div>
          <p className="text-center text-gray-600 dark:text-gray-400 mt-8">More languages coming soon!</p>
        </div>
      </section>
    </div>
  );
}
