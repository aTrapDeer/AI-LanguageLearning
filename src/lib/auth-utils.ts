import { deleteCookie } from 'cookies-next';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Clears all NextAuth.js and related authentication cookies
 */
export function clearAuthCookies(req?: NextApiRequest, res?: NextApiResponse) {
  // NextAuth.js specific cookies
  const cookiesToClear = [
    'next-auth.session-token',
    'next-auth.callback-url',
    'next-auth.csrf-token',
    '__Secure-next-auth.callback-url',
    '__Secure-next-auth.session-token',
    '__Secure-next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'supabase-auth-token' // For Supabase auth if you're using it
  ];

  // Clear each cookie
  cookiesToClear.forEach(cookieName => {
    if (req && res) {
      deleteCookie(cookieName, { req, res });
    } else {
      // For client-side use
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  });

  // Also try to clear any other session storage
  if (typeof window !== 'undefined') {
    // Clear any session storage related to auth
    try {
      sessionStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('nextauth.message');
    } catch (e) {
      console.error('Error clearing session storage:', e);
    }
  }
}

/**
 * Check if the current URL contains an auth error
 */
export function hasAuthError() {
  if (typeof window === 'undefined') return false;
  
  const url = new URL(window.location.href);
  return url.searchParams.has('error');
}

/**
 * Get the auth error from the URL
 */
export function getAuthError() {
  if (typeof window === 'undefined') return null;
  
  const url = new URL(window.location.href);
  return url.searchParams.get('error');
} 