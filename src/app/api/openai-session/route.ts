import { NextResponse } from 'next/server';

export async function POST() {
    try {        
        if (!process.env.OPENAI_API_KEY) {
            throw new Error(`OPENAI_API_KEY is not set`);
        }

        // Create the WebRTC session on the server side
        const baseUrl = "https://api.openai.com/v1/realtime/sessions";
        const response = await fetch(baseUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "alloy",
                modalities: ["audio", "text"],
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Failed to create session: ${response.status}`);
        }

        const sessionData = await response.json();

        // Return all necessary session data
        return NextResponse.json({
            session_id: sessionData.id, // Note: OpenAI might return it as 'id' rather than 'session_id'
            ice_servers: sessionData.ice_servers || [{ urls: "stun:stun.l.google.com:19302" }],
            expires_at: sessionData.expires_at,
            status: sessionData.status
        });
    } catch (error) {
        console.error("Error creating session:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create session" }, 
            { status: 500 }
        );
    }
}