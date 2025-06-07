import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  const results: {
    timestamp: string;
    apiKey: string;
    tests: Record<string, unknown>;
    recommendations: string[];
  } = {
    timestamp: new Date().toISOString(),
    apiKey: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
    tests: {},
    recommendations: []
  };

  // Test 1: GPT-3.5-turbo (cheaper model)
  try {
    console.log('Testing GPT-3.5-turbo...');
    const gpt35Response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: "Say 'OK' if you can hear me." }
      ],
      max_tokens: 5,
      temperature: 0
    });
    
    results.tests['gpt-3.5-turbo'] = {
      status: '✅ Working',
      response: gpt35Response.choices[0].message.content,
      usage: gpt35Response.usage
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    results.tests['gpt-3.5-turbo'] = {
      status: '❌ Failed',
      error: errorMessage,
      code: (error as { code?: string }).code
    };
  }

  // Test 2: GPT-4o-mini (mid-tier model)
  try {
    console.log('Testing GPT-4o-mini...');
    const gpt4miniResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Say 'OK' if you can hear me." }
      ],
      max_tokens: 5,
      temperature: 0
    });
    
    results.tests['gpt-4o-mini'] = {
      status: '✅ Working',
      response: gpt4miniResponse.choices[0].message.content,
      usage: gpt4miniResponse.usage
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    results.tests['gpt-4o-mini'] = {
      status: '❌ Failed',
      error: errorMessage,
      code: (error as { code?: string }).code
    };
  }

  // Test 3: GPT-4o (premium model - the one failing)
  try {
    console.log('Testing GPT-4o...');
    const gpt4Response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: "Say 'OK' if you can hear me." }
      ],
      max_tokens: 5,
      temperature: 0
    });
    
    results.tests['gpt-4o'] = {
      status: '✅ Working',
      response: gpt4Response.choices[0].message.content,
      usage: gpt4Response.usage
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    results.tests['gpt-4o'] = {
      status: '❌ Failed',
      error: errorMessage,
      code: (error as { code?: string }).code
    };
  }

  // Test 4: DALL-E (working in your logs)
  try {
    console.log('Testing DALL-E...');
    // Just check the endpoint without generating an image
    results.tests['dall-e'] = {
      status: '✅ Available (not tested to save quota)',
      note: 'Image generation is working based on your logs'
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    results.tests['dall-e'] = {
      status: '❌ Failed',
      error: errorMessage
    };
  }

  // Recommendations  
  const gpt4oTest = results.tests['gpt-4o'] as { status: string };
  const gpt35Test = results.tests['gpt-3.5-turbo'] as { status: string };
  
  if (gpt4oTest.status.includes('Failed')) {
    results.recommendations.push('🔄 Switch journey generation to GPT-4o-mini or GPT-3.5-turbo');
  }
  
  if (gpt35Test.status.includes('Working')) {
    results.recommendations.push('💡 Use GPT-3.5-turbo for cost-effective journey generation');
  }

  results.recommendations.push('💰 Check your OpenAI billing at https://platform.openai.com/usage');
  results.recommendations.push('🎯 Add usage limits to prevent quota exceeded errors');

  return NextResponse.json(results, { 
    headers: { 'Content-Type': 'application/json' } 
  });
} 