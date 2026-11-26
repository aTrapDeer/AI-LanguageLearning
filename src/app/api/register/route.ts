import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, ensureProgress, getUserByEmail, toPublicUser } from "@/lib/database";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/language-config";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  nativeLanguage: z.string().max(40).optional().default("en"),
  learningLanguages: z.array(z.enum(SUPPORTED_LANGUAGE_CODES)).optional().default([]),
});

// Public by design: this is how accounts are created.
export async function POST(req: Request) {
  try {
    const result = registerSchema.safeParse(await req.json().catch(() => null));
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { name, email, password, nativeLanguage, learningLanguages } = result.data;

    if (await getUserByEmail(email)) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    const newUser = await createUser({
      name,
      email,
      password: await hash(password, 12),
      nativeLanguage,
      learningLanguages,
      activeLanguage: learningLanguages[0] ?? "en",
      // Onboarding (language + level choice) always happens in /account-setup.
      accountSetup: false,
    });

    await Promise.all(learningLanguages.map((language) => ensureProgress(newUser.id, language, 1)));

    const user = toPublicUser(newUser);
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        nativeLanguage: user.nativeLanguage,
        learningLanguages: user.learningLanguages,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Error creating user" }, { status: 500 });
  }
}
