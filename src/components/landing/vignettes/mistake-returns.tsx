import { LessonFrame, OptionRow, PromptBadge } from "./lesson-frame";

/** A question the learner missed earlier, back again with the Review badge the lesson player shows. */
export function MistakeReturns({ className }: { className?: string }) {
  return (
    <LessonFrame progress={0.8} className={className}>
      <div className="flex items-center gap-2">
        <PromptBadge tone="review" />
        <p className="whitespace-nowrap text-base font-extrabold">How do you say this?</p>
      </div>
      <p className="py-7 text-center text-[1.7rem] font-extrabold">“the train station”</p>
      <div className="grid gap-2.5">
        <OptionRow state="dimmed" lang="de">
          die Bushaltestelle
        </OptionRow>
        <OptionRow state="correct" lang="de">
          der Bahnhof
        </OptionRow>
        <OptionRow state="dimmed" lang="de">
          die Bäckerei
        </OptionRow>
      </div>
    </LessonFrame>
  );
}
