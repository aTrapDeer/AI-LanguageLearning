"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { z } from "zod"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDownIcon } from "@radix-ui/react-icons"
import ClearAuthButton from "./ClearAuthButton"

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")

interface AuthFormProps {
  mode: "login" | "register"
}

export function AuthForm({ mode }: AuthFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isManualExpanded, setIsManualExpanded] = useState(false)

  async function handleGoogleSignIn() {
    try {
      setLoading(true)
      setError(null)
      
      console.log("Starting Google sign in process...")
      
      // Clear any existing cookies first to prevent conflicts
      try {
        await fetch('/api/auth/clear-cookies');
        console.log("Cleared existing cookies");
      } catch (e) {
        console.warn("Failed to clear cookies via API:", e);
      }
      
      // Try to sign in with Google with explicit options
      const result = await signIn("google", { 
        callbackUrl: window.location.origin + "/dashboard",
        redirect: true,
        prompt: "select_account"
      })
      
      console.log("Sign in result:", result);
      
    } catch (err) {
      console.error("Google sign in error:", err)
      setError("Failed to sign in with Google. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      if (mode === "register") {
        const name = formData.get("name") as string
        
        try {
          passwordSchema.parse(password)
        } catch (err) {
          if (err instanceof z.ZodError) {
            setError(err.errors[0].message)
            setLoading(false)
            return
          }
        }

        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            nativeLanguage: "en",
            learningLanguages: []
          })
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message || "Failed to register")
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: true,
        callbackUrl: "/dashboard"
      })

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          setError("Invalid email or password")
        } else {
          setError("An error occurred during sign in")
        }
      }

    } catch (err) {
      console.error("Auth error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {mode === "login" 
            ? "Sign in to continue your language learning journey" 
            : "Start your language learning journey today"}
        </p>
      </div>

      {/* Google Sign In Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center justify-center gap-3 py-6 text-base"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-background px-2 text-muted-foreground">
            Or
          </span>
        </div>
      </div>

      {/* Manual Account Creation/Login Collapsible */}
      <Collapsible
        open={isManualExpanded}
        onOpenChange={setIsManualExpanded}
        className="space-y-4"
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between"
            disabled={loading}
          >
            <span>{mode === "login" ? "Use email instead" : "Create account manually"}</span>
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform duration-200 ${
                isManualExpanded ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Loading..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </CollapsibleContent>
      </Collapsible>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
          <div className="text-sm text-red-700 dark:text-red-200">{error}</div>
        </div>
      )}

      {/* Add the clear auth button that only appears when there's a callback error in URL */}
      <ClearAuthButton />

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Register here
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  )
} 