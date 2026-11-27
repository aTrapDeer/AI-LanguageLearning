import { ensurePictures, findPictureUrls, pictureWaitMs, type PictureDeps, type PictureRequest } from "@/lib/images/service";
import type { ChoiceStep, LessonPlan, LessonStep, PlanPicture } from "./types";

/** Connects lesson plans to the shared vocabulary pictures. */

/**
 * Pictures the lesson's new words ask for (review words only reuse pictures that already exist).
 * Words that also get an English-prompt question come first: when the per-lesson cap bites, their
 * picture is shown twice in the lesson rather than once.
 */
export function planPictureRequests(plan: LessonPlan): PictureRequest[] {
  // 0: asked in a written question; 1: only in a listening fallback (devices without a voice); 2: intro only.
  const rank = new Map<string, number>();
  for (const step of plan.steps) {
    const choice = step.kind === "choice" ? step : step.kind === "listen" ? step.fallback : null;
    if (choice?.direction === "toTarget" && choice.ref.kind === "word") {
      const value = step.kind === "choice" ? 0 : 1;
      rank.set(choice.ref.key, Math.min(value, rank.get(choice.ref.key) ?? value));
    }
  }
  return plan.newWords
    .flatMap((word) => (word.picture?.key && word.picture.description ? [{ key: word.key, picture: word.picture }] : []))
    .map((entry, index) => ({ ...entry, order: (rank.get(entry.key) ?? 2) * 100 + index }))
    .sort((a, b) => a.order - b.order)
    .map(({ picture }) => ({ key: picture.key, description: picture.description }));
}

function pictureKeys(plan: LessonPlan): string[] {
  const keys = new Set<string>();
  const add = (picture: PlanPicture | null | undefined) => {
    if (picture?.key) keys.add(picture.key);
  };
  for (const step of plan.steps) {
    if (step.kind === "intro") add(step.word.picture);
    if (step.kind === "choice") add(step.picture);
    if (step.kind === "listen") add(step.fallback.picture);
  }
  return Array.from(keys);
}

function withUrl(picture: PlanPicture | null | undefined, urls: Map<string, string>): PlanPicture | null {
  if (!picture) return null;
  return { ...picture, url: urls.get(picture.key) ?? null };
}

function choiceWithUrl(step: ChoiceStep, urls: Map<string, string>): ChoiceStep {
  // Only "toTarget" questions may show a picture: next to the target word it would give the answer away.
  return step.picture ? { ...step, picture: step.direction === "toTarget" ? withUrl(step.picture, urls) : null } : step;
}

/** A copy of the plan with each picture's current URL (or null). The stored plan is not changed. */
export function attachPictureUrls(plan: LessonPlan, urls: Map<string, string>): LessonPlan {
  const steps = plan.steps.map((step): LessonStep => {
    switch (step.kind) {
      case "intro":
        return step.word.picture ? { ...step, word: { ...step.word, picture: withUrl(step.word.picture, urls) } } : step;
      case "choice":
        return choiceWithUrl(step, urls);
      case "listen":
        return step.fallback.picture ? { ...step, fallback: choiceWithUrl(step.fallback, urls) } : step;
      default:
        return step;
    }
  });
  return { ...plan, steps };
}

/**
 * Makes sure the plan's pictures exist or are on their way, then returns the plan with URLs. A newly
 * generated lesson waits briefly so its first learner usually sees the pictures; a pooled or resumed
 * one only fills in what is missing in the background. Never throws.
 */
export async function preparePlanPictures(params: {
  userId: string;
  plan: LessonPlan;
  freshlyGenerated: boolean;
  deps?: PictureDeps;
}): Promise<LessonPlan> {
  try {
    await ensurePictures({
      userId: params.userId,
      requests: planPictureRequests(params.plan),
      waitMs: params.freshlyGenerated ? pictureWaitMs() : 0,
      deps: params.deps,
    });
    return attachPictureUrls(params.plan, await findPictureUrls(pictureKeys(params.plan)));
  } catch (error) {
    console.error("[LESSON_PICTURES]", error);
    return params.plan;
  }
}
