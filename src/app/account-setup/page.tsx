"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { AccountSetup } from "@/components/auth/account-setup"

export default function AccountSetupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/30">
      <AccountSetup userId={session.user.id} />
    </div>
  )
} 