import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const progress = await db.progress.getAllForUser(session.user.id);

    return NextResponse.json(progress);
  } catch (error) {
    console.error("[PROGRESS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { language, level, xp } = body;

    if (!language) {
      return NextResponse.json({ error: "Language is required" }, { status: 400 });
    }

    const progress = await db.progress.create({
      data: {
        userId: session.user.id,
        language,
        level: typeof level === "number" ? level : 1,
        xp: typeof xp === "number" ? xp : 0,
      },
    });

    return NextResponse.json(progress, { status: 201 });
  } catch (error) {
    console.error("[PROGRESS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}