import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccountSetupStatus } from "@/lib/database";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to access this account" },
        { status: 403 }
      );
    }

    const accountSetup = await getAccountSetupStatus(userId);

    const response = NextResponse.json({ accountSetup });
    response.headers.append("Access-Control-Allow-Origin", "*");
    response.headers.append("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.append("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
  } catch (error) {
    console.error("Error checking account status:", error);
    return NextResponse.json(
      { error: "Error checking account status" },
      { status: 500 }
    );
  }
} 