import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Configure route segment
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

// Define language mapping
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

// Define level descriptions
const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'Complete beginner - basic common words',
  2: 'Early beginner - everyday vocabulary',
  3: 'Beginner - common words and phrases',
  4: 'Early intermediate - expanded vocabulary',
  5: 'Intermediate - varied vocabulary',
  6: 'Upper intermediate - complex vocabulary',
  7: 'Early advanced - sophisticated vocabulary',
  8: 'Advanced - specialized vocabulary',
  9: 'Expert - advanced vocabulary',
  10: 'Native-like - nuanced vocabulary'
};

type FlashcardWord = {
  word: string;
  translation: string;
  context?: string;
};

type FlashcardResponse = {
  language: string;
  level: number;
  words: FlashcardWord[];
};

export async function POST(req: Request) {
  try {
    const { language, level } = await req.json();

    // Validate input
    if (!language || !level) {
      return NextResponse.json(
        { error: 'Language and level are required' },
        { status: 400 }
      );
    }

    if (level < 1 || level > 10) {
      return NextResponse.json(
        { error: 'Level must be between 1 and 10' },
        { status: 400 }
      );
    }

    const languageName = LANGUAGE_NAMES[language];
    if (!languageName) {
      return NextResponse.json(
        { error: 'Unsupported language' },
        { status: 400 }
      );
    }

    const levelDescription = LEVEL_DESCRIPTIONS[level];

    // Create the prompt for generating flashcards
    const prompt = `Generate exactly 20 vocabulary words for learning ${languageName} at level ${level}/10 (${levelDescription}).

REQUIREMENTS:
- Focus on practical, commonly used words appropriate for this level
- Include a mix of nouns, verbs, adjectives, and other word types
- Provide the word in ${languageName} and its English translation
- For each word, optionally include a simple context sentence in ${languageName}
- Words should be progressively appropriate for level ${level}

FORMAT YOUR RESPONSE AS JSON:
{
  "words": [
    {
      "word": "word in ${languageName}",
      "translation": "English translation",
      "context": "Optional simple sentence using the word in ${languageName}"
    }
  ]
}

Generate words that are:
${level <= 3 ? '- Very basic, everyday vocabulary (family, food, colors, numbers, common verbs)' : 
  level <= 6 ? '- Intermediate vocabulary (hobbies, work, travel, emotions, activities)' : 
  '- Advanced vocabulary (abstract concepts, specialized terms, nuanced expressions)'}
`;

    // Call OpenAI API with gpt-4o-mini
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a language learning expert creating vocabulary flashcards. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let flashcardData;
    try {
      // Clean up the response text in case it has markdown formatting
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      flashcardData = JSON.parse(cleanedResponse);
    } catch {
      console.error('Failed to parse OpenAI response:', responseText);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Validate the response structure
    if (!flashcardData.words || !Array.isArray(flashcardData.words)) {
      throw new Error('Invalid flashcard data structure');
    }

    // Ensure we have exactly 20 words
    if (flashcardData.words.length !== 20) {
      console.warn(`Expected 20 words, got ${flashcardData.words.length}`);
    }

    // Validate each word has required fields
    const validWords = flashcardData.words.filter((word: unknown) => {
      const w = word as { word?: string; translation?: string };
      return w.word && w.translation && typeof w.word === 'string' && typeof w.translation === 'string';
    }).slice(0, 20); // Ensure max 20 words

    if (validWords.length < 15) {
      throw new Error('Insufficient valid words generated');
    }

    const response: FlashcardResponse = {
      language,
      level,
      words: validWords
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating flashcards:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate flashcards',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 