import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { getUserById, setActiveLanguage } from "@/lib/database";
import { isSupportedLanguageCode } from "@/lib/language-config";

export async function PUT(req: Request) {
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

    if (!existingUser.learningLanguages.includes(language)) {
      return jsonError(400, "Language has not been added to this account");
    }

    const user = await setActiveLanguage(auth.userId, language);
    if (!user) {
      return jsonError(404, "User not found");
    }

    return NextResponse.json({ id: user.id, activeLanguage: user.activeLanguage });
  } catch (error) {
    console.error("[ACTIVE_LANGUAGE_PUT]", error);
    return jsonError(500, "Internal Server Error");
  }
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const user = await getUserById(auth.userId);
    if (!user) {
      return jsonError(404, "User not found");
    }

    return NextResponse.json({ activeLanguage: user.activeLanguage });
  } catch (error) {
    console.error("[ACTIVE_LANGUAGE_GET]", error);
    return jsonError(500, "Internal Server Error");
  }
}
