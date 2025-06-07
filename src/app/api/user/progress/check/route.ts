import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getProgress } from "@/lib/supabase-db"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const language = searchParams.get('language')
    
    if (!language) {
      return new NextResponse("Language parameter is required", { status: 400 })
    }

    // Check if user has progress for this language
    try {
      const progress = await getProgress(session.user.id, language)
      
      if (progress) {
        // Progress exists
        return NextResponse.json({ 
          exists: true, 
          progress: {
            level: progress.level,
            xp: progress.xp
          }
        })
      } else {
        // No progress found
        return NextResponse.json(
          { exists: false, message: "No progress found for this language" }, 
          { status: 404 }
        )
      }
    } catch (error) {
      console.error("Error checking progress:", error)
      // Return 404 for any database errors (including 406 from Supabase)
      return NextResponse.json(
        { exists: false, message: "No progress found for this language" }, 
        { status: 404 }
      )
    }

  } catch (error) {
    console.error("[PROGRESS_CHECK]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
} 