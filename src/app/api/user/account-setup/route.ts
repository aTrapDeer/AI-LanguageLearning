import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { completeAccountSetup } from "@/lib/database";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/language-config";

const AccountSetupSchema = z.object({
  userId: z.string().optional(),
  learningLanguages: z.array(z.enum(SUPPORTED_LANGUAGE_CODES)).min(1, "Please select at least one language"),
  activeLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
  proficiencyLevels: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await req.json();
    const validationResult = AccountSetupSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const userId = validationResult.data.userId || session.user.id;
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { learningLanguages, activeLanguage, proficiencyLevels = {} } = validationResult.data;

    if (activeLanguage && !learningLanguages.includes(activeLanguage)) {
      return NextResponse.json(
        { error: "Active language must be one of the selected learning languages" },
        { status: 400 }
      );
    }

    const user = await completeAccountSetup(userId, {
      learningLanguages,
      activeLanguage,
      proficiencyLevels,
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
