"use client"

import React, { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface SignOutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}

/**
 * Enhanced sign-out button that also clears cookies
 * to ensure a clean sign-out process
 */
export default function SignOutButton({ 
  variant = "default",
  size = "default", 
  className = "",
  children
}: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      // Clear cookies first to ensure clean state
      await fetch('/api/auth/clear-cookies');
      
      // Then sign out through NextAuth
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Error signing out:', error);
      // Force a redirect to login page if sign out fails
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSignOut}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? 'Signing out...' : children || (
        <>
          Sign out <LogOut className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
} 