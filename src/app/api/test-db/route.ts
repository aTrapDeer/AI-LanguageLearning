import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: "success",
      message: "Database connection successful",
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@') // Hide password in the URL
    })
  } catch (error) {
    console.error("Database connection error:", error)
    return NextResponse.json({
      status: "error",
      message: "Database connection failed",
      error: error instanceof Error ? error.message : "Unknown error",
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@') // Hide password in the URL
    }, { status: 500 })
  }
} 