import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import { PrismaClient } from "@prisma/client"

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

    const { name, email, password, nativeLanguage, learningLanguages } = body

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

    // Create user with transaction to ensure all related records are created
    const user = await db.$transaction(async (prisma: PrismaClient) => {
      // Create the user
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          nativeLanguage,
          learningLanguages,
        },
      })

      // Create initial progress records for each learning language
      if (learningLanguages && learningLanguages.length > 0) {
        await Promise.all(
          learningLanguages.map((language: string) =>
            prisma.progress.create({
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

      return newUser
    })

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        nativeLanguage: user.nativeLanguage,
        learningLanguages: user.learningLanguages,
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