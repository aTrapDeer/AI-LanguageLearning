import { NextResponse } from "next/server";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import { createChatSession } from "@/lib/database";
import { formatLevelLabel } from "@/lib/levels";
import { resolveLocalDate } from "@/lib/local-date";
import { isOpenAIConfigured } from "@/lib/openai";
import { buildVoiceTutorRealtimeSession, exchangeRealtimeSdp, RealtimeExchangeError } from "@/lib/openai-realtime";
import { loadLearnerTutorContext, resolveUnit } from "@/lib/tutor/context";
import { parseLanguage, tutorUnavailableResponse } from "@/lib/tutor/route-helpers";
import type { VoiceSessionMetadata } from "@/lib/tutor/store";
import { buildVoiceTranscriptionPrompt, buildVoiceTutorInstructions, isVoiceMode } from "@/lib/tutor/voice-prompt";

const MAX_SDP_BYTES = 64 * 1024;

/** Whether voice is available, plus the learner's level and unit for the pre-call screen. */
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const language = parseLanguage(new URL(request.url).searchParams.get("language"));
    if (!language) {
      return jsonError(400, "Unsupported language");
    }

    const context = await loadLearnerTutorContext(auth.userId, language.code);
    const unit = context.currentUnit;
    return NextResponse.json({
      available: isOpenAIConfigured(),
      language: language.code,
      levelLabel: formatLevelLabel(context.level),
      currentUnit: unit ? { id: unit.id, title: unit.title, emoji: unit.emoji, goal: unit.goal } : null,
    });
  } catch (error) {
    console.error("[VOICE_SESSION_GET]", error);
    return jsonError(500, "Couldn't load voice practice.");
  }
}

/**
 * WebRTC SDP exchange for a tutor voice call. The tutor's instructions are built here from the
 * learner's profile; the session is recorded (mode "voice") so its duration is measured server-side.
 * Returns the SDP answer, with the session id in the `X-Voice-Session-Id` header.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const language = parseLanguage(searchParams.get("language"));
    if (!language) {
      return jsonError(400, "Unsupported language");
    }

    const modeParam = searchParams.get("mode");
    const mode = isVoiceMode(modeParam) ? modeParam : "native";

    const sdpOffer = await request.text();
    if (!sdpOffer.trim()) {
      return jsonError(400, "SDP offer is required");
    }
    if (sdpOffer.length > MAX_SDP_BYTES) {
      return jsonError(413, "SDP offer is too large");
    }

    if (!isOpenAIConfigured()) {
      return tutorUnavailableResponse();
    }

    const limited = await enforceAiQuota(auth.userId, "realtime");
    if (limited) return limited;

    const context = await loadLearnerTutorContext(auth.userId, language.code);
    const unit = resolveUnit(searchParams.get("unit"), context);
    const session = buildVoiceTutorRealtimeSession({
      languageCode: language.code,
      instructions: buildVoiceTutorInstructions({
        language,
        level: context.level,
        mode,
        unit,
        weakWords: context.weakWords,
        recentMistakes: context.recentMistakes,
      }),
      transcriptionPrompt: buildVoiceTranscriptionPrompt(language.name, mode),
    });

    const answer = await exchangeRealtimeSdp(sdpOffer, session);

    const startedAt = new Date();
    const metadata: VoiceSessionMetadata = {
      voiceMode: mode,
      unitId: unit?.id ?? null,
      localDate: resolveLocalDate(searchParams.get("localDate"), startedAt),
      startedAt: startedAt.toISOString(),
      endedAt: null,
    };
    const record = await createChatSession<VoiceSessionMetadata>({
      userId: auth.userId,
      language: language.code,
      mode: "voice",
      title: mode === "assisted" ? "Assisted voice practice" : "Native voice practice",
      metadata,
    });

    return new NextResponse(answer, {
      headers: { "Content-Type": "application/sdp", "X-Voice-Session-Id": record.id },
    });
  } catch (error) {
    if (error instanceof RealtimeExchangeError) {
      console.error("[VOICE_SESSION_POST] realtime", error.status, error.message);
      if (error.status === 503) {
        return tutorUnavailableResponse();
      }
      return jsonError(502, "Couldn't connect to your voice tutor. Please try again in a moment.", { code: "realtime_failed" });
    }

    console.error("[VOICE_SESSION_POST]", error);
    return jsonError(500, "Couldn't start the voice session.");
  }
}
