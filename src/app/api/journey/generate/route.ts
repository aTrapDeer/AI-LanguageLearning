import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Configure route segment - extends timeout for complex AI operations
export const maxDuration = 60; // 60 seconds for Vercel Pro (5 seconds for Hobby plan)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Define types for rounds
type MatchingRound = {
  type: 'matching';
  englishSentence: string;
  translatedSentence: string;
  words: string[];
};

// New multi-word missing word format
type MissingWordRound = {
  type: 'missing_word';
  sentence: string;
  missingWordIndices: number[];
  correctWords: string[];
  options: string[];
  isSingleWord?: boolean;
};

// Legacy single-word format
interface LegacyMissingWordRound {
  type: 'missing_word';
  sentence: string;
  missingWordIndex: number;
  correctWord: string;
  options: string[];
}

type SpellingRound = {
  type: 'spelling';
  englishWord: string;
  correctSpelling: string;
};

// New image generation round type
type ImageRound = {
  type: 'image';
  englishPrompt: string;
  targetLanguageWord: string;
  options: string[];
  imageUrl: string;
  description?: string;
};

// Support both new and legacy formats
type Round = MatchingRound | MissingWordRound | SpellingRound | LegacyMissingWordRound | ImageRound;

type JourneyData = {
  language: string;
  level: number;
  rounds: Round[];
  summaryTest: Round[];
};

// Initialize OpenAI client with timeout configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout to prevent 504 errors
  maxRetries: 2,   // Retry failed requests up to 2 times
});

// Define the language codes and names mapping
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'de': 'German',
  'zh': 'Chinese',
  'no': 'Norwegian',
  'pt-BR': 'Brazilian Portuguese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'es': 'Spanish',
  'fr': 'French',
  'ja': 'Japanese',
  'it': 'Italian',
  'ru': 'Russian'
};

// Define difficulty levels descriptions
const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'Complete beginner - knows very few words or phrases',
  2: 'Early beginner - knows basic greetings and simple phrases',
  3: 'Beginner - knows common words and basic sentence structures',
  4: 'Early intermediate - can form simple sentences and understand basic conversations',
  5: 'Intermediate - can engage in basic conversations with some errors',
  6: 'Upper intermediate - can express more complex thoughts with occasional errors',
  7: 'Early advanced - can communicate fluently on a variety of topics with few errors',
  8: 'Advanced - near-native fluency with occasional specialized vocabulary gaps',
  9: 'Expert - near native-level fluency across most contexts',
  10: 'Native-like - indistinguishable from a native speaker in most contexts'
};

// Sample fallback data for common languages
const FALLBACK_DATA: Record<string, JourneyData | null> = {
  // Will load language-specific fallbacks dynamically
  'de': null,  // German
  'es': null,  // Spanish
  'fr': null,  // French
  'zh': null,  // Chinese
  'pt-BR': null, // Brazilian Portuguese
  'ko': null,  // Korean
  
  // English fallback data - generic and usable across languages
  'en': {
    language: 'en',
    level: 1,
    rounds: [
      {
        type: 'matching',
        englishSentence: "Hello, how are you?",
        translatedSentence: "Hello, how are you?",
        words: ["Hello,", "how", "are", "you?"]
      },
      {
        type: 'missing_word',
        sentence: "I like to drink coffee in the morning",
        missingWordIndex: 4,
        correctWord: "coffee",
        options: ["coffee", "table", "window", "blue"]
      },
      {
        type: 'spelling',
        englishWord: "book",
        correctSpelling: "book"
      }
    ],
    summaryTest: [
      {
        type: 'matching',
        englishSentence: "Thank you very much",
        translatedSentence: "Thank you very much",
        words: ["Thank", "you", "very", "much"]
      }
    ]
  }
};

// Theme and content generation helpers
function getRandomThemes(level: number): string[] {
  const allThemes = {
    beginner: [
      'daily routines', 'family and friends', 'food and dining', 'shopping', 'weather and seasons',
      'home and living', 'hobbies and free time', 'transportation', 'health and body', 'numbers and time'
    ],
    intermediate: [
      'work and career', 'education and learning', 'travel and tourism', 'technology and media',
      'environment and nature', 'culture and traditions', 'sports and fitness', 'arts and entertainment',
      'politics and society', 'science and innovation'
    ],
    advanced: [
      'philosophy and ethics', 'business and economics', 'global issues', 'literature and poetry',
      'history and heritage', 'psychology and human behavior', 'international relations',
      'sustainability and future', 'scientific research', 'cultural analysis'
    ]
  };

  if (level <= 3) return allThemes.beginner;
  if (level <= 6) return [...allThemes.beginner, ...allThemes.intermediate];
  return [...allThemes.intermediate, ...allThemes.advanced];
}

function createDynamicPrompt(languageName: string, languageCode: string, level: number, levelDescription: string, theme: string): string {
  const complexity = level <= 3 ? 'simple' : level <= 6 ? 'intermediate' : 'advanced';
  const multiWordCount = level <= 4 ? 1 : level <= 7 ? 2 : level <= 9 ? 3 : 4;
  
  return `Create a ${languageName} learning journey (level ${level}/10: ${levelDescription}) focused on "${theme}".

REQUIREMENTS:
- 10 varied rounds + 3 summary test rounds
- Mix of matching, missing_word, spelling, and IMAGE exercises
- EXACTLY 1 image exercise in the main rounds (not in summary)
- Theme: ${theme} (but use diverse vocabulary within this theme)
- Complexity: ${complexity} level content
- Use natural, conversational ${languageName}

EXERCISE FORMATS:

MATCHING: {"type":"matching", "englishSentence":"...", "translatedSentence":"...", "words":["ALL","words","from","translated","sentence","including","punctuation"]}
- The "words" array MUST contain ALL words from the translatedSentence in the correct order
- Include punctuation marks as separate elements if needed
- Example: translatedSentence "Was studierst du?" → words ["Was","studierst","du?"]

MISSING_WORD: 
- Levels 1-4: {"type":"missing_word", "sentence":"...", "missingWordIndices":[index], "correctWords":["word"], "options":["correct","wrong1","wrong2","wrong3"], "isSingleWord":true}
- Levels 5+: {"type":"missing_word", "sentence":"...", "missingWordIndices":[i1,i2,...], "correctWords":["word1","word2",...], "options":["all","correct","words","plus","distractors"], "isSingleWord":false}

CRITICAL FOR MISSING_WORD EXERCISES:
- There must be ONLY ONE grammatically and contextually correct answer
- Wrong options must be CLEARLY wrong (different parts of speech, nonsensical in context)
- Avoid interchangeable options like numbers, colors, or synonyms
- Example: "I eat ____ for breakfast" → correct: "cereal", wrong: "running", "blue", "yesterday" (NOT "toast", "eggs", "fruit")
- Example: "Der Hund ____ im Park" → correct: "läuft", wrong: "Tisch", "blau", "gestern" (NOT "rennt", "spielt", "springt")

SPELLING: {"type":"spelling", "englishWord":"...", "correctSpelling":"..."}

IMAGE: {"type":"image", "englishPrompt":"A clear, simple image of [object/scene]", "targetLanguageWord":"${languageName} word for what's shown", "options":["correct_word","wrong1","wrong2","wrong3"], "imageUrl":"", "description":"Brief description for accessibility"}

GUIDELINES:
- Use ${multiWordCount} missing words for level ${level}
- Make wrong options completely unrelated (not synonyms or valid alternatives)
- CRITICAL: Each missing word exercise must have exactly ONE correct answer
- Wrong options should be from different word categories (noun vs verb vs adjective vs adverb)
- Avoid numbers, colors, or interchangeable words as distractors
- Vary sentence lengths: ${level <= 3 ? '3-5' : level <= 6 ? '5-8' : '8-12'} words
- Cultural relevance: include ${languageName}-speaking region references when appropriate
- Avoid repetitive patterns
- For IMAGE exercise: Choose common nouns/objects that are easy to visualize and recognize

CRITICAL FOR MATCHING EXERCISES:
- The "words" array must contain every single word from the "translatedSentence"
- Split the translatedSentence on spaces to get the words array
- Do NOT include extra distractor words in the words array
- The user will reconstruct the exact translatedSentence using only these words

Return only valid JSON: {"language":"${languageCode}", "level":${level}, "rounds":[...], "summaryTest":[...]}`;
}

// Improved fallback management
function createLanguageSpecificFallback(language: string, level: number): JourneyData | null {
  // Check if we have a static file for this language
  console.log(`Looking for fallback file for language: ${language}`);
  try {
    const fallbackPath = path.join(process.cwd(), `public/sample-journey-${language}.json`);
    console.log(`Checking path: ${fallbackPath}`);
    if (fs.existsSync(fallbackPath)) {
      console.log(`Found fallback file for ${language}!`);
      const data = fs.readFileSync(fallbackPath, 'utf8');
      const parsed = JSON.parse(data);
      parsed.level = level; // Update to requested level
      return parsed;
    } else {
      console.log(`No fallback file found for ${language} at ${fallbackPath}`);
    }
  } catch (error) {
    console.error(`Failed to load ${language} fallback:`, error);
  }
  return null;
}

// Try to load language-specific fallback data
try {
  const germanFallbackPath = path.join(process.cwd(), 'src/static/sample-journey.json');
  if (fs.existsSync(germanFallbackPath)) {
    const germanData = fs.readFileSync(germanFallbackPath, 'utf8');
    FALLBACK_DATA.de = JSON.parse(germanData);
  }
} catch (error) {
  console.error('Failed to load German fallback data:', error);
}

try {
  const portugueseFallbackPath = path.join(process.cwd(), 'src/static/sample-journey-pt-BR.json');
  if (fs.existsSync(portugueseFallbackPath)) {
    const portugueseData = fs.readFileSync(portugueseFallbackPath, 'utf8');
    FALLBACK_DATA['pt-BR'] = JSON.parse(portugueseData);
    console.log('Successfully loaded Portuguese fallback data');
  }
} catch (error) {
  console.error('Failed to load Portuguese fallback data:', error);
}

// Image generation function using DALL-E 3 - TEMPORARILY DISABLED
/* COMMENTED OUT TO PREVENT RATE LIMITING
async function generateImage(prompt: string): Promise<string> {
  try {
    console.log(`Generating image with DALL-E 3 for prompt: ${prompt}`);
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });
    
    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E 3');
    }
    
    console.log(`✅ Successfully generated image: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('DALL-E 3 image generation failed:', error);
    // Return a placeholder image URL if generation fails
    return 'https://placehold.co/1024x1024/EAEAEA/CCCCCC?text=Image+Generation+Failed';
  }
}
*/

// Generate journey content
export async function POST(req: Request) {
  try {
    // Debug: Log the raw request body before parsing 
    const rawBody = await req.text();
    console.log(`🔍 Raw request body: "${rawBody}"`);
    console.log(`🔍 Raw body length: ${rawBody.length}`);
    console.log(`🔍 First 50 chars: "${rawBody.substring(0, 50)}"`);
    
    // Now parse the JSON
    const body = JSON.parse(rawBody);
    const { language, level } = body;

    console.log(`🚀 Journey generation requested for language: ${language}, level: ${level}`);
    
    // Validate language code
    if (!language) {
      console.warn('❌ No language code provided, defaulting to English');
      return NextResponse.json(getFallbackJourney('en', level || 1));
    }
    
    // Default to level 1 if not provided or invalid
    const userLevel = level && Number.isInteger(level) && level > 0 && level <= 10 
      ? level 
      : 1;
    
    // Get language name from code, default to English
    const languageName = LANGUAGE_NAMES[language] || 'English';
    const levelDescription = LEVEL_DESCRIPTIONS[userLevel] || LEVEL_DESCRIPTIONS[1];
    
    console.log(`📝 Using language name: ${languageName} at level: ${userLevel}`);
    console.log(`📄 Level description: ${levelDescription}`);
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('❌ OPENAI_API_KEY is not set, using fallback journey data');
      return NextResponse.json(getFallbackJourney(language, userLevel));
    }

    // Verify API key format
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      console.warn('❌ OPENAI_API_KEY appears to be invalid format, using fallback journey data');
      return NextResponse.json(getFallbackJourney(language, userLevel));
    }

    console.log('✅ OpenAI API key validated, proceeding with ChatGPT generation...');

    // Try to generate with OpenAI
    try {
      // Get a random theme to ensure variety
      const themes = getRandomThemes(userLevel);
      const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
      
      // Create a more flexible, theme-based prompt
      const prompt = createDynamicPrompt(languageName, language, userLevel, levelDescription, selectedTheme);

      // Generate content with ChatGPT with timeout protection
      console.log(`🤖 Calling OpenAI API with theme: ${selectedTheme}...`);
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a creative language learning curriculum designer. Create diverse, engaging content that avoids repetitive patterns. Prioritize natural conversation and cultural authenticity.

CRITICAL: Always respond with VALID JSON only. Use this EXACT structure:
{
  "language": "language_code",
  "level": number,
  "rounds": [...],
  "summaryTest": [...]
}

IMPORTANT JSON RULES:
- NO extra characters before property names
- Property names must be exactly: "language", "level", "rounds", "summaryTest"
- NO dots, spaces, or quotes before property names
- Ensure all JSON is properly formatted and parseable

MISSING WORD QUALITY CONTROL:
- NEVER use interchangeable numbers (vier/fünf/drei/zwei)
- NEVER use similar colors (rot/blau/grün/gelb)
- NEVER use synonyms or valid alternatives
- Use completely different word types: nouns vs verbs vs adjectives
- Example GOOD: "Ich ____ Deutsch" → correct: "spreche" (verb), wrong: "Tisch" (noun), "schnell" (adjective), "gestern" (adverb)
- Example BAD: "Ich möchte ____ Äpfel" → "fünf", "drei", "vier", "zwei" (all numbers work!)`
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.7, // Slightly lower temperature for more consistent JSON
          top_p: 0.9,
          frequency_penalty: 0.3, // Reduce repetition
          presence_penalty: 0.2,
          response_format: { type: "json_object" }
        }),
        // Add a 45-second timeout for the main content generation
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('ChatGPT content generation timeout')), 45000)
        )
      ]);
      
      console.log(`✅ ChatGPT API call successful! Generated ${completion.choices[0].message.content?.length || 0} characters`);
      
      // Extract and parse the JSON content
      const jsonContent = completion.choices[0].message.content;
      
      if (!jsonContent) {
        console.warn('No content returned from OpenAI');
        throw new Error('Failed to generate journey content');
      }
      
      console.log(`📝 Raw response length: ${jsonContent.length} characters`);
      
      // Clean up common JSON formatting issues that ChatGPT sometimes produces
      const cleanedJson = jsonContent
        .replace(/"\.(summaryTest|rounds|language|level)"/g, '"$1"') // Remove dots before property names
        .replace(/(['"])\s*:\s*([^,}\]]*[^,}\]\s])\s*([,}\]])/g, '$1: $2$3') // Fix spacing issues
        .trim();
      
      console.log(`🧹 Cleaned JSON (first 200 chars): ${cleanedJson.substring(0, 200)}...`);
      
      // Parse and validate the JSON
      let journeyData: JourneyData;
      try {
        journeyData = JSON.parse(cleanedJson);
        console.log('✅ Successfully parsed OpenAI response');
        
        // Validate structure
        if (!journeyData.rounds || !Array.isArray(journeyData.rounds) || journeyData.rounds.length === 0) {
          console.warn('Invalid journey structure: missing or empty rounds array');
          throw new Error('Invalid journey structure: missing or empty rounds array');
        }
        
        if (!journeyData.summaryTest || !Array.isArray(journeyData.summaryTest) || journeyData.summaryTest.length === 0) {
          console.warn('Invalid journey structure: missing or empty summaryTest array');
          throw new Error('Invalid journey structure: missing or empty summaryTest array');
        }

        // Validate each round and add image support
        const isValidRound = (round: Partial<Round>): boolean => {
          if (!round || !round.type) return false;
          
          switch (round.type) {
            case 'matching':
              if (!round.englishSentence || !round.translatedSentence || !Array.isArray(round.words)) {
                return false;
              }
              // Check if words array contains all words from translatedSentence
              const translatedWords = round.translatedSentence.split(' ');
              const words = round.words as string[];
              const hasAllWords = translatedWords.every(word => words.includes(word));
              if (!hasAllWords) {
                console.warn(`⚠️ Matching exercise missing words. Expected: ${translatedWords.join(' ')}, Got: ${words.join(' ')}`);
              }
              return true;
            case 'missing_word':
              // Support both new multi-word format and legacy single-word format
              if ('missingWordIndices' in round && Array.isArray(round.missingWordIndices)) {
                return !!round.sentence && 
                       Array.isArray(round.missingWordIndices) && 
                       Array.isArray((round as MissingWordRound).correctWords) && 
                       Array.isArray(round.options);
              } else if ('missingWordIndex' in round && 'correctWord' in round) {
                // Handle legacy format
                return !!round.sentence && 
                       typeof (round as LegacyMissingWordRound).missingWordIndex === 'number' && 
                       !!(round as LegacyMissingWordRound).correctWord && 
                       Array.isArray(round.options);
              }
              return false;
            case 'spelling':
              return !!round.englishWord && !!round.correctSpelling;
            case 'image':
              return !!round.englishPrompt && !!round.targetLanguageWord && Array.isArray(round.options);
            default:
              return false;
          }
        };

        // Check each round
        const allRoundsValid = journeyData.rounds.every(isValidRound) && 
                               journeyData.summaryTest.every(isValidRound);
        
        if (!allRoundsValid) {
          console.warn('Invalid rounds in journey data');
          throw new Error('Invalid rounds in journey data');
        }
        
        // Generate images for any image rounds with optimized timeout handling
        console.log('🖼️ Processing image rounds...');
        const imageGenerationPromises: Promise<void>[] = [];
        
        for (let i = 0; i < journeyData.rounds.length; i++) {
          const round = journeyData.rounds[i];
          if (round.type === 'image') {
            console.log(`🎨 Found image round at index ${i}, scheduling image generation...`);
            
            // Generate images in parallel with timeout protection
            const imagePromise = Promise.race([
              // Image generation with 30 second timeout
              openai.images.generate({
                model: "dall-e-3",
                prompt: round.englishPrompt,
                n: 1,
                size: "1024x1024", 
                quality: "standard",
                style: "natural"
              }),
              // Timeout after 30 seconds
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Image generation timeout')), 30000)
              )
            ])
            .then(response => {
              const imageUrl = response.data?.[0]?.url;
              if (imageUrl) {
                (round as ImageRound).imageUrl = imageUrl;
                console.log(`✅ Successfully generated image for round ${i}: ${imageUrl.substring(0, 100)}...`);
              } else {
                throw new Error('No image URL returned from DALL-E 3');
              }
            })
            .catch(imageError => {
              console.error(`❌ Image generation failed for round ${i}:`, imageError);
              (round as ImageRound).imageUrl = 'https://placehold.co/1024x1024/E3F2FD/1976D2?text=Image+Unavailable';
              console.log(`🎭 Using placeholder image for round ${i} due to generation failure`);
            });
            
            imageGenerationPromises.push(imagePromise);
          }
        }
        
        // Wait for all image generations to complete (or fail with placeholders)
        if (imageGenerationPromises.length > 0) {
          console.log(`⏳ Waiting for ${imageGenerationPromises.length} image(s) to generate...`);
          await Promise.allSettled(imageGenerationPromises);
          console.log('🖼️ All image processing completed');
        }
        
        // Process the journey data to scramble words for matching rounds
        journeyData = processJourneyData(journeyData);
        
        console.log(`Successfully generated journey with ${journeyData.rounds.length} rounds and ${journeyData.summaryTest.length} test rounds`);
        return NextResponse.json(journeyData);
      } catch (parseError) {
        console.error('Error parsing journey data:', parseError);
        console.error('Raw OpenAI response:', jsonContent);
        throw new Error('Failed to parse journey content');
      }
    } catch (openaiError) {
      console.error('❌ OpenAI generation failed:', openaiError);
      
      // Add specific error handling for common issues
      if (openaiError instanceof Error) {
        console.error('Error message:', openaiError.message);
        
        // For JSON parsing errors, let's try to fix and retry once more
        if (openaiError.message.includes('Failed to parse journey content')) {
          console.log('🔄 JSON parsing failed, but this means ChatGPT is working. Check the cleaned JSON format above.');
          console.log('🚫 FORCING FALLBACK TO DEBUG - but ChatGPT generation is actually working!');
        }
        
        // Check for quota/billing issues
        if (openaiError.message.includes('quota') || openaiError.message.includes('billing')) {
          console.error('🚨 OpenAI quota/billing issue detected - falling back to static content');
        }
        // Check for rate limiting
        else if (openaiError.message.includes('rate_limit')) {
          console.error('🚨 OpenAI rate limit exceeded - falling back to static content');
        }
        // Check for timeout issues
        else if (openaiError.message.includes('timeout') || openaiError.message.includes('504')) {
          console.error('🚨 OpenAI timeout detected - falling back to static content');
        }
        // Check for authentication issues
        else if (openaiError.message.includes('authentication') || openaiError.message.includes('api_key')) {
          console.error('🚨 OpenAI authentication issue - falling back to static content');
        }
        else {
          console.error('🚨 Unknown OpenAI error - falling back to static content');
        }
      }
      
      // TEMPORARY: Comment out fallback to force debugging of ChatGPT issues
      console.log('📦 Using fallback journey data...');
      return NextResponse.json(getFallbackJourney(language, userLevel));
    }
  } catch (error) {
    console.error('Journey generation error:', error);
    // Always return something usable to avoid breaking the UI
    return NextResponse.json(
      getFallbackJourney('en', 1), 
      { status: 200 }  // Return 200 with fallback data instead of 500
    );
  }
}

// Get fallback journey content based on language
function getFallbackJourney(language: string, level: number): JourneyData {
  console.log(`📦 Using fallback journey for ${language} at level ${level}`);
  
  // Try new intelligent fallback first
  console.log(`🔍 Attempting to find smart fallback for ${language}...`);
  const smartFallback = createLanguageSpecificFallback(language, level);
  if (smartFallback) {
    console.log(`✅ Found smart fallback data for ${language}, returning it!`);
    return processJourneyData(smartFallback);
  } else {
    console.log(`❌ No smart fallback found for ${language}, trying cached data...`);
  }
  
  // Use cached fallback if available
  if (FALLBACK_DATA[language]) {
    console.log(`🗂️ Found cached fallback data for ${language}`);
    const fallback = {...FALLBACK_DATA[language]!};
    fallback.level = level; // Update level to match request
    fallback.language = language; // Ensure language code is correct
    
    // Process the fallback data to scramble words in matching rounds
    return processJourneyData(fallback);
  }
  
  // Modify English fallback for other languages
  console.log(`🔄 No specific fallback for ${language}, adapting English template`);
  const fallback = JSON.parse(JSON.stringify(FALLBACK_DATA.en));
  fallback.language = language;
  fallback.level = level;
  
  // Add language-specific fallback content
  if (language === 'pt-BR') {
    // Brazilian Portuguese fallback
    fallback.rounds[0] = {
      type: 'matching',
      englishSentence: "Hello, how are you?",
      translatedSentence: 'Olá, como você está?',
      words: ['Olá,', 'como', 'você', 'está?']
    };
    
    fallback.rounds[1] = {
      type: 'missing_word',
      sentence: 'Eu gosto de tomar café de manhã',
      missingWordIndex: 3,
      correctWord: 'tomar',
      options: ['tomar', 'mesa', 'janela', 'azul']
    };
    
    fallback.rounds[2] = {
      type: 'spelling',
      englishWord: "book",
      correctSpelling: 'livro'
    };
    
    // Update test round
    fallback.summaryTest[0] = {
      type: 'matching',
      englishSentence: "Thank you very much",
      translatedSentence: 'Muito obrigado',
      words: ['Muito', 'obrigado']
    };
  } else if (language === 'zh') {
    // Chinese fallback
    fallback.rounds[0] = {
      type: 'matching',
      englishSentence: "Hello, how are you?",
      translatedSentence: '你好，你好吗？',
      words: ['你好，', '你', '好吗？']
    };
    
    fallback.rounds[1] = {
      type: 'missing_word',
      sentence: '我喜欢早上喝咖啡',
      missingWordIndex: 2,
      correctWord: '早上',
      options: ['早上', '桌子', '窗户', '蓝色']
    };
    
    fallback.rounds[2] = {
      type: 'spelling',
      englishWord: "book",
      correctSpelling: '书'
    };
    
    fallback.summaryTest[0] = {
      type: 'matching',
      englishSentence: "Thank you very much",
      translatedSentence: '非常感谢',
      words: ['非常', '感谢']
    };
  } else if (language === 'ko') {
    // Korean fallback
    fallback.rounds[0] = {
      type: 'matching',
      englishSentence: "Hello, how are you?",
      translatedSentence: '안녕하세요, 어떻게 지내세요?',
      words: ['안녕하세요,', '어떻게', '지내세요?']
    };
    
    fallback.rounds[1] = {
      type: 'missing_word',
      sentence: '저는 아침에 커피 마시는 것을 좋아해요',
      missingWordIndex: 3,
      correctWord: '커피',
      options: ['커피', '테이블', '창문', '파란색']
    };
    
    fallback.rounds[2] = {
      type: 'spelling',
      englishWord: "book",
      correctSpelling: '책'
    };
    
    fallback.summaryTest[0] = {
      type: 'matching',
      englishSentence: "Thank you very much",
      translatedSentence: '정말 감사합니다',
      words: ['정말', '감사합니다']
    };
  } else if (language === 'no') {
    // Norwegian fallback
    fallback.rounds[0] = {
      type: 'matching',
      englishSentence: "Hello, how are you?",
      translatedSentence: 'Hei, hvordan har du det?',
      words: ['Hei,', 'hvordan', 'har', 'du', 'det?']
    };
    
    fallback.rounds[1] = {
      type: 'missing_word',
      sentence: 'Jeg liker å drikke kaffe om morgenen',
      missingWordIndex: 4,
      correctWord: 'drikke',
      options: ['drikke', 'bord', 'vindu', 'blå']
    };
    
    fallback.rounds[2] = {
      type: 'spelling',
      englishWord: "book",
      correctSpelling: 'bok'
    };
    
    fallback.summaryTest[0] = {
      type: 'matching',
      englishSentence: "Thank you very much",
      translatedSentence: 'Tusen takk',
      words: ['Tusen', 'takk']
    };
  } else if (language === 'ar') {
    // Arabic fallback
    fallback.rounds[0] = {
      type: 'matching',
      englishSentence: "Hello, how are you?",
      translatedSentence: 'مرحبا، كيف حالك؟',
      words: ['مرحبا،', 'كيف', 'حالك؟']
    };
    
    fallback.rounds[1] = {
      type: 'missing_word',
      sentence: 'أحب شرب القهوة في الصباح',
      missingWordIndex: 2,
      correctWord: 'شرب',
      options: ['شرب', 'طاولة', 'نافذة', 'أزرق']
    };
    
    fallback.rounds[2] = {
      type: 'spelling',
      englishWord: "book",
      correctSpelling: 'كتاب'
    };
    
    fallback.summaryTest[0] = {
      type: 'matching',
      englishSentence: "Thank you very much",
      translatedSentence: 'شكرا جزيلا',
      words: ['شكرا', 'جزيلا']
    };
  } else if (language in LANGUAGE_NAMES) {
    // Generic fallback with placeholder text - but this should never happen for pt-BR now
    console.warn(`Using generic fallback for ${language} - this indicates a problem!`);
    const langName = LANGUAGE_NAMES[language];
    fallback.rounds[0].translatedSentence = `[Translation to ${langName} would be here]`;
    if (fallback.rounds[0].type === 'matching') {
      fallback.rounds[0].words = [`[Words`, `in`, `${langName}`, `would`, `be`, `here]`];
    }
  }
  
  // Process the fallback data to scramble words in matching rounds
  return processJourneyData(fallback);
}

// Process the journey data, scrambling words for matching rounds
function processJourneyData(journeyData: JourneyData): JourneyData {
  // Process regular rounds
  journeyData.rounds = journeyData.rounds.map(round => {
    if (round.type === 'matching') {
      return {
        ...round,
        words: shuffleArray([...round.words]) // Scramble the words
      };
    }
    return round;
  });
  
  // Process summary test rounds
  journeyData.summaryTest = journeyData.summaryTest.map(round => {
    if (round.type === 'matching') {
      return {
        ...round,
        words: shuffleArray([...round.words]) // Scramble the words
      };
    }
    return round;
  });
  
  return journeyData;
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
} 