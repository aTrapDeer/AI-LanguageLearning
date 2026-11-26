"use client";

import { Loader2 } from "lucide-react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useRequireAccount } from "@/components/dashboard/use-require-account";

export default function DashboardPage() {
  const ready = useRequireAccount("/dashboard");

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
        <Loader2 aria-label="Loading" className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return <DashboardView />;
}
