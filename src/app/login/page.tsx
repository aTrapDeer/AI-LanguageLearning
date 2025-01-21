import { AuthForm } from "@/components/auth/auth-form"
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';

export default function LoginPage() {
  return (
    <div className="relative h-screen w-screen">
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
      <div className="container relative flex h-screen w-screen flex-col items-center justify-center">
        <AuthForm mode="login" />
      </div>
    </div>
  )
} 