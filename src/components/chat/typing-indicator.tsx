import { cn } from "@/lib/utils";

/** Three bouncing dots while the tutor is "typing". */
export function TypingIndicator({ className, label = "Your tutor is typing" }: { className?: string; label?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("inline-flex w-fit items-center gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3.5 shadow-md", className)}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="h-2 w-2 rounded-full bg-indigo-300 motion-safe:animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
