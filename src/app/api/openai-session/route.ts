import { NextResponse } from 'next/server';

export async function POST() {
    try {        
        if (!process.env.OPENAI_API_KEY) {
            throw new Error(`OPENAI_API_KEY is not set`);
        }

        // Return the API key directly
        return NextResponse.json({
            api_key: process.env.OPENAI_API_KEY
        });
    } catch (error) {
        console.error("Error fetching session data:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch session data" }, 
            { status: 500 }
        );
    }
}