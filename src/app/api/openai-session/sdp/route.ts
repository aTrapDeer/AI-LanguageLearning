import { NextResponse } from "next/server";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import { isSupportedLanguageCode } from "@/lib/language-config";
import { isOpenAIConfigured } from "@/lib/openai";
import { buildTravelRealtimeSession, exchangeRealtimeSdp, RealtimeExchangeError } from "@/lib/openai-realtime";

/** Travel interpreter SDP exchange. (The voice tutor uses /api/voice/session.) */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const requestedLanguage = new URL(request.url).searchParams.get("language");
    if (!requestedLanguage || !isSupportedLanguageCode(requestedLanguage)) {
      return jsonError(400, "Unsupported language");
    }

    const sdpOffer = await request.text();
    if (!sdpOffer) {
      return jsonError(400, "SDP offer is required");
    }

    if (!isOpenAIConfigured()) {
      return jsonError(503, "Travel mode isn't available right now.", { code: "tutor_unavailable" });
    }

    const limited = await enforceAiQuota(auth.userId, "realtime");
    if (limited) return limited;

    const sdpAnswer = await exchangeRealtimeSdp(sdpOffer, buildTravelRealtimeSession(requestedLanguage));
    return new NextResponse(sdpAnswer, { headers: { "Content-Type": "application/sdp" } });
  } catch (error) {
    console.error("[TRAVEL_SDP]", error);
    if (error instanceof RealtimeExchangeError) {
      return jsonError(502, "Couldn't connect to the live interpreter. Please try again.");
    }
    return jsonError(500, "Couldn't start Travel mode.");
  }
}
