import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { deleteVocabularyItem } from "@/lib/review/store";

export const dynamic = "force-dynamic";

/** DELETE /api/vocabulary/:id — removes one of the learner's own words. */
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    if (!id || id.length > 64) {
      return jsonError(400, "Invalid word id");
    }

    const deleted = await deleteVocabularyItem(auth.userId, id);
    if (!deleted) {
      return jsonError(404, "Word not found");
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[VOCABULARY_DELETE]", error);
    return jsonError(500, "Failed to remove this word");
  }
}
