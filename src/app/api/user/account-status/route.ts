import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { getAccountSetupStatus } from "@/lib/database";

/** Setup status of the signed-in user. A `userId` query parameter, if sent, must match the session. */
export async function GET(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const requestedUserId = new URL(req.url).searchParams.get("userId");
    if (requestedUserId && requestedUserId !== auth.userId) {
      return jsonError(403, "You don't have permission to access this account");
    }

    return NextResponse.json({ accountSetup: await getAccountSetupStatus(auth.userId) });
  } catch (error) {
    console.error("Error checking account status:", error);
    return jsonError(500, "Error checking account status");
  }
}
