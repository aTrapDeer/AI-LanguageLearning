import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PUT(req: Request) {
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

    // Update user's active language
    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        activeLanguage: language
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("[ACTIVE_LANGUAGE_PUT]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { activeLanguage: true }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("[ACTIVE_LANGUAGE_GET]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 