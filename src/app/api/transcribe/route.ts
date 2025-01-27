import { NextResponse } from 'next/server';

// Map full language names to ISO-639-1 codes
const languageToISO: Record<string, string> = {
    'English': 'en',
    'German': 'de',
    'Portuguese (Brazilian)': 'pt',
    'Chinese': 'zh',
    'Norwegian': 'no'
};

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const audioBlob = formData.get('audio') as Blob;
        const language = formData.get('language') as string;

        if (!audioBlob) {
            throw new Error('No audio file provided');
        }

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set');
        }

        // Get ISO language code
        const languageCode = languageToISO[language] || language.toLowerCase();
        console.log('Language:', language, 'Code:', languageCode);

        // Convert blob to file
        const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

        // Create form data for OpenAI API
        const openAIFormData = new FormData();
        openAIFormData.append('file', file);
        openAIFormData.append('model', 'whisper-1');
        openAIFormData.append('language', languageCode);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: openAIFormData,
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Transcription API Error:', {
                status: response.status,
                error,
                language: languageCode
            });
            throw new Error(`Transcription failed: ${error}`);
        }

        const data = await response.json();
        return NextResponse.json({ text: data.text });
    } catch (error) {
        console.error('Error transcribing audio:', error);
        return NextResponse.json(
            { error: 'Failed to transcribe audio', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
} 
