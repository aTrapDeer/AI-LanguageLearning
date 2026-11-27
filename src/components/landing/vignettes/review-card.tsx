import { cn } from "@/lib/utils";

const GRADES = [
  { label: "Again", interval: "10 min", className: "bg-rose-500" },
  { label: "Hard", interval: "2 d", className: "bg-amber-500" },
  { label: "Good", interval: "3 d", className: "bg-emerald-500" },
  { label: "Easy", interval: "4 d", className: "bg-sky-500" },
];

/** The review card after flipping, with the four grades and when each would bring the word back. */
export function ReviewCardVignette({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("select-none rounded-3xl bg-white p-5 text-center text-slate-900 shadow-2xl shadow-ink-950/25", className)}>
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide">
        <span className="text-indigo-500">What does this mean?</span>
        <span className="rounded-full bg-sky-100 px-2 text-sky-700">Review</span>
      </div>
      <p lang="de" className="mt-5 text-4xl font-extrabold">
        der Bahnhof
      </p>
      <div className="mx-auto my-4 h-px w-16 bg-slate-200" />
      <p className="text-xl font-bold text-slate-800">train station</p>
      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-left text-sm">
        <p lang="de" className="font-medium text-slate-800">
          Wo ist der Bahnhof?
        </p>
        <p className="text-xs text-slate-500">Where is the train station?</p>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {GRADES.map((grade) => (
          <div key={grade.label} className={cn("rounded-xl py-2 text-white shadow-md", grade.className)}>
            <p className="text-sm font-extrabold leading-tight">{grade.label}</p>
            <p className="text-[11px] font-semibold text-white/90">{grade.interval}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
