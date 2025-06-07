'use client';

import { useState } from 'react';

interface FlashcardWord {
  word: string;
  translation: string;
  context?: string;
}

interface FlashcardTestResult {
  status: 'loading' | 'success' | 'error';
  data?: {
    language: string;
    level: number;
    words: FlashcardWord[];
  };
  error?: string;
  duration?: number;
}

export default function TestFlashcardsPage() {
  const [result, setResult] = useState<FlashcardTestResult>({ status: 'loading' });

  const testFlashcardGeneration = async () => {
    setResult({ status: 'loading' });
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          language: 'de', 
          level: 3
        }),
      });

      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult({ 
        status: 'success', 
        data, 
        duration 
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      setResult({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Flashcard Generation Test</h1>
        
        <div className="text-center mb-8">
          <button
            onClick={testFlashcardGeneration}
            disabled={result.status === 'loading'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {result.status === 'loading' ? 'Testing...' : 'Test Flashcard Generation'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          
          <div className="mb-4">
            <p><strong>Status:</strong> {result.status}</p>
            {result.duration && (
              <p><strong>Duration:</strong> {result.duration}ms ({(result.duration / 1000).toFixed(2)}s)</p>
            )}
          </div>

          {result.status === 'success' && result.data && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-600">✅ Success!</h3>
              <p><strong>Language:</strong> {result.data.language}</p>
              <p><strong>Level:</strong> {result.data.level}</p>
              <p><strong>Words Generated:</strong> {result.data.words?.length || 0}</p>
              
              <div className="mt-4">
                <h4 className="font-medium">Sample Words:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {result.data.words?.slice(0, 4).map((word, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded">
                      <div className="font-medium">{word.word}</div>
                      <div className="text-sm text-gray-600">{word.translation}</div>
                      {word.context && (
                        <div className="text-xs text-gray-500 italic mt-1">{word.context}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <details className="mt-4">
                <summary className="cursor-pointer font-medium">View All Words</summary>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {result.data.words?.map((word, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="font-medium">{word.word}</div>
                      <div className="text-gray-600">{word.translation}</div>
                      {word.context && (
                        <div className="text-xs text-gray-500 italic">{word.context}</div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {result.status === 'error' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-600">❌ Error</h3>
              <p className="text-red-600">{result.error}</p>
              
              {result.error?.includes('504') && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <h4 className="font-medium text-yellow-800">504 Timeout Detected</h4>
                  <p className="text-yellow-700">
                    The request timed out. This can happen when OpenAI API is slow or overloaded.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 