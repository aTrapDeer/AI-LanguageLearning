import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Define types for OpenAI image generation
interface OpenAIImageData {
  url?: string;
  b64_json?: string;
  error?: string;
  [key: string]: unknown;
}

interface OpenAIImageResponse {
  data: OpenAIImageData[];
  [key: string]: unknown;
}

// Define request parameters type that accommodates all model types
interface ImageRequestParams {
  model: string;
  prompt: string;
  n: number;
  size: string;
  quality?: string;
  output_format?: string;
  response_format?: string;
  [key: string]: unknown;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to validate API key
function isValidApiKey(key?: string): boolean {
  if (!key) return false;
  // Basic check: OpenAI API keys typically start with 'sk-'
  return key.startsWith('sk-') && key.length > 20;
}

export async function POST(req: Request) {
  try {
    // Parse the request body
    const body = await req.json();
    const { prompt, model = 'gpt-image-1', size = '1024x1024', quality = 'auto' } = body;

    // Validate inputs
    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    // Enhanced API key validation
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY is not set, returning mock image URL');
      return NextResponse.json({ 
        url: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=API+Key+Not+Configured',
        prompt: prompt
      });
    }
    
    if (!isValidApiKey(apiKey)) {
      console.warn('OPENAI_API_KEY appears to be invalid, returning mock image URL');
      return NextResponse.json({ 
        url: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=Invalid+API+Key+Format',
        prompt: prompt,
        error: 'API key validation failed'
      });
    }

    // Call OpenAI API to generate image
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
      if (model === 'gpt-image-1') {
        // gpt-image-1 always returns base64 images
        requestParams.quality = quality;
        // Specify output format if provided
        if (body.output_format) {
          requestParams.output_format = body.output_format;
        }
      } else {
        // For dall-e models
        requestParams.quality = 'standard';
        requestParams.response_format = 'url';
      }
      
      console.log('Image generation request params:', JSON.stringify(requestParams));
      
      // Make the API call
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await openai.images.generate(requestParams as any) as unknown as OpenAIImageResponse;

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
        return NextResponse.json({ 
          error: 'No image data returned',
          fallbackUrl: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=Image+Generation+Failed'
        }, { status: 500 });
      }
      
      // Handle both URL and base64 formats
      if (imageData.url) {
        // Return the image URL for dall-e models
        return NextResponse.json({ 
          url: imageData.url,
          prompt: prompt
        });
      } else if (imageData.b64_json) {
        // For gpt-image-1, we get base64 data
        // Convert to a data URL that can be used directly in an <img> tag
        const format = body.output_format || 'png';
        const dataUrl = `data:image/${format};base64,${imageData.b64_json}`;
        
        return NextResponse.json({ 
          url: dataUrl,
          prompt: prompt,
          isBase64: true
        });
      } else {
        console.error('No image URL or base64 data returned from OpenAI');
        return NextResponse.json({ 
          error: 'No image URL or base64 data returned',
          fallbackUrl: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=Image+Generation+Failed'
        }, { status: 500 });
      }
    } catch (openaiError) {
      console.error('OpenAI error:', openaiError);
      return NextResponse.json(
        { 
          error: 'Failed to generate image with OpenAI',
          fallbackUrl: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=Image+Generation+Failed'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        fallbackUrl: 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=Error'
      },
      { status: 500 }
    );
  }
} 