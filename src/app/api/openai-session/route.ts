import { NextResponse } from 'next/server';

export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    // Create a new OpenAI session for real-time audio
    // We need to use the REST API directly because the SDK might not support realtime sessions yet
    const response = await fetch('https://api.openai.com/v1/audio/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to create session: ${response.status}`);
    }

    const session = await response.json();

    // Include session ID and ICE servers in the response
    return NextResponse.json({
      session_id: session.id,
      ice_servers: session.ice_servers,
      expires_at: session.expires_at
    });
  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    return NextResponse.json(
      { error: 'Failed to create OpenAI session' },
      { status: 500 }
    );
  }
}