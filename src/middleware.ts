import { NextResponse } from "next/server"
export default function middleware() {
  // Auth gating is handled inside app pages and API routes. Keeping middleware
  // passive avoids edge-runtime/session mismatches that can cause redirect loops.
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match dashboard paths
    '/dashboard',
    '/dashboard/:path*',
    // Match learn paths
    '/learn',
    '/learn/:path*',
    // Match account-setup path
    '/account-setup'
  ]
} 