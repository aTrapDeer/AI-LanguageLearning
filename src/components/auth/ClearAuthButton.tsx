"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthCookies } from '@/lib/auth-utils';

/**
 * A component that automatically handles auth errors by clearing cookies
 * and redirecting the user when auth callback errors are detected
 */
export default function ClearAuthButton() {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Function to handle clearing cookies and redirecting - using useCallback to avoid dependency issues
  const handleClearAuth = useCallback(async () => {
    if (isClearing) return; // Prevent multiple calls
    
    setIsClearing(true);
    try {
      // First try the API endpoint method
      await fetch('/api/auth/clear-cookies');
      
      // Also try client-side clearing as backup
      clearAuthCookies();
      
      // Redirect to the login page without the error params
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error clearing auth cookies:', error);
      // If API fails, try client-side method again
      clearAuthCookies();
      
      // Redirect to login page even if there was an error
      router.push('/login');
      router.refresh();
    }
  }, [isClearing, router]);
  
  // Use useEffect to check for errors client-side only to avoid hydration mismatch
  useEffect(() => {
    // Only run in the browser
    if (typeof window === 'undefined') return;
    
    const url = new URL(window.location.href);
    const error = url.searchParams.get('error');
    const callbackUrl = url.searchParams.get('callbackUrl');
    
    // Check for error OR if we're at login page with a callbackUrl (which suggests a failed login)
    if (error || (window.location.pathname === '/login' && callbackUrl)) {
      setHasError(true);
      
      // Automatically clear auth state if this is a Callback error or if we're stuck at login
      if (error === 'Callback' || (window.location.pathname === '/login' && callbackUrl)) {
        handleClearAuth();
      }
    }
  }, [handleClearAuth]);
  
  // Don't render anything to avoid hydration issues - this component now works automatically
  if (!hasError) return null;

  // Show a small loading indicator if we're in the process of clearing
  if (isClearing) {
    return (
      <div className="p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm text-blue-600 flex items-center">
          <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Fixing authentication issue...
        </div>
      </div>
    );
  }

  return null; // Don't show anything when not clearing
} 