import { NextResponse } from "next/server";
import { buildOpenAIRealtimeSession, getOpenAIRealtimeConfig } from "@/lib/openai-realtime";

export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: buildOpenAIRealtimeSession(),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error?.message || `Failed to create realtime client secret: ${response.status}`);
    }

    const sessionData = await response.json();
    const realtimeConfig = getOpenAIRealtimeConfig();

    return NextResponse.json({
      client_secret: sessionData.client_secret?.value ?? null,
      expires_at: sessionData.client_secret?.expires_at ?? null,
      model: realtimeConfig.model,
      voice: realtimeConfig.voice,
    });
  } catch (error) {
    console.error("Error creating realtime client secret:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create realtime client secret" },
      { status: 500 }
    );
  }
}
