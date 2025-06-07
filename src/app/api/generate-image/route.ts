import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Define request parameters type that accommodates all model types
interface ImageRequestParams {
  model: "dall-e-3";
  prompt: string;
  n?: number;
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "natural" | "vivid";
  response_format?: "url" | "b64_json";
}

// Initialize OpenAI client with timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
});

// Function to validate API key
function isValidApiKey(key?: string): boolean {
  if (!key) return false;
  // Basic check: OpenAI API keys typically start with 'sk-'
  return key.startsWith('sk-') && key.length > 20;
}

// Function to ensure we always return valid JSON
function createErrorResponse(error: string, status: number = 500) {
  return NextResponse.json(
    { 
      error,
      fallbackUrl: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=Image+Generation+Failed',
      success: false
    },
    { 
      status,
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );
}

export async function POST(req: Request) {
  try {
    console.log('=== Image Generation API Called ===');
    
    // Parse the request body
    const body = await req.json();
    console.log('Request body parsed:', JSON.stringify(body, null, 2));
    
    const { prompt, model = 'dall-e-2', size = '1024x1024', quality = 'standard', style = 'natural' } = body;

    // Validate inputs
    if (!prompt) {
      console.error('No prompt provided');
      return createErrorResponse('Missing required field: prompt', 400);
    }

    console.log(`Processing request: model=${model}, size=${size}, quality=${quality}`);

    // Enhanced API key validation
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY is not set, returning mock image URL');
      return NextResponse.json({ 
        url: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=API+Key+Not+Configured',
        prompt: prompt,
        success: true
      });
    }
    
    if (!isValidApiKey(apiKey)) {
      console.warn('OPENAI_API_KEY appears to be invalid, returning mock image URL');
      return NextResponse.json({ 
        url: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=Invalid+API+Key+Format',
        prompt: prompt,
        error: 'API key validation failed',
        success: false
      });
    }

    console.log('API key validation passed');

    // Call OpenAI API to generate image
    console.log('Starting image generation for prompt:', prompt);
    try {
      // Prepare request parameters
      const requestParams: ImageRequestParams = {
        model,
        prompt,
        n: 1,
        size,
        response_format: 'url'
      };
      
      // Add model-specific parameters
      if (model === 'dall-e-3') {
        requestParams.quality = quality as "standard" | "hd";
        if (style && (style === 'natural' || style === 'vivid')) {
          requestParams.style = style;
        }
        console.log('Using DALL-E 3 configuration');
      } else if (model === 'dall-e-3') {
        // DALL-E 2 doesn't support quality or style parameters
        delete requestParams.quality;
        delete requestParams.style;
        console.log('Using DALL-E 3 configuration');
      }
      
      console.log('Final request params:', JSON.stringify(requestParams, null, 2));
      
      // Make the API call
      console.log('Making OpenAI API call...');
      const response = await openai.images.generate(requestParams);

      console.log('OpenAI API call completed successfully');
      console.log('Response data length:', response.data?.length || 0);
      
      // Check for valid image data
      const imageData = response.data?.[0];
      
      if (!imageData) {
        console.error('No image data returned from OpenAI');
        return createErrorResponse('No image data returned from OpenAI');
      }
      
      if (!imageData.url) {
        console.error('No image URL returned from OpenAI');
        console.error('Image data structure:', JSON.stringify(imageData, null, 2));
        return createErrorResponse('No image URL returned from OpenAI');
      }
      
      // Return the image URL
      console.log('Returning image URL:', imageData.url);
      return NextResponse.json({ 
        url: imageData.url,
        prompt: prompt,
        model: model,
        success: true
      });
      
    } catch (openaiError) {
      console.error('=== OpenAI API Error ===');
      console.error('Error:', openaiError);
      
      // Always fall back to placeholder image on any error
      console.error('Image generation failed - falling back to placeholder');
      return NextResponse.json({
        url: 'https://placehold.co/1024x1024/E3F2FD/1976D2?text=Image+Generation+Unavailable',
        prompt: prompt,
        model: model,
        success: true,
        fallback: true,
        message: 'Image generation currently unavailable - showing placeholder'
      });
    }
  } catch (error) {
    console.error('=== General API Error ===');
    console.error('Error:', error);
    
    // Always return a valid JSON response with placeholder
    return NextResponse.json({
      url: 'https://placehold.co/1024x1024/EAEAEA/757575?text=Server+Error',
      prompt: 'Error occurred',
      success: true,
      fallback: true,
      message: 'Server error - showing placeholder image'
    });
  }
} 