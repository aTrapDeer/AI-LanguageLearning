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
    "group inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-7 text-[17px] font-bold transition focus-visible:outline-none focus-visible:ring-4",
    tone === "dark"
      ? "bg-ember-400 text-ink-950 shadow-[0_12px_32px_-10px_rgb(255_159_46/0.7)] hover:bg-ember-300 focus-visible:ring-white/70"
      : "bg-ink-900 text-white hover:bg-ink-800 focus-visible:ring-ink-300"
  );

  return (
    <div className={cn("flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center", className)}>
      <Link href={signedIn ? "/dashboard" : "/register"} className={primary}>
        {signedIn ? "Go to your dashboard" : "Start learning"}
        <ArrowRight aria-hidden className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </Link>
      {!signedIn && (
        <Link
          href="/login"
          className={cn(
            "inline-flex h-14 items-center justify-center rounded-2xl px-7 text-[17px] font-semibold transition focus-visible:outline-none focus-visible:ring-4",
            tone === "dark"
              ? "border border-white/20 text-white hover:bg-white/10 focus-visible:ring-white/50"
              : "border border-ink-900/15 text-ink-900 hover:bg-ink-50 focus-visible:ring-ink-300"
          )}
        >
          I have an account
        </Link>
      )}
    </div>
  );
}
