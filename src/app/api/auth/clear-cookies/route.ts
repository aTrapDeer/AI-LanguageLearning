import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * API Route to clear all authentication cookies
 * This helps resolve auth conflicts between NextAuth and Supabase
 */
export async function GET() {
  const cookieStore = cookies();
  
  // Clear all NextAuth cookies
  const nextAuthCookies = [
    'next-auth.session-token',
    'next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.session-token',
    '__Secure-next-auth.callback-url',
    '__Host-next-auth.csrf-token',
  ];
  
  // Clear all Supabase cookies
  const supabaseCookies = [
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
  ];
  
  // Get all cookies and clear any that might be related to authentication
  const allCookies = cookieStore.getAll();
  for (const cookie of allCookies) {
    const name = cookie.name;
    
    // Delete specific auth cookies
    if (nextAuthCookies.includes(name) || 
        supabaseCookies.includes(name) || 
        name.includes('auth') || 
        name.includes('token')) {
      
      cookieStore.delete(name);
    }
  }

  return NextResponse.json({ 
    success: true, 
    message: 'All authentication cookies cleared' 
  });
}

/**
 * POST handler for programmatic clearing
 */
export async function POST() {
  // Reuse the same cookie clearing logic
  return GET();
} 