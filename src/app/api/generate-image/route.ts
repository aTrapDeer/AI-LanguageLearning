import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Define types for OpenAI image generation



// Define request parameters type that accommodates all model types
interface ImageRequestParams {
  model: string;
  prompt: string;
  n: number;
  size: string;
  quality?: string;
  output_format?: string;
  response_format?: string;
  style?: string;
  [key: string]: unknown;
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

// Function to create timeout promise
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
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
    // Parse the request body with timeout
    const body = await Promise.race([
      req.json(),
      createTimeoutPromise(5000) // 5 second timeout for parsing request
    ]);
    
    const { prompt, model = 'dall-e-3', size = '1024x1024', quality = 'auto' } = body;

    // Validate inputs
    if (!prompt) {
      return createErrorResponse('Missing required field: prompt', 400);
    }

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

    // Call OpenAI API to generate image with timeout
    console.log('Generating image for prompt:', prompt);
    try {
      // Set up parameters based on model
      const requestParams: ImageRequestParams = {
        model: model,
        prompt,
        n: 1,
        size: size
      };
      
      // Add model-specific parameters
      if (model === 'dall-e-3') {
        // DALL-E 3 parameters
        requestParams.quality = quality === 'auto' ? 'standard' : quality;
        requestParams.response_format = 'url'; // DALL-E 3 returns URLs
        if (body.style) {
          requestParams.style = body.style; // natural or vivid
        }
      } else if (model === 'dall-e-2') {
        // DALL-E 2 parameters
        requestParams.response_format = 'url';
        // DALL-E 2 doesn't support quality or style parameters
      } else if (model === 'gpt-image-1') {
        // Azure-specific model (if using Azure OpenAI)
        requestParams.quality = quality;
        if (body.output_format) {
          requestParams.output_format = body.output_format;
        }
      } else {
        // Default to DALL-E 3 behavior for unknown models
        requestParams.quality = quality === 'auto' ? 'standard' : quality;
        requestParams.response_format = 'url';
      }
      
      console.log('Image generation request params:', JSON.stringify(requestParams));
      
      // Make the API call with timeout protection
      const response = await Promise.race([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        openai.images.generate(requestParams as any),
        createTimeoutPromise(25000) // 25 second timeout for image generation
      ]);

      console.log('Image generated successfully');
      
      // Log the response structure for debugging
      console.log('OpenAI image response structure:', JSON.stringify({
        data: response.data ? 'data array present' : 'no data', 
        length: response.data?.length || 0,
        hasUrl: response.data?.[0]?.url ? 'yes' : 'no',
        hasB64: response.data?.[0]?.b64_json ? 'yes' : 'no'
      }));
      
      // Check for valid image data
      const imageData = response.data?.[0];
      
      if (!imageData) {
        console.error('No image data returned from OpenAI');
        return createErrorResponse('No image data returned from OpenAI');
      }
      
      // Handle both URL and base64 formats
      if (imageData.url) {
        // Return the image URL for DALL-E models
        return NextResponse.json({ 
          url: imageData.url,
          prompt: prompt,
          success: true
        });
      } else if (imageData.b64_json) {
        // For models that return base64 (like gpt-image-1)
        // Convert to a data URL that can be used directly in an <img> tag
        const format = body.output_format || 'png';
        const dataUrl = `data:image/${format};base64,${imageData.b64_json}`;
        
        return NextResponse.json({ 
          url: dataUrl,
          prompt: prompt,
          isBase64: true,
          success: true
        });
      } else {
        console.error('No image URL or base64 data returned from OpenAI');
        return createErrorResponse('No image URL or base64 data returned from OpenAI');
      }
    } catch (openaiError) {
      console.error('OpenAI error:', openaiError);
      
      // Check if it's a timeout error
      if (openaiError instanceof Error && openaiError.message.includes('timed out')) {
        console.error('Image generation timed out');
        return createErrorResponse('Image generation timed out. Please try again.', 504);
      }
      
      // Handle different types of OpenAI errors
      if (openaiError instanceof Error) {
        if (openaiError.message.includes('rate_limit')) {
          return createErrorResponse('Rate limit exceeded. Please try again later.', 429);
        }
        if (openaiError.message.includes('invalid_request')) {
          return createErrorResponse('Invalid request parameters.', 400);
        }
        if (openaiError.message.includes('insufficient_quota')) {
          return createErrorResponse('API quota exceeded.', 402);
        }
        if (openaiError.message.includes('model_not_found') || openaiError.message.includes('The model')) {
          return createErrorResponse('Invalid model specified. Please use dall-e-2 or dall-e-3.', 400);
        }
      }
      
      return createErrorResponse('Failed to generate image with OpenAI');
    }
  } catch (error) {
    console.error('Error generating image:', error);
    
    // Handle timeout errors specifically
    if (error instanceof Error && error.message.includes('timed out')) {
      return createErrorResponse('Request timed out. Please try again.', 504);
    }
    
    return createErrorResponse('Internal server error');
  }
} 