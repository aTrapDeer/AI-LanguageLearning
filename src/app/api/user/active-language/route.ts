import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { supabase, supabaseAdmin } from "@/lib/supabase"

// Use either admin client or fallback to regular client
const dbClient = supabaseAdmin || supabase;

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

    // Update user's active language using Supabase
    // Note: In Supabase, the column is active_language (snake_case) not activeLanguage (camelCase)
    const { data, error } = await dbClient
      .from('users')
      .update({ active_language: language })
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: "Failed to update language" }, { status: 500 })
    }

    // Return the updated user with activeLanguage in camelCase for client use
    return NextResponse.json({
      id: data.id,
      activeLanguage: data.active_language
    })
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

    // Get user's active language using Supabase
    const { data, error } = await dbClient
      .from('users')
      .select('active_language')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: "Failed to fetch language" }, { status: 500 })
    }

    // Return with activeLanguage in camelCase for client use
    return NextResponse.json({
      activeLanguage: data.active_language
    })
  } catch (error) {
    console.error("[ACTIVE_LANGUAGE_GET]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 