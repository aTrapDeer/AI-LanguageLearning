import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Define types for rounds
type MatchingRound = {
  type: 'matching';
  englishSentence: string;
  translatedSentence: string;
  words: string[];
};

type MissingWordRound = {
  type: 'missing_word';
  sentence: string;
  missingWordIndex: number;
  correctWord: string;
  options: string[];
};

type SpellingRound = {
  type: 'spelling';
  englishWord: string;
  correctSpelling: string;
};

type Round = MatchingRound | MissingWordRound | SpellingRound;

type JourneyData = {
  language: string;
  level: number;
  rounds: Round[];
  summaryTest: Round[];
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

// Try to load German fallback data
try {
  const germanFallbackPath = path.join(process.cwd(), 'src/static/sample-journey.json');
  if (fs.existsSync(germanFallbackPath)) {
    const germanData = fs.readFileSync(germanFallbackPath, 'utf8');
    FALLBACK_DATA.de = JSON.parse(germanData);
  }
} catch (error) {
  console.error('Failed to load German fallback data:', error);
}

// Generate journey content
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { language, level } = body;

    console.log(`Journey generation requested for language: ${language}, level: ${level}`);
    
    // Validate language code
    if (!language) {
      console.warn('No language code provided, defaulting to English');
      return NextResponse.json(getFallbackJourney('en', level || 1));
    }
    
    // Default to level 1 if not provided or invalid
    const userLevel = level && Number.isInteger(level) && level > 0 && level <= 10 
      ? level 
      : 1;
    
    // Get language name from code, default to English
    const languageName = LANGUAGE_NAMES[language] || 'English';
    const levelDescription = LEVEL_DESCRIPTIONS[userLevel] || LEVEL_DESCRIPTIONS[1];
    
    console.log(`Using language name: ${languageName} at level: ${userLevel}`);
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY is not set, using fallback journey data');
      return NextResponse.json(getFallbackJourney(language, userLevel));
    }

    // Try to generate with OpenAI
    try {
      // ChatGPT prompt to generate journey content
      const prompt = `
Create an educational language learning journey for a ${levelDescription} student learning ${languageName}. The journey should have 10 regular rounds plus a 3-round summary test.

IMPORTANT: Carefully adjust the difficulty of ALL content to match the student's level (${userLevel}/10):
- Level 1-2: Very simple words and phrases (greetings, numbers, colors)
- Level 3-4: Basic everyday vocabulary and simple sentences
- Level 5-6: Intermediate vocabulary, longer sentences, some grammar complexity
- Level 7-8: Advanced vocabulary, complex sentences, idioms
- Level 9-10: Native-level content, sophisticated vocabulary, cultural nuances

The journey should include these round types:
1. Matching rounds: User matches English words/phrases with their ${languageName} translations
2. Missing word rounds: User selects the correct missing word in a ${languageName} sentence
3. Spelling rounds: User types the ${languageName} spelling for an English word

Create a good mix of these types across the 10 rounds and 3 test rounds. For each round:

- Make content STRICTLY appropriate for a level ${userLevel}/10 student
- Ensure translations and spellings are accurate
- Provide all necessary data for the round format

For matching rounds, include:
- "type": "matching"
- "englishSentence": English sentence (e.g. "Hello, how are you?")
- "translatedSentence": Translation in ${languageName} (e.g. "Hallo, wie geht es dir?")
- "words": An array containing each word from the translated sentence in the correct order (e.g. ["Hallo,", "wie", "geht", "es", "dir?"])

For missing word rounds, include:
- "type": "missing_word"
- "sentence": A sentence in ${languageName} (e.g. "Ich trinke gerne Kaffee am Morgen")
- "missingWordIndex": The zero-based index of the word to hide (e.g. 2 for "gerne" in the example)
- "correctWord": The word that will be hidden (e.g. "gerne")
- "options": An array of EXACTLY 4 words total:
  * The correct word (only one correct answer)
  * 3 obviously incorrect options that don't fit grammatically or semantically in the sentence
  * For example: ["gerne", "Apfel", "schlafen", "Berg"] where "gerne" is correct and the others are clearly wrong

For spelling rounds, include:
- "type": "spelling"
- "englishWord": A word in English (e.g. "book")
- "correctSpelling": The correct spelling in ${languageName} (e.g. "Buch")

DIFFICULTY CALIBRATION EXAMPLES:
- Level 1: Very simple words like "hello", "thank you", colors, numbers 1-10
- Level 3: Simple sentences like "I like coffee", basic verbs, common nouns
- Level 5: Everyday conversations, past tense, multiple clauses
- Level 7: Complex topics, subjunctive mood, specialized vocabulary
- Level 10: Literature-level language, cultural references, idioms, nuanced expressions

Here's an example of a complete matching round:
{
  "type": "matching",
  "englishSentence": "Hello, how are you?",
  "translatedSentence": "Hallo, wie geht es dir?",
  "words": ["Hallo,", "wie", "geht", "es", "dir?"]
}

Here's an example of a complete missing word round:
{
  "type": "missing_word",
  "sentence": "Ich trinke gerne Kaffee am Morgen",
  "missingWordIndex": 2,
  "correctWord": "gerne",
  "options": ["gerne", "Schlüssel", "Fenster", "blau"]
}

Format your response as a single JSON object with this structure:
{
  "language": "${language}",
  "level": ${userLevel},
  "rounds": [
    // 10 rounds with a mix of types
  ],
  "summaryTest": [
    // 3 test rounds with a mix of types
  ]
}
`;

      // Generate content with ChatGPT
      console.log('Calling OpenAI API...');
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a language learning curriculum designer. You create educational content for language learners. You only respond in valid JSON format. Follow the example format exactly."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      // Extract and parse the JSON content
      const jsonContent = completion.choices[0].message.content;
      
      if (!jsonContent) {
        console.warn('No content returned from OpenAI');
        throw new Error('Failed to generate journey content');
      }
      
      // Parse and validate the JSON
      let journeyData: JourneyData;
      try {
        journeyData = JSON.parse(jsonContent);
        console.log('Successfully parsed OpenAI response');
        
        // Validate structure
        if (!journeyData.rounds || !Array.isArray(journeyData.rounds) || journeyData.rounds.length === 0) {
          console.warn('Invalid journey structure: missing or empty rounds array');
          throw new Error('Invalid journey structure: missing or empty rounds array');
        }
        
        if (!journeyData.summaryTest || !Array.isArray(journeyData.summaryTest) || journeyData.summaryTest.length === 0) {
          console.warn('Invalid journey structure: missing or empty summaryTest array');
          throw new Error('Invalid journey structure: missing or empty summaryTest array');
        }

        // Validate each round
        const isValidRound = (round: Partial<Round>): boolean => {
          if (!round || !round.type) return false;
          
          switch (round.type) {
            case 'matching':
              return !!round.englishSentence && !!round.translatedSentence && Array.isArray(round.words);
            case 'missing_word':
              return !!round.sentence && 
                     (typeof round.missingWordIndex === 'number') && 
                     !!round.correctWord && 
                     Array.isArray(round.options);
            case 'spelling':
              return !!round.englishWord && !!round.correctSpelling;
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
        
        // Process the journey data to scramble words for matching rounds
        journeyData = processJourneyData(journeyData);
        
        console.log(`Successfully generated journey with ${journeyData.rounds.length} rounds and ${journeyData.summaryTest.length} test rounds`);
        return NextResponse.json(journeyData);
      } catch (parseError) {
        console.error('Error parsing journey data:', parseError);
        throw new Error('Failed to parse journey content');
      }
    } catch (openaiError) {
      console.error('OpenAI error:', openaiError);
      // Fall back to predefined content
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
  console.log(`Using fallback journey for ${language} at level ${level}`);
  
  // Use language-specific fallback if available
  if (FALLBACK_DATA[language]) {
    console.log(`Found specific fallback data for ${language}`);
    const fallback = {...FALLBACK_DATA[language]!};
    fallback.level = level; // Update level to match request
    fallback.language = language; // Ensure language code is correct
    
    // Process the fallback data to scramble words in matching rounds
    return processJourneyData(fallback);
  }
  
  // Modify English fallback for other languages
  console.log(`No specific fallback for ${language}, adapting English template`);
  const fallback = JSON.parse(JSON.stringify(FALLBACK_DATA.en));
  fallback.language = language;
  fallback.level = level;
  
  // Try to add some language-specific fallback indicators
  if (language in LANGUAGE_NAMES) {
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