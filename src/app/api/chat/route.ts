import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import { appendChatMessage, getChatSession, listChatMessages, recordActivity, recordMistakes } from "@/lib/database";
import { getLanguageConfig } from "@/lib/language-config";
import { resolveLocalDate } from "@/lib/local-date";
import { isOpenAIConfigured } from "@/lib/openai";
import { loadLearnerTutorContext, resolveUnit } from "@/lib/tutor/context";
import { generateTutorReply } from "@/lib/tutor/generate";
import { toTutorMessageDto } from "@/lib/tutor/mappers";
import { HISTORY_MESSAGE_LIMIT, MAX_LEARNER_MESSAGE_LENGTH, type HistoryEntry } from "@/lib/tutor/prompt";
import { tutorErrorResponse, tutorUnavailableResponse } from "@/lib/tutor/route-helpers";
import { getTutorScenario } from "@/lib/tutor/scenarios";
import { countChatTurnsToday } from "@/lib/tutor/store";
import type { TutorActivityDto, TutorSessionMetadata, TutorTurnResponse } from "@/lib/tutor/types";
import { chatTurnXp, isMeaningfulTurn } from "@/lib/tutor/xp";

const TurnSchema = z.object({
  sessionId: z.string().min(1).max(64),
  message: z.string(),
  localDate: z.string().nullish(),
});

/** One learner turn: the reply sees recent history and the learner's profile; XP is awarded here. */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = TurnSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, "Invalid request");
    }

    const message = parsed.data.message.trim();
    if (!message) {
      return jsonError(400, "Message is empty");
    }
    if (message.length > MAX_LEARNER_MESSAGE_LENGTH) {
      return jsonError(413, `Messages can be up to ${MAX_LEARNER_MESSAGE_LENGTH} characters.`);
    }

    const session = await getChatSession<Partial<TutorSessionMetadata>>(auth.userId, parsed.data.sessionId);
    const language = session ? getLanguageConfig(session.language) : null;
    if (!session || session.mode !== "tutor" || !language) {
      return jsonError(404, "Conversation not found");
    }

    if (!isOpenAIConfigured()) {
      return tutorUnavailableResponse();
    }

    const limited = await enforceAiQuota(auth.userId, "text");
    if (limited) return limited;

    const [previous, context] = await Promise.all([
      listChatMessages({ userId: auth.userId, sessionId: session.id, limit: HISTORY_MESSAGE_LIMIT - 1 }),
      loadLearnerTutorContext(auth.userId, language.code),
    ]);

    const history: HistoryEntry[] = [
      ...previous
        .filter((entry) => entry.role !== "system")
        .map((entry) => ({ role: entry.role as HistoryEntry["role"], content: entry.content })),
      { role: "user", content: message },
    ];

    const scenario = getTutorScenario(session.metadata?.scenarioId);
    const unit = resolveUnit(session.metadata?.unitId, context);
    const reply = await generateTutorReply({ context: { ...context, language, scenario, unit }, history });

    // Persist only after a successful reply, so a failed turn can simply be retried.
    const userRecord = await appendChatMessage({ userId: auth.userId, sessionId: session.id, role: "user", content: message });
    const assistantRecord = await appendChatMessage({
      userId: auth.userId,
      sessionId: session.id,
      role: "assistant",
      content: reply.reply,
      payload: reply,
    });
    const userMessage = userRecord ? toTutorMessageDto(userRecord) : null;
    const assistantMessage = assistantRecord ? toTutorMessageDto(assistantRecord) : null;
    if (!userMessage || !assistantMessage) {
      return jsonError(404, "Conversation not found");
    }

    if (reply.corrections.length > 0) {
      await recordMistakes({
        userId: auth.userId,
        language: language.code,
        source: "chat",
        mistakes: reply.corrections.map((correction) => ({
          kind: correction.kind,
          incorrect: correction.original,
          correction: correction.corrected,
          explanation: correction.explanation,
          context: message,
        })),
      }).catch((error) => console.error("[CHAT_TURN] recordMistakes", error));
    }

    const previousLearnerMessage = [...previous].reverse().find((entry) => entry.role === "user")?.content ?? null;
    const meaningful = isMeaningfulTurn(message, previousLearnerMessage);
    let activity: TutorActivityDto | null = null;

    if (meaningful) {
      try {
        const localDate = resolveLocalDate(parsed.data.localDate);
        const turnsBefore = await countChatTurnsToday(auth.userId, language.code, localDate);
        const earned = chatTurnXp(turnsBefore, true);
        const result = await recordActivity({
          userId: auth.userId,
          language: language.code,
          kind: "chat",
          xp: earned.xp,
          localDate,
          count: 1,
        });
        activity = {
          xpGained: result.xpGained,
          dailyXp: result.dailyXp,
          dailyGoal: result.dailyGoal,
          goalJustReached: result.goalJustReached,
          streak: result.streak.current,
          capReached: earned.capReached,
        };
      } catch (error) {
        // The reply is already saved; losing a turn's XP is better than failing the turn.
        console.error("[CHAT_TURN] recordActivity", error);
      }
    }

    const body: TutorTurnResponse = { userMessage, assistantMessage, activity };
    return NextResponse.json(body);
  } catch (error) {
    return tutorErrorResponse("CHAT_TURN", error);
  }
}
