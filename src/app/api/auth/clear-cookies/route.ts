import { NextResponse } from "next/server";

/**
 * API endpoint to clear all authentication-related cookies
 */
export async function GET() {
  try {
    // NextAuth specific cookies
    const authCookies = [
      'next-auth.session-token',
      'next-auth.callback-url',
      'next-auth.csrf-token',
      '__Secure-next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.csrf-token',
      '__Host-next-auth.csrf-token',
      'supabase-auth-token' // For Supabase
    ];

    // Create a response with headers that will clear each cookie
    const response = NextResponse.json({ 
      success: true, 
      message: "Authentication cookies cleared" 
    });

    // Delete each auth cookie by setting an expired value
    for (const cookieName of authCookies) {
      response.cookies.set({
        name: cookieName,
        value: '',
        expires: new Date(0),
        path: '/'
      });
    }

    return response;
  } catch (error) {
    console.error("Error clearing auth cookies:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear cookies" },
      { status: 500 }
    );
  }
} 