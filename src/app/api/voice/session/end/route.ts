import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { appendChatMessage, getChatSession, recordActivity } from "@/lib/database";
import { claimVoiceSessionEnd, sumVoiceXpToday, type VoiceSessionMetadata } from "@/lib/tutor/store";
import { voiceSessionXp } from "@/lib/tutor/xp";

const MAX_TRANSCRIPT_ENTRIES = 80;

const EndSchema = z.object({
  sessionId: z.string().min(1).max(64),
  /** Client-side connected time; it can only lower the server-measured duration. */
  activeSeconds: z.number().nonnegative().max(24 * 60 * 60).nullish(),
  transcript: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(500)
    .nullish(),
});

/** Ends a voice session once: credits XP from the server-measured duration and stores the transcript. */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = EndSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, "Invalid request");
    }

    const session = await getChatSession<VoiceSessionMetadata>(auth.userId, parsed.data.sessionId);
    const startedAt = session?.metadata?.startedAt ? new Date(session.metadata.startedAt) : null;
    if (!session || session.mode !== "voice" || !startedAt || Number.isNaN(startedAt.getTime())) {
      return jsonError(404, "Voice session not found");
    }

    const metadata = session.metadata!;
    if (metadata.endedAt) {
      return NextResponse.json({
        alreadyEnded: true,
        seconds: metadata.creditedSeconds ?? 0,
        xpGained: 0,
        activity: null,
      });
    }

    const transcript = (parsed.data.transcript ?? [])
      .map((entry) => ({ role: entry.role, text: entry.text.trim() }))
      .filter((entry) => entry.text)
      .slice(-MAX_TRANSCRIPT_ENTRIES);

    const endedAt = new Date();
    const xpAwardedToday = await sumVoiceXpToday(auth.userId, session.language, metadata.localDate);
    const earned = voiceSessionXp({
      startedAt,
      endedAt,
      clientActiveSeconds: parsed.data.activeSeconds ?? null,
      xpAwardedToday,
    });

    // A call that connected but where the learner never spoke (and that was very short) earns nothing.
    const spokeAtAll = transcript.some((entry) => entry.role === "user") || earned.seconds >= 30;
    const xp = spokeAtAll ? earned.xp : 0;

    const claimed = await claimVoiceSessionEnd({
      userId: auth.userId,
      sessionId: session.id,
      endedAt,
      xpAwarded: xp,
      creditedSeconds: earned.seconds,
    });
    if (!claimed) {
      return NextResponse.json({ alreadyEnded: true, seconds: 0, xpGained: 0, activity: null });
    }

    for (const entry of transcript) {
      await appendChatMessage({
        userId: auth.userId,
        sessionId: session.id,
        role: entry.role,
        content: entry.text.slice(0, 2000),
        payload: { source: "voice" },
      });
    }

    const result = spokeAtAll
      ? await recordActivity({
          userId: auth.userId,
          language: session.language,
          kind: "voice",
          xp,
          localDate: metadata.localDate,
          count: 1,
        })
      : null;

    return NextResponse.json({
      alreadyEnded: false,
      seconds: earned.seconds,
      xpGained: result?.xpGained ?? 0,
      capReached: earned.capReached,
      activity: result
        ? {
            streak: result.streak.current,
            dailyXp: result.dailyXp,
            dailyGoal: result.dailyGoal,
            goalJustReached: result.goalJustReached,
            leveledUp: result.leveledUp,
            level: result.level,
          }
        : null,
    });
  } catch (error) {
    console.error("[VOICE_SESSION_END]", error);
    return jsonError(500, "Couldn't save the voice session.");
  }
}
