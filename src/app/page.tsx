import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="py-12 sm:py-20 text-center">
        <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          Master Any Language with
          <span className="text-indigo-600 dark:text-indigo-400"> AI-Powered Learning</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
          Experience personalized language learning with real-time feedback, conversation practice, and adaptive lessons tailored to your goals.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/get-started"
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Start Learning Free
          </Link>
          <Link
            href="/how-it-works"
            className="border border-gray-300 dark:border-gray-700 px-8 py-3 rounded-lg text-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            How It Works
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">AI-Powered Learning</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Adaptive lessons that adjust to your learning style and pace
          </p>
        </div>

        <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Real Conversations</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Practice speaking with AI-powered conversation partners
          </p>
        </div>

        <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor your improvement with detailed analytics and insights
          </p>
        </div>
      </div>

      {/* Languages Section */}
      <div className="py-16 text-center">
        <h2 className="text-3xl font-bold mb-12">Available Languages</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {['Spanish', 'French', 'German', 'Italian', 'Chinese', 'Japanese'].map((language) => (
            <Link
              key={language}
              href={`/learn/${language.toLowerCase()}`}
              className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="font-medium text-gray-900 dark:text-white">{language}</h3>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
