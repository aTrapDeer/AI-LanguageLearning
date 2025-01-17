import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Fetch user's progress for all languages
    const progress = await db.progress.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        language: true,
        level: true,
        xp: true
      }
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error("[PROGRESS_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
} 