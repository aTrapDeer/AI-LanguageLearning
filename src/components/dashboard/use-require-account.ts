"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Sends signed-out visitors to the login page and learners who haven't finished account setup to
 * onboarding. Returns true once the page may render. Keyed on primitives, not the session object,
 * because NextAuth hands out a new object on every window focus.
 */
export function useRequireAccount(callbackUrl: string): boolean {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const accountSetup = session?.user?.accountSetup;
  const userId = session?.user?.id ?? null;
  const [confirmedSetup, setConfirmedSetup] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    if (status !== "authenticated" || accountSetup !== false || !userId) {
      return;
    }

    // The cached session can lag right after onboarding finishes; ask the server before redirecting.
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/user/account-status", { cache: "no-store" });
        const body = response.ok ? ((await response.json()) as { accountSetup?: boolean }) : null;
        if (cancelled) return;
        if (body?.accountSetup) {
          setConfirmedSetup(userId);
          void update();
          return;
        }
      } catch {
        // Fall through to the redirect.
      }

      if (!cancelled) router.replace("/account-setup");
    })();

    return () => {
      cancelled = true;
    };
    // `update` is stable for the provider's lifetime; leaving it out avoids re-running on session refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, accountSetup, userId, router, callbackUrl]);

  if (status !== "authenticated" || !userId) {
    return false;
  }

  return accountSetup !== false || confirmedSetup === userId;
}
