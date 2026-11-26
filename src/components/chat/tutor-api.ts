"use client";

import { getLocalDateString } from "@/lib/local-date";
import type { TutorScenarioId } from "@/lib/tutor/scenarios";
import type { ApiErrorBody, TutorStartResponse, TutorStateResponse, TutorTurnResponse } from "@/lib/tutor/types";

export class TutorApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null) {
    super(message);
    this.name = "TutorApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new TutorApiError(0, "You seem to be offline. Check your connection and try again.", "network");
  }

  const body = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!response.ok || !body) {
    throw new TutorApiError(response.status, body?.error ?? "Something went wrong. Please try again.", body?.code ?? null);
  }
  return body;
}

const json = (payload: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

export function fetchTutorState(language: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ language, localDate: getLocalDateString() });
  return request<TutorStateResponse>(`/api/chat/session?${params.toString()}`, { signal });
}

export function startTutorSession(language: string, scenarioId: TutorScenarioId, unitId: string | null) {
  return request<TutorStartResponse>("/api/chat/session", json({ language, scenarioId, unitId }));
}

export function sendTutorMessage(sessionId: string, message: string) {
  return request<TutorTurnResponse>("/api/chat", json({ sessionId, message, localDate: getLocalDateString() }));
}

export function saveTutorWord(input: {
  language: string;
  word: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  unitId: string | null;
}) {
  return request<{ saved: boolean; alreadySaved: boolean; normalizedWord: string | null }>("/api/chat/vocabulary", json(input));
}
