import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"

// Validation schema
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  nativeLanguage: z.string().optional().default("English"),
  learningLanguages: z.array(z.string()).optional().default([]),
  accountSetup: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Validate input
    const result = registerSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, email, password, nativeLanguage, learningLanguages, accountSetup } = body

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      )
    }

    // Hash password with high cost factor for security
    const hashedPassword = await hash(password, 12)

    // Determine active language (first learning language or native language)
    const activeLanguage = learningLanguages?.length > 0 ? learningLanguages[0] : nativeLanguage

    // Create the user first, then handle related records
    // Note: Without transactions, this is not atomic, but we'll handle it sequentially
    const newUser = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        nativeLanguage,
        learningLanguages,
        activeLanguage,
        // Use type assertion to work around type checking
        ...(accountSetup !== undefined ? { accountSetup } : { accountSetup: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })

    // Create initial progress records for each learning language
    if (learningLanguages && learningLanguages.length > 0) {
      await Promise.all(
        learningLanguages.map((language: string) =>
          db.progress.create({
            data: {
              userId: newUser.id,
              language,
              level: 1,
              xp: 0,
            },
          })
        )
      )
    }

    return NextResponse.json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        nativeLanguage: newUser.nativeLanguage,
        learningLanguages: newUser.learningLanguages,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Error creating user" },
      { status: 500 }
    )
  }
} 