import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getLanguageConfig, resolveLanguageCode, type LanguageConfig } from "@/lib/language-config";
import { OpenAIConfigError, StructuredOutputError } from "@/lib/openai";

/** Server-only helpers shared by the tutor, speech and voice routes. */

export const TUTOR_UNAVAILABLE_CODE = "tutor_unavailable";

export function parseLanguage(value: unknown): LanguageConfig | null {
  const code = resolveLanguageCode(value);
  return code ? getLanguageConfig(code) : null;
}

export function tutorUnavailableResponse(): NextResponse {
  return jsonError(503, "The tutor isn't available right now. Lessons and reviews still work.", {
    code: TUTOR_UNAVAILABLE_CODE,
  });
}

/** Maps generation failures to a friendly response and logs the details server-side. */
export function tutorErrorResponse(scope: string, error: unknown): NextResponse {
  if (error instanceof OpenAIConfigError || (error instanceof StructuredOutputError && error.kind === "config")) {
    if (error instanceof StructuredOutputError && error.attempts === 0 && error.message.includes("strict-compatible")) {
      console.error(`[${scope}]`, error);
      return jsonError(500, "The tutor is misconfigured.");
    }
    return tutorUnavailableResponse();
  }

  if (error instanceof StructuredOutputError) {
    console.error(`[${scope}] ${error.kind} after ${error.attempts} attempt(s)`, error.issues, error.cause ?? "");
    return jsonError(502, "Your tutor lost their train of thought. Please try again.", { code: "tutor_failed" });
  }

  console.error(`[${scope}]`, error);
  return jsonError(500, "Something went wrong. Please try again.");
}
