import { NextResponse } from "next/server";
import type { ServiceResult } from "@/lib/lesson/service";

export function respond<T>(result: ServiceResult<T>): NextResponse {
  if (result.ok) {
    return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
}

export function serverError(tag: string, error: unknown): NextResponse {
  console.error(tag, error);
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "server_error" }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const body = (await req.json().catch(() => null)) as unknown;
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}
