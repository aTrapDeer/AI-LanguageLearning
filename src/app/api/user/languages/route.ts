import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { ensureProgress, getUserById, toPublicUser, updateUser } from "@/lib/database";
import { isSupportedLanguageCode } from "@/lib/language-config";

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => null)) as { language?: unknown } | null;
    const language = body?.language;

    if (!language) {
      return jsonError(400, "Language is required");
    }

    if (!isSupportedLanguageCode(language)) {
      return jsonError(400, "Unsupported language");
    }

    const existingUser = await getUserById(auth.userId);
    if (!existingUser) {
      return jsonError(404, "User not found");
    }

    if (existingUser.learningLanguages.includes(language)) {
      return NextResponse.json({ message: "Language already added" }, { status: 200 });
    }

    const user = await updateUser(auth.userId, {
      learningLanguages: [...existingUser.learningLanguages, language],
    });

    await ensureProgress(auth.userId, language, 1);

    return NextResponse.json(user ? toPublicUser(user) : null);
  } catch (error) {
    console.error("[LANGUAGES_POST]", error);
    return jsonError(500, "Internal Server Error");
  }
}
