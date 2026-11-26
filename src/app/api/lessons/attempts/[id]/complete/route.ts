import { requireUser } from "@/lib/api-auth";
import type { CompleteLessonRequest } from "@/lib/lesson/api-types";
import { completeLesson } from "@/lib/lesson/service";
import { readJson, respond, serverError } from "../../../respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/lessons/attempts/:id/complete { results: [{ stepId, answer }], localDate }
 * Re-grades the first-try answers against the stored plan, awards XP once, adds the new words to the
 * review deck, grades the review words that were included and records mistakes.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await readJson(req);
    const request: CompleteLessonRequest = {
      results: Array.isArray(body?.results) ? (body.results as CompleteLessonRequest["results"]) : [],
      localDate: typeof body?.localDate === "string" ? body.localDate : null,
    };
    return respond(await completeLesson({ userId: auth.userId, attemptId: id, body: request }));
  } catch (error) {
    return serverError("[LESSON_COMPLETE]", error);
  }
}
