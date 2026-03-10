"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { AccountSetup } from "@/components/auth/account-setup"

function AccountSetupPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAddLanguageFlow = searchParams.get("mode") === "add-language" && Boolean(searchParams.get("lang"))
  const queryString = searchParams.toString()
  const callbackUrl = `/account-setup${queryString ? `?${queryString}` : ""}`

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
      return
    }

    if (status === "authenticated" && session?.user?.accountSetup && !isAddLanguageFlow) {
      router.replace("/dashboard")
    }
  }, [callbackUrl, isAddLanguageFlow, session?.user?.accountSetup, status, router])

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (session.user.accountSetup && !isAddLanguageFlow) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/30">
      <AccountSetup userId={session.user.id} />
    </div>
  )
}

export default function AccountSetupPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    }>
      <AccountSetupPageContent />
    </Suspense>
  )
} 