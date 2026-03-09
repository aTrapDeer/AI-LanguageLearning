import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.user.findUnique({
      where: { id: "test-connection" },
    });

    return NextResponse.json({
      status: "success",
      message: "Turso database connection successful",
      diagnostics: {
        nodeEnv: process.env.NODE_ENV,
        hasTursoUrl: Boolean(process.env.TURSO_DATABASE_URL),
        hasTursoAuthToken: Boolean(process.env.TURSO_AUTH_TOKEN),
      },
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}