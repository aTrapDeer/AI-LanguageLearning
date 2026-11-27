import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return <div className={cn("rounded-[1.75rem] motion-safe:animate-pulse", className)} />;
}

/** Mirrors the loaded layout's grid and heights so nothing jumps when data arrives. */
export function DashboardSkeleton() {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_368px] lg:gap-5" aria-busy="true" aria-label="Loading your dashboard">
      <Block className="h-[18rem] bg-gradient-to-br from-ink-900 to-ink-700 lg:col-start-1 lg:row-start-1 lg:h-auto lg:min-h-[21rem]" />
      <Block className="h-[15.5rem] bg-white lg:col-start-2 lg:row-start-1 lg:h-auto" />
      <Block className="h-[16rem] bg-white lg:col-start-2 lg:row-start-2" />
      <Block className="h-[38rem] bg-white lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:h-auto" />
      <Block className="h-[18rem] bg-white lg:col-start-2 lg:row-start-3" />
    </div>
  );
}
