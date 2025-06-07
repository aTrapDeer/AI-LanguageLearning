'use client';

import { useState } from 'react';

interface TestResult {
  status: string;
  response?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
  code?: string;
  note?: string;
}

interface QuotaTestResults {
  timestamp: string;
  apiKey: string;
  tests: Record<string, TestResult>;
  recommendations: string[];
  error?: string;
}

export default function TestQuotaPage() {
  const [results, setResults] = useState<QuotaTestResults | null>(null);
  const [loading, setLoading] = useState(false);

  const testQuota = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-openai');
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error testing quota:', error);
      setResults({ 
        timestamp: new Date().toISOString(),
        apiKey: 'Unknown',
        tests: {},
        recommendations: [],
        error: 'Failed to test quota' 
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">OpenAI Quota Test</h1>
        
        <div className="text-center mb-8">
          <button
            onClick={testQuota}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test OpenAI Quota'}
          </button>
        </div>

        {results && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            <div className="mb-4">
              <p><strong>Timestamp:</strong> {results.timestamp}</p>
              <p><strong>API Key:</strong> {results.apiKey}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Model Tests:</h3>
              
              {Object.entries(results.tests || {}).map(([model, test]: [string, TestResult]) => (
                <div key={model} className="border rounded p-4">
                  <h4 className="font-medium text-lg">{model}</h4>
                  <p className="mb-2"><strong>Status:</strong> {test.status}</p>
                  
                  {test.response && (
                    <p><strong>Response:</strong> {test.response}</p>
                  )}
                  
                  {test.usage && (
                    <div className="mt-2">
                      <strong>Usage:</strong>
                      <ul className="ml-4 list-disc">
                        <li>Prompt tokens: {test.usage.prompt_tokens}</li>
                        <li>Completion tokens: {test.usage.completion_tokens}</li>
                        <li>Total tokens: {test.usage.total_tokens}</li>
                      </ul>
                    </div>
                  )}
                  
                  {test.error && (
                    <div className="mt-2">
                      <p className="text-red-600"><strong>Error:</strong> {test.error}</p>
                      {test.code && <p className="text-red-600"><strong>Code:</strong> {test.code}</p>}
                    </div>
                  )}
                  
                  {test.note && (
                    <p className="text-blue-600 mt-2"><strong>Note:</strong> {test.note}</p>
                  )}
                </div>
              ))}
            </div>

            {results.recommendations && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Recommendations:</h3>
                <ul className="space-y-2">
                  {results.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 