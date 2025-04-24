import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createChatMessage } from "@/lib/supabase-db";
import S3 from "aws-sdk/clients/s3";

// Define OpenAI voice types
type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Language configurations (same as in chat/route.ts)
const LANGUAGE_CONFIGS: Record<string, { instructions: string; voice: string }> = {
  en: {
    instructions: `You are a friendly and engaging English language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their English. Follow these guidelines:
1. Always respond conversationally first, keeping the dialogue flowing
2. Then provide gentle corrections if needed, marked with 💡
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation
5. Provide cultural context when relevant, marked with 🌍
6. Keep responses concise but informative

Example format:
[Conversational response continuing the dialogue]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question to keep the conversation going]`,
    voice: "shimmer",
  },
  de: {
    instructions: `You are a friendly and engaging German language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their German. Follow these guidelines:
1. Always respond in German first, followed by an English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation

Example format:
🇩🇪 [German response continuing the dialogue]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in German with translation]`,
    voice: "shimmer",
  },
  zh: {
    instructions: `You are a friendly and engaging Mandarin Chinese conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Mandarin. Follow these guidelines:
1. Always respond in Chinese characters first, followed by pinyin and English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation
5. Provide cultural context about Chinese-speaking regions when relevant

Example format:
🇨🇳 [Chinese characters response]
📝 Pinyin: [pinyin with tones]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Chinese with pinyin and translation]`,
    voice: "shimmer",
  },
  no: {
    instructions: `You are a friendly and engaging Norwegian language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Norwegian. Follow these guidelines:
1. Always respond in Norwegian first, followed by an English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation

Example format:
🇳🇴 [Norwegian response continuing the dialogue]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Norwegian with translation]`,
    voice: "shimmer",
  },
  "pt-BR": {
    instructions: `You are a friendly and engaging Brazilian Portuguese language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Brazilian Portuguese. Follow these guidelines:
1. Always respond in Brazilian Portuguese first, followed by an English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation

Example format:
🇧🇷 [Brazilian Portuguese response continuing the dialogue]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Portuguese with translation]`,
    voice: "shimmer",
  },
};

// Helper to extract language-specific text for TTS
function extractLanguageText(text: string, languageCode: string): string {
  const lines = text.split('\n');
  const ttsText = [];
  
  // For English, use the conversational response part (before any corrections)
  if (languageCode === 'en') {
    // Take text until we hit a line with an emoji
    for (const line of lines) {
      if (/[💡❓🌍]/.test(line)) {
        break;
      }
      if (line.trim()) {
        ttsText.push(line.trim());
      }
    }
  } else if (languageCode === 'de') {
    for (const line of lines) {
      if (line.startsWith('🇩🇪')) {
        // Get text between 🇩🇪 and 🇺🇸 if present
        let germanText = line.split('🇩🇪')[1];
        if (germanText.includes('🇺🇸')) {
          germanText = germanText.split('🇺🇸')[0];
        }
        ttsText.push(germanText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the German part before any translation
        let question = line.replace('❓', '').trim();
        if (question.includes('/')) {
          question = question.split('/')[0];
        }
        ttsText.push(question.trim());
      }
    }
  } else if (languageCode === 'zh') {
    for (const line of lines) {
      if (line.startsWith('🇨🇳')) {
        // Get text between 🇨🇳 and 📝 (before pinyin)
        let chineseText = line.split('🇨🇳')[1];
        if (chineseText.includes('📝')) {
          chineseText = chineseText.split('📝')[0];
        }
        ttsText.push(chineseText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the Chinese part before pinyin
        let question = line.replace('❓', '').trim();
        if (question.includes('📝')) {
          question = question.split('📝')[0];
        }
        ttsText.push(question.trim());
      }
    }
  } else if (languageCode === 'no') {
    for (const line of lines) {
      if (line.startsWith('🇳🇴')) {
        // Get text between 🇳🇴 and 🇺🇸
        let norwegianText = line.split('🇳🇴')[1];
        if (norwegianText.includes('🇺🇸')) {
          norwegianText = norwegianText.split('🇺🇸')[0];
        }
        ttsText.push(norwegianText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the Norwegian part before translation
        let question = line.replace('❓', '').trim();
        if (question.includes('/')) {
          question = question.split('/')[0];
        }
        ttsText.push(question.trim());
      }
    }
  } else if (languageCode === 'pt-BR') {
    for (const line of lines) {
      if (line.startsWith('🇧🇷')) {
        // Get text between 🇧🇷 and 🇺🇸
        let portugueseText = line.split('🇧🇷')[1];
        if (portugueseText.includes('🇺🇸')) {
          portugueseText = portugueseText.split('🇺🇸')[0];
        }
        ttsText.push(portugueseText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the Portuguese part before translation
        let question = line.replace('❓', '').trim();
        if (question.includes('/')) {
          question = question.split('/')[0];
        }
        ttsText.push(question.trim());
      }
    }
  }
  
  // Join all extracted text with proper spacing
  const combinedText = ttsText.join(' ').trim();
  return combinedText || text;
}

// Configure S3
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // Get form data from the request
    const formData = await req.formData();
    const audio = formData.get("audio") as File;
    const language = formData.get("language") as string;
    const userId = formData.get("userId") as string;

    if (!audio) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    // Convert language to code
    const languageMapping: Record<string, string> = {
      "English": "en",
      "German": "de",
      "Portuguese (Brazilian)": "pt-BR",
      "Chinese": "zh",
      "Norwegian": "no",
    };

    const languageCode = languageMapping[language] || "en";

    // Transcribe audio using OpenAI
    const audioArrayBuffer = await audio.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], "audio.mp3", { type: audio.type }),
      model: "whisper-1",
      language: languageCode,
    });

    // Get user's message from transcription
    const userMessage = transcription.text;

    // Get language configuration
    const config = LANGUAGE_CONFIGS[languageCode] || LANGUAGE_CONFIGS.en;

    // Generate text response using GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: config.instructions },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 700,
    });

    const textResponse = completion.choices[0].message.content || "Sorry, I couldn't generate a response.";

    // Extract language-specific text for TTS
    const ttsText = extractLanguageText(textResponse, languageCode);

    // Generate audio using OpenAI
    let audioUrl = null;
    try {
      const voiceMapping: Record<string, OpenAIVoice> = {
        'en': 'shimmer',  // Female voice for English
        'de': 'onyx',     // Male voice for German
        'zh': 'nova',     // Female voice for Chinese
        'no': 'echo',     // Female voice for Norwegian
        'pt-BR': 'alloy'  // Neural voice for Portuguese
      };

      const voice = voiceMapping[languageCode] || 'shimmer';

      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice,
        input: ttsText,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const audioFilename = `audio_${timestamp}_${randomString}.mp3`;

      // Upload to S3
      const result = await s3.upload({
        Bucket: process.env.AWS_S3_BUCKET_AUDIO || "",
        Key: `audio/${audioFilename}`,
        Body: buffer,
        ContentType: "audio/mpeg",
        CacheControl: "max-age=3600",
        Metadata: {
          language: languageCode,
          timestamp: timestamp.toString(),
        },
      }).promise();

      audioUrl = result.Location;

      // Store chat history in database if userId is provided
      if (userId) {
        await createChatMessage({
          userId,
          language,
          message: userMessage,
          response: textResponse,
          audioUrl,
        });
      }
    } catch (error) {
      console.error("Error generating audio:", error);
    }

    return NextResponse.json({
      transcribed_text: userMessage,
      response: textResponse,
      audio_url: audioUrl,
    });
  } catch (error) {
    console.error("Audio chat error:", error);
    return NextResponse.json(
      { error: "Failed to process audio chat request" },
      { status: 500 }
    );
  }
} 