import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { AuthForm } from "@/components/auth/auth-form"
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { authOptions } from "@/lib/auth"

export default async function RegisterPage() {
  const session = await getServerSession(authOptions)

  if (session?.user?.id) {
    redirect("/auth/post-login")
  }

  return (
    <div className="relative min-h-[100dvh] w-full">
      <BackgroundGradientAnimation
        gradientBackgroundStart="rgb(0, 17, 82)"
        gradientBackgroundEnd="rgb(108, 0, 162)"
        firstColor="18, 113, 255"
        secondColor="221, 74, 255"
        thirdColor="100, 220, 255"
        fourthColor="200, 50, 50"
        fifthColor="180, 180, 50"
        pointerColor="140, 100, 255"
        size="100%"
        blendingValue="soft-light"
        interactive={false}
        containerClassName="absolute inset-0 opacity-30"
      />
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 pt-20 pb-6">
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading...</div>}>
            <AuthForm mode="register" />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
