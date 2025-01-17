import { AuthForm } from "@/components/auth/auth-form"

export default function LoginPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <AuthForm mode="login" />
    </div>
  )
} 