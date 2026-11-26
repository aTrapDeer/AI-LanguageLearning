import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { ensureProgress, getAllUserProgress, setLearnerLevel } from "@/lib/database";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/language-config";
import { clampLevel, MAX_LEVEL, MIN_LEVEL } from "@/lib/levels";

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    return NextResponse.json(await getAllUserProgress(auth.userId));
  } catch (error) {
    console.error("[PROGRESS_GET]", error);
    return jsonError(500, "Internal Error");
  }
}

const EnsureProgressSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGE_CODES),
  level: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL).optional(),
});

/**
 * Creates the progress row for a language if it is missing. Never changes an existing row, and never
 * accepts XP from the client (XP is only awarded server-side through recordActivity).
 */
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = EnsureProgressSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const progress = await ensureProgress(auth.userId, parsed.data.language, clampLevel(parsed.data.level ?? 1));
    return NextResponse.json(progress, { status: 201 });
  } catch (error) {
    console.error("[PROGRESS_POST]", error);
    return jsonError(500, "Internal Error");
  }
}

const SetLevelSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGE_CODES),
  level: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
});

/** Lets a learner move their own level for a language they already study. */
export async function PATCH(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const parsed = SetLevelSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const progress = await setLearnerLevel(auth.userId, parsed.data.language, parsed.data.level);
    if (!progress) {
      return jsonError(404, "This language has not been set up for your account");
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error("[PROGRESS_PATCH]", error);
    return jsonError(500, "Internal Error");
  }
}
