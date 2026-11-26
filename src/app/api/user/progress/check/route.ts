import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { getProgress } from "@/lib/database";

export async function GET(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const language = new URL(req.url).searchParams.get("language");
    if (!language) {
      return jsonError(400, "Language parameter is required");
    }

    const progress = await getProgress(auth.userId, language);
    if (!progress) {
      return NextResponse.json({ exists: false, message: "No progress found for this language" }, { status: 404 });
    }

    return NextResponse.json({
      exists: true,
      progress: { id: progress.id, level: progress.level, xp: progress.xp },
    });
  } catch (error) {
    console.error("[PROGRESS_CHECK]", error);
    return jsonError(500, "Internal Error");
  }
}
