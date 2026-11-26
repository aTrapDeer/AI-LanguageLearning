import { cn } from "@/lib/utils";

/** The learner's own message. `dir="auto"` so Arabic (or English) text lays out the right way. */
export function LearnerBubble({ text, pending = false }: { text: string; pending?: boolean }) {
  return (
    <div
      dir="auto"
      className={cn(
        "ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-indigo-500 px-4 py-2.5 text-[16px] leading-relaxed text-white shadow-md sm:max-w-[75%]",
        pending && "opacity-70"
      )}
    >
      {text}
    </div>
  );
}
