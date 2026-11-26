import { requireUser } from "@/lib/api-auth";
import { saveProgress } from "@/lib/lesson/service";
import { readJson, respond, serverError } from "../../respond";

export const dynamic = "force-dynamic";

/** PATCH /api/lessons/attempts/:id { progress } — saves resume state as the learner advances. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await readJson(req);
    return respond(await saveProgress({ userId: auth.userId, attemptId: id, progress: body?.progress }));
  } catch (error) {
    return serverError("[LESSON_SAVE]", error);
  }
}
