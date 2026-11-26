"use client";

import { getLocalDateString } from "@/lib/local-date";
import type {
  CompleteResponse,
  GradeResponse,
  ReviewStatusResponse,
  StartSessionResponse,
  VocabularyListItem,
  VocabularyListResponse,
} from "@/lib/review/types";
import type { ReviewGrade } from "@/lib/srs";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    throw new ApiError(response.status, body?.error ?? `Request failed (${response.status})`, body?.code ?? null);
  }

  return (await response.json()) as T;
}

export function fetchReviewStatus(language: string, signal?: AbortSignal) {
  return request<ReviewStatusResponse>(`/api/review/status?language=${encodeURIComponent(language)}`, { signal });
}

export function startReviewSession(language: string, mode: "due" | "new" = "due") {
  return request<StartSessionResponse>("/api/review/session", {
    method: "POST",
    body: JSON.stringify({ language, mode }),
  });
}

export function postGrade(sessionId: string, itemId: string, grade: ReviewGrade) {
  return request<GradeResponse>("/api/review/grade", {
    method: "POST",
    body: JSON.stringify({ sessionId, itemId, grade }),
  });
}

export function completeReviewSession(sessionId: string) {
  return request<CompleteResponse>("/api/review/complete", {
    method: "POST",
    body: JSON.stringify({ sessionId, localDate: getLocalDateString() }),
  });
}

/** Fire-and-forget completion while the page is being closed, so earned XP isn't lost. */
export function beaconCompleteReviewSession(sessionId: string): void {
  const body = JSON.stringify({ sessionId, localDate: getLocalDateString() });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/api/review/complete", new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch("/api/review/complete", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
}

export function fetchVocabulary(params: { language: string; query?: string; offset?: number; signal?: AbortSignal }) {
  const search = new URLSearchParams({ language: params.language });
  if (params.query) search.set("q", params.query);
  if (params.offset) search.set("offset", String(params.offset));
  return request<VocabularyListResponse>(`/api/vocabulary?${search.toString()}`, { signal: params.signal });
}

export function addVocabularyWord(input: {
  language: string;
  word: string;
  translation: string;
  romanization?: string | null;
  exampleSentence?: string | null;
}) {
  return request<{ item: VocabularyListItem; created: boolean }>("/api/vocabulary", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteVocabularyWord(id: string) {
  return request<{ deleted: true }>(`/api/vocabulary/${encodeURIComponent(id)}`, { method: "DELETE" });
}
