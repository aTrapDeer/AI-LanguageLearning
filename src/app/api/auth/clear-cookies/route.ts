import { NextResponse } from "next/server";

/**
 * API Route to clear all authentication cookies
 * This helps resolve auth conflicts between NextAuth and Supabase
 */
export async function GET() {
  try {
    // List of all possible auth cookies to clear
    const cookiesToClear = [
      'next-auth.session-token',
      'next-auth.callback-url',
      'next-auth.csrf-token',
      '__Secure-next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Host-next-auth.csrf-token',
      'supabase-auth-token',
      '__Secure.next-auth.session-token'
    ];
    
    // Create response with headers to clear cookies
    const response = NextResponse.json({ 
      success: true, 
      message: "Auth cookies cleared"
    });
    
    // Add Set-Cookie headers to clear each cookie
    for (const name of cookiesToClear) {
      response.headers.append(
        'Set-Cookie', 
        `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
      );
    }
    
    return response;
  } catch (error) {
    console.error("Error clearing cookies:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear cookies" },
      { status: 500 }
    );
  }
}

/**
 * POST handler for programmatic clearing
 */
export async function POST() {
  // Reuse the same cookie clearing logic
  return GET();
} 