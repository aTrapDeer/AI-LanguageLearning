'use client';

import { useState } from 'react';

interface JourneyTestResult {
  status: 'loading' | 'success' | 'error';
  data?: {
    language: string;
    level: number;
    rounds: unknown[];
    summaryTest: unknown[];
  };
  error?: string;
  duration?: number;
}

export default function TestJourneyPage() {
  const [result, setResult] = useState<JourneyTestResult>({ status: 'loading' });

  const testJourneyGeneration = async () => {
    setResult({ status: 'loading' });
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/journey/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          language: 'en', 
          level: 1 
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
        <h1 className="text-3xl font-bold mb-8 text-center">Journey Generation Test</h1>
        
        <div className="text-center mb-8">
          <button
            onClick={testJourneyGeneration}
            disabled={result.status === 'loading'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {result.status === 'loading' ? 'Testing...' : 'Test Journey Generation'}
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
              <p><strong>Rounds:</strong> {result.data.rounds?.length || 0}</p>
              <p><strong>Summary Test:</strong> {result.data.summaryTest?.length || 0}</p>
              
              <details className="mt-4">
                <summary className="cursor-pointer font-medium">View Raw Data</summary>
                <pre className="mt-2 p-4 bg-gray-100 rounded text-sm overflow-auto max-h-96">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
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
                    The request timed out. This can happen when:
                  </p>
                  <ul className="list-disc ml-5 text-yellow-700">
                    <li>OpenAI API is slow or overloaded</li>
                    <li>Image generation is taking too long</li>
                    <li>Network connectivity issues</li>
                    <li>Server timeout limits exceeded</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 