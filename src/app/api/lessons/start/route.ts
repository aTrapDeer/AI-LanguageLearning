import { jsonError, requireUser } from "@/lib/api-auth";
import { isSupportedLanguageCode } from "@/lib/language-config";
import { startLesson } from "@/lib/lesson/service";
import { readJson, respond, serverError } from "../respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/lessons/start { language, unitId? }
 * Resumes the learner's unfinished attempt for the unit, or starts one on a pooled, generated or
 * starter lesson. `unitId` defaults to the next unit of the learner's level.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await readJson(req);
    const language = body?.language;
    const unitId = body?.unitId;
    if (!isSupportedLanguageCode(language)) {
      return jsonError(400, "A supported language is required", { code: "invalid_request" });
    }
    if (unitId !== undefined && unitId !== null && typeof unitId !== "string") {
      return jsonError(400, "Invalid unit", { code: "invalid_request" });
    }

    return respond(await startLesson({ userId: auth.userId, language, unitId }));
  } catch (error) {
    return serverError("[LESSON_START]", error);
  }
}
