"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Landing-page call to action that adapts to whether the visitor is signed in. */
export function LandingCta({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const primary = cn(
    "group inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-7 text-lg font-extrabold shadow-lg transition focus-visible:outline-none focus-visible:ring-4",
    tone === "dark"
      ? "bg-white text-indigo-700 hover:bg-indigo-50 focus-visible:ring-white/50"
      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 focus-visible:ring-indigo-300"
  );

  return (
    <div className={cn("flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center", className)}>
      <Link href={signedIn ? "/dashboard" : "/register"} className={primary}>
        {signedIn ? "Continue learning" : "Start learning"}
        <ArrowRight aria-hidden className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
      </Link>
      {!signedIn && (
        <Link
          href="/login"
          className={cn(
            "inline-flex h-14 items-center justify-center rounded-2xl px-7 text-lg font-bold transition",
            tone === "dark" ? "bg-white/10 text-white hover:bg-white/20" : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
          )}
        >
          I have an account
        </Link>
      )}
    </div>
  );
}
