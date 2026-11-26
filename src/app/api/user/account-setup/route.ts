import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-auth";
import { completeAccountSetup, toPublicUser } from "@/lib/database";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/language-config";
import { ONBOARDING_PROFICIENCY_OPTIONS } from "@/lib/levels";

const ONBOARDING_CHOICES = ONBOARDING_PROFICIENCY_OPTIONS.map((option) => option.choice) as [string, ...string[]];

// Unknown keys (e.g. a legacy `userId`) are stripped: the account is always the session's.
const AccountSetupSchema = z.object({
  learningLanguages: z.array(z.enum(SUPPORTED_LANGUAGE_CODES)).min(1, "Please select at least one language"),
  activeLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
  /** Onboarding self-assessment per language ("1".."5"); stored as levels 1/3/5/7/9. */
  proficiencyLevels: z.record(z.enum(SUPPORTED_LANGUAGE_CODES), z.enum(ONBOARDING_CHOICES)).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const validationResult = AccountSetupSchema.safeParse(await req.json().catch(() => null));
    if (!validationResult.success) {
      return jsonError(400, validationResult.error.issues[0]?.message ?? "Invalid request");
    }

    const { learningLanguages, activeLanguage, proficiencyLevels = {} } = validationResult.data;

    if (activeLanguage && !learningLanguages.includes(activeLanguage)) {
      return jsonError(400, "Active language must be one of the selected learning languages");
    }

    const user = await completeAccountSetup(auth.userId, {
      learningLanguages,
      activeLanguage,
      proficiencyLevels,
    });

    if (!user) {
      return jsonError(404, "User not found");
    }

    return NextResponse.json({ success: true, user: toPublicUser(user) });
  } catch (error) {
    console.error("[ACCOUNT_SETUP]", error);
    return jsonError(500, "Failed to complete account setup");
  }
}
