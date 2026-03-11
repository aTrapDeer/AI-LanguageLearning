import { NextResponse } from "next/server";
import { buildOpenAIRealtimeSession, buildTravelRealtimeSession } from "@/lib/openai-realtime";
import { isSupportedLanguageCode } from "@/lib/language-config";

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const requestedLanguage = searchParams.get("language");
    const sessionConfig =
      mode === "travel" && requestedLanguage && isSupportedLanguageCode(requestedLanguage)
        ? buildTravelRealtimeSession(requestedLanguage)
        : buildOpenAIRealtimeSession();

    const sdpOffer = await request.text();
    if (!sdpOffer) {
      return NextResponse.json({ error: "SDP offer is required" }, { status: 400 });
    }

    const formData = new FormData();
    formData.set("sdp", sdpOffer);
    formData.set("session", JSON.stringify(sessionConfig));

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const error = await response.json().catch(() => null);
        return NextResponse.json(
          { error: error?.error?.message || `Failed to exchange SDP: ${response.status}` },
          { status: response.status }
        );
      }

      return NextResponse.json(
        { error: `Failed to exchange SDP: ${await response.text()}` },
        { status: response.status }
      );
    }

    const sdpAnswer = await response.text();
    return new NextResponse(sdpAnswer, {
      headers: {
        "Content-Type": "application/sdp",
      },
    });
  } catch (error) {
    console.error("Error exchanging SDP:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to exchange SDP" },
      { status: 500 }
    );
  }
}
