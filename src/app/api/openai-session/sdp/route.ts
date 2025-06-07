import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error(`OPENAI_API_KEY is not set`);
        }

        const url = new URL(request.url);
        const sessionId = url.searchParams.get('session_id');
        
        if (!sessionId) {
            return NextResponse.json(
                { error: 'Session ID is required' },
                { status: 400 }
            );
        }

        const sdpOffer = await request.text();
        if (!sdpOffer) {
            return NextResponse.json(
                { error: 'SDP offer is required' },
                { status: 400 }
            );
        }
        
        // Forward the SDP offer to OpenAI
        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = "gpt-4o-mini-realtime-preview-2024-12-17";
        const response = await fetch(`${baseUrl}?model=${model}&voice=alloy&session_id=${sessionId}`, {
            method: "POST",
            body: sdpOffer,
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/sdp",
            },
        });

        if (!response.ok) {
            // Try to parse error as JSON first
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                return NextResponse.json(
                    { error: error.error?.message || `Failed to exchange SDP: ${response.status}` },
                    { status: response.status }
                );
            }
            
            // If not JSON, return the error text
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Failed to exchange SDP: ${errorText}` },
                { status: response.status }
            );
        }

        // Return the SDP answer
        const sdpAnswer = await response.text();
        return new NextResponse(sdpAnswer, {
            headers: {
                'Content-Type': 'application/sdp'
            }
        });
    } catch (error) {
        console.error("Error exchanging SDP:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to exchange SDP" },
            { status: 500 }
        );
    }
} 