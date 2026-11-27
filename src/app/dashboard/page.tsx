"use client";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useRequireAccount } from "@/components/dashboard/use-require-account";

export default function DashboardPage() {
  const ready = useRequireAccount("/dashboard");

  if (!ready) {
    // Same frame as the loaded page, so the account check doesn't cause a jump.
    return (
      <div className="min-h-[100dvh] bg-paper pb-16 pt-[4.25rem] md:pt-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-1 h-11 w-40 lg:hidden" />
          <div className="h-[2rem] w-64 max-w-full rounded-lg bg-ink-900/[0.06] sm:h-[2.6rem]" />
          <div className="mt-2.5 h-4 w-48 rounded bg-ink-900/[0.05]" />
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return <DashboardView />;
}
