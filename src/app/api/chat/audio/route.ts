import { NextResponse } from "next/server";
import OpenAI from "openai";
import S3 from "aws-sdk/clients/s3";
import { createChatMessage } from "@/lib/supabase-db";
import { extractFollowUpQuestion, extractLanguageText, OpenAIVoice } from "../chat-utils";

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
  ko: {
    instructions: `You are a friendly and engaging Korean language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Korean. Follow these guidelines:
1. Always respond in Korean first using Hangul, followed by romanized pronunciation guide and English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation
5. Provide cultural context about Korean-speaking regions when relevant

Example format:
🇰🇷 [Korean response in Hangul continuing the dialogue]
📝 발음: [romanized pronunciation guide]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Korean with romanization and translation]`,
    voice: "nova",
  },
  ar: {
    instructions: `You are a friendly and engaging Arabic language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Arabic. Follow these guidelines:
1. Always respond in Arabic script first, followed by romanized pronunciation guide and English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation
5. Provide cultural context about Arabic-speaking regions when relevant

Example format:
🇸🇦 [Arabic response continuing the dialogue]
📝 النطق: [romanized pronunciation guide]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Arabic with romanization and translation]`,
    voice: "onyx",
  },
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const language = formData.get("language") as string;
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    // Configure OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert language to code
    const languageMapping: Record<string, string> = {
      English: "en",
      German: "de",
      "Portuguese (Brazilian)": "pt-BR",
      Chinese: "zh",
      Norwegian: "no",
      Korean: "ko",
      Arabic: "ar"
    };

    const languageCode = languageMapping[language] || "en";

    // Get language configuration
    const config = LANGUAGE_CONFIGS[languageCode] || LANGUAGE_CONFIGS.en;

    // Configure S3
    const s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || "us-east-1",
    });

    // Convert File to ArrayBuffer for OpenAI API
    const audioBytes = await audioFile.arrayBuffer();

    // Step 1: Transcribe the audio
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBytes], audioFile.name, { type: audioFile.type }),
      model: "whisper-1",
      language: languageCode === "en" ? "en" : undefined, // Only provide language hint for English
    });

    const userMessage = transcription.text;

    // Step 2: Generate response from GPT-4
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

    // Extract the main response and follow-up question
    const { mainResponse, followUpQuestion } = extractFollowUpQuestion(textResponse);
    
    // Extract language-specific text for TTS
    const ttsText = extractLanguageText(mainResponse, languageCode);

    // Step 3: Convert response to speech
    const voiceMapping: Record<string, OpenAIVoice> = {
      en: "shimmer", // Female voice for English
      de: "onyx",    // Male voice for German
      zh: "nova",    // Female voice for Chinese
      no: "echo",    // Female voice for Norwegian
      "pt-BR": "alloy", // Neural voice for Portuguese
      ko: "nova",    // Female voice for Korean
      ar: "onyx"     // Male voice for Arabic
    };

    const voice = voiceMapping[languageCode] || "shimmer";

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
    const result = await s3
      .upload({
        Bucket: process.env.AWS_S3_BUCKET_AUDIO || "",
        Key: `audio/${audioFilename}`,
        Body: buffer,
        ContentType: "audio/mpeg",
        CacheControl: "max-age=3600",
        Metadata: {
          language: languageCode,
          timestamp: timestamp.toString(),
        },
      })
      .promise();

    const audioUrl = result.Location;

    // Store chat history in database if userId is provided
    const userId = formData.get("userId") as string;
    if (userId) {
      await createChatMessage({
        userId,
        language,
        message: userMessage,
        response: textResponse, // Store the complete response in the database
        audioUrl,
      });
    }

    return NextResponse.json({
      response: mainResponse,
      follow_up_question: followUpQuestion,
      audio_url: audioUrl,
      transcription: userMessage,
    });
  } catch (error: unknown) {
    console.error("Error processing audio:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: "Failed to process audio",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
} 