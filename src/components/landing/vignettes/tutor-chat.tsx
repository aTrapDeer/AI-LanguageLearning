import { cn } from "@/lib/utils";
import { TutorCorrection } from "./tutor-correction";

/** A short exchange with the tutor: its question, the learner's slip, the gentle fix and the reply. */
export function TutorChat({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex select-none flex-col gap-2.5 text-[15px]", className)}>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2.5 text-white">
        <p lang="de">Was machst du am Wochenende?</p>
        <p className="mt-0.5 text-xs text-white/60">What are you doing at the weekend?</p>
      </div>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-ink-950">
        <p lang="de">Ich gehe in die Kino mit Lena.</p>
      </div>
      <TutorCorrection className="ml-auto w-[92%] shadow-none" />
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2.5 text-white">
        <p lang="de">Toll! Welchen Film seht ihr?</p>
        <p className="mt-0.5 text-xs text-white/60">Great! Which film are you seeing?</p>
      </div>
    </div>
  );
}
