import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET() {
  try {
    console.log('=== Testing OpenAI API Connection ===');
    
    // Check if API key exists
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        status: 'error',
        message: 'OPENAI_API_KEY environment variable not set'
      }, { status: 500 });
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-')) {
      return NextResponse.json({
        status: 'error',
        message: 'OPENAI_API_KEY appears to be invalid (should start with sk-)'
      }, { status: 500 });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
      timeout: 10000
    });

    console.log('Testing OpenAI API with a simple completion...');

    // Test with a simple completion first
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "user", content: "Say 'API test successful'" }
        ],
        max_tokens: 10
      });

      console.log('Chat completion test successful');

      // Test image generation
      console.log('Testing image generation...');
      const imageResponse = await openai.images.generate({
        model: "dall-e-2", // Use dall-e-2 first as it's more reliable
        prompt: "A simple red circle",
        n: 1,
        size: "256x256"
      });

      console.log('Image generation test successful');

      return NextResponse.json({
        status: 'success',
        message: 'OpenAI API connection successful',
        tests: {
          apiKeyFormat: 'valid',
          chatCompletion: completion.choices[0]?.message?.content || 'success',
          imageGeneration: imageResponse.data[0]?.url ? 'success' : 'failed',
          imageUrl: imageResponse.data[0]?.url
        }
      });

    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      
      let errorMessage = 'Unknown API error';
      if (apiError instanceof Error) {
        errorMessage = apiError.message;
      }

      return NextResponse.json({
        status: 'error',
        message: 'OpenAI API call failed',
        error: errorMessage,
        tests: {
          apiKeyFormat: 'valid',
          apiConnection: 'failed'
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Test error:', error);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json({
      status: 'error',
      message: 'Test failed',
      error: errorMessage
    }, { status: 500 });
  }
} 