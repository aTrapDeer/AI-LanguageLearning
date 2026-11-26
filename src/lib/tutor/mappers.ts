import type { ChatMessageRecord, ChatSession } from "@/lib/db/chat";
import { readTutorPayload, type TutorReply } from "./schema";
import { getTutorScenario, isTutorScenarioId } from "./scenarios";
import type { TutorMessageDto, TutorSessionDto, TutorSessionMetadata } from "./types";

/** Server-side: database rows → API DTOs. */

export function toTutorSessionDto(session: ChatSession<Partial<TutorSessionMetadata>>): TutorSessionDto {
  const scenarioId = isTutorScenarioId(session.metadata?.scenarioId) ? session.metadata.scenarioId : "free";
  return {
    id: session.id,
    scenarioId,
    unitId: typeof session.metadata?.unitId === "string" ? session.metadata.unitId : null,
    title: session.title ?? getTutorScenario(scenarioId).title,
    createdAt: session.createdAt,
  };
}

export function toTutorMessageDto(message: ChatMessageRecord<unknown>): TutorMessageDto | null {
  if (message.role === "system") {
    return null;
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    payload: message.role === "assistant" ? readTutorPayload(message.payload) : null,
    createdAt: message.createdAt,
  };
}

export function toTutorMessageDtos(messages: ChatMessageRecord<unknown>[]): TutorMessageDto[] {
  return messages.map(toTutorMessageDto).filter((message): message is TutorMessageDto => message !== null);
}

export function vocabularyWordsIn(messages: TutorMessageDto[]): string[] {
  return messages.flatMap((message) => (message.payload as TutorReply | null)?.vocabulary.map((item) => item.word) ?? []);
}
