import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = await req.json()
    const { language } = body

    if (!language) {
      return new NextResponse("Language is required", { status: 400 })
    }

    // Check if user already has this language
    const existingUser = await db.user.findUnique({
      where: { id: session.user.id }
    })

    if (existingUser?.learningLanguages?.includes(language)) {
      return NextResponse.json({ message: "Language already added" }, { status: 200 })
    }

    // Add language to user's learning languages
    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        learningLanguages: existingUser?.learningLanguages ? 
          [...existingUser.learningLanguages, language] : 
          [language]
      }
    })

    // Create initial progress record
    await db.progress.create({
      data: {
        userId: session.user.id,
        language,
        level: 1,
        xp: 0
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("[LANGUAGES_POST]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 