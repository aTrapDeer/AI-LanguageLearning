import { cn } from "@/lib/utils";

/**
 * The indigo→purple brand backdrop, rendered once per screen. Static gradient plus two blurred glows
 * that drift slowly only on larger screens and only when the user allows motion, so phones don't pay
 * for continuous blur compositing.
 */
export function BrandBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgb(15,23,72)_0%,rgb(49,24,122)_45%,rgb(96,20,150)_100%)]" />
      <div className="absolute -left-1/4 -top-1/4 h-[60vmax] w-[60vmax] rounded-full bg-indigo-500/25 blur-3xl md:motion-safe:animate-float" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[55vmax] w-[55vmax] rounded-full bg-fuchsia-500/20 blur-3xl md:motion-safe:animate-float-slow" />
    </div>
  );
}
