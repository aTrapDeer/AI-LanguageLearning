import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { consumeAiQuota, type AiQuotaKind } from "./db/quota";

export type AuthResult =
  | { ok: true; userId: string; session: Session; response?: never }
  | { ok: false; response: NextResponse; userId?: never; session?: never };

export function jsonError(status: number, error: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * Resolves the signed-in user for an API route. Identity always comes from the session cookie,
 * never from the request body or query.
 *
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;
 *   auth.userId // string
 */
export async function requireUser(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!session || typeof userId !== "string" || userId === "") {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }

  return { ok: true, userId, session };
}

/**
 * Reserves AI quota before spending money. Returns a 429 response when the learner hit today's cap,
 * or null to continue.
 *
 *   const limited = await enforceAiQuota(auth.userId, "text");
 *   if (limited) return limited;
 */
export async function enforceAiQuota(userId: string, kind: AiQuotaKind, cost = 1): Promise<NextResponse | null> {
  try {
    const result = await consumeAiQuota({ userId, kind, cost });
    if (result.allowed) {
      return null;
    }

    return jsonError(429, "You've reached today's limit for this feature. It resets at midnight UTC.", {
      code: "ai_quota_exceeded",
      kind,
      limit: result.limit,
    });
  } catch (error) {
    // A quota-store outage should not take the learning features down with it.
    console.error("[AI_QUOTA]", error);
    return null;
  }
}
