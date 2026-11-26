import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { isSupportedLanguageCode } from "@/lib/language-config";
import { getPath } from "@/lib/lesson/service";
import { serverError } from "../respond";

export const dynamic = "force-dynamic";

/** GET /api/lessons/path?language=de&level=2 — units of a level with stars, locks and unfinished attempts. */
export async function GET(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const language = searchParams.get("language");
    if (!isSupportedLanguageCode(language)) {
      return jsonError(400, "A supported language is required", { code: "invalid_request" });
    }
    const levelParam = searchParams.get("level");
    const level = levelParam ? Number.parseInt(levelParam, 10) : null;

    const path = await getPath({ userId: auth.userId, language, level: Number.isFinite(level) ? level : null });
    return NextResponse.json(path, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError("[LESSON_PATH]", error);
  }
}
