import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getProgress } from "@/lib/database";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const language = searchParams.get("language");

    if (!language) {
      return new NextResponse("Language parameter is required", { status: 400 });
    }

    const progress = await getProgress(session.user.id, language);
    if (!progress) {
      return NextResponse.json(
        { exists: false, message: "No progress found for this language" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exists: true,
      progress: {
        id: progress.id,
        level: progress.level,
        xp: progress.xp,
      },
    });
  } catch (error) {
    console.error("[PROGRESS_CHECK]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 