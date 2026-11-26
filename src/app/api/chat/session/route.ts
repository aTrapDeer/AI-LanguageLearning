import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceAiQuota, jsonError, requireUser } from "@/lib/api-auth";
import { appendChatMessage, createChatSession, getLatestChatSession, listChatMessages } from "@/lib/database";
import { formatLevelLabel } from "@/lib/levels";
import { resolveLocalDate } from "@/lib/local-date";
import { isOpenAIConfigured } from "@/lib/openai";
import { loadLearnerTutorContext, resolveUnit } from "@/lib/tutor/context";
import { generateTutorReply } from "@/lib/tutor/generate";
import { toTutorMessageDto, toTutorMessageDtos, toTutorSessionDto, vocabularyWordsIn } from "@/lib/tutor/mappers";
import { parseLanguage, tutorErrorResponse, tutorUnavailableResponse } from "@/lib/tutor/route-helpers";
import { getTutorScenario, TUTOR_SCENARIO_IDS } from "@/lib/tutor/scenarios";
import { countChatTurnsToday, findSavedWords } from "@/lib/tutor/store";
import type { TutorSessionMetadata, TutorStartResponse, TutorStateResponse } from "@/lib/tutor/types";
import { CHAT_XP_DAILY_TURN_CAP } from "@/lib/tutor/xp";

const RESUME_MESSAGE_LIMIT = 60;

/** The learner's latest tutor conversation (to resume) plus what the scenario picker needs. */
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const language = parseLanguage(searchParams.get("language"));
    if (!language) {
      return jsonError(400, "Unsupported language");
    }

    const localDate = resolveLocalDate(searchParams.get("localDate"));
    const [context, latest, turnsToday] = await Promise.all([
      loadLearnerTutorContext(auth.userId, language.code),
      getLatestChatSession<Partial<TutorSessionMetadata>>({ userId: auth.userId, language: language.code, mode: "tutor" }),
      countChatTurnsToday(auth.userId, language.code, localDate),
    ]);

    const messages = latest
      ? toTutorMessageDtos(await listChatMessages({ userId: auth.userId, sessionId: latest.id, limit: RESUME_MESSAGE_LIMIT }))
      : [];
    const savedWords = await findSavedWords(auth.userId, language.code, vocabularyWordsIn(messages));

    const unit = context.currentUnit;
    const body: TutorStateResponse = {
      available: isOpenAIConfigured(),
      language: language.code,
      levelLabel: formatLevelLabel(context.level),
      currentUnit: unit ? { id: unit.id, title: unit.title, emoji: unit.emoji, goal: unit.goal } : null,
      session: latest ? toTutorSessionDto(latest) : null,
      messages,
      savedWords,
      xp: { rewardedTurnsToday: Math.min(turnsToday, CHAT_XP_DAILY_TURN_CAP), dailyTurnCap: CHAT_XP_DAILY_TURN_CAP },
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[CHAT_SESSION_GET]", error);
    return jsonError(500, "Couldn't load your conversation.");
  }
}

const StartSchema = z.object({
  language: z.string(),
  scenarioId: z.enum(TUTOR_SCENARIO_IDS),
  unitId: z.string().max(64).nullish(),
});

/** Starts a new conversation; the tutor writes the opening message in role. */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = StartSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, "Invalid request");
    }

    const language = parseLanguage(parsed.data.language);
    if (!language) {
      return jsonError(400, "Unsupported language");
    }

    if (!isOpenAIConfigured()) {
      return tutorUnavailableResponse();
    }

    const limited = await enforceAiQuota(auth.userId, "text");
    if (limited) return limited;

    const context = await loadLearnerTutorContext(auth.userId, language.code);
    const scenario = getTutorScenario(parsed.data.scenarioId);
    const unit = resolveUnit(parsed.data.unitId, context);
    if (scenario.id === "unit" && !unit) {
      return jsonError(400, "There is no unit to practise yet.");
    }

    // Generate first so a failed opening leaves no empty conversation behind.
    const opening = await generateTutorReply({
      context: { ...context, language, scenario, unit },
      history: [],
    });

    const metadata: TutorSessionMetadata = { scenarioId: scenario.id, unitId: unit?.id ?? null };
    const session = await createChatSession<TutorSessionMetadata>({
      userId: auth.userId,
      language: language.code,
      mode: "tutor",
      title: scenario.id === "unit" && unit ? `${unit.emoji} ${unit.title}` : `${scenario.emoji} ${scenario.title}`,
      metadata,
    });

    const message = await appendChatMessage({
      userId: auth.userId,
      sessionId: session.id,
      role: "assistant",
      content: opening.reply,
      payload: opening,
    });

    const dto = message ? toTutorMessageDto(message) : null;
    const body: TutorStartResponse = { session: toTutorSessionDto(session), messages: dto ? [dto] : [] };
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    return tutorErrorResponse("CHAT_SESSION_POST", error);
  }
}
