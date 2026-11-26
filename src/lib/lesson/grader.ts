import { levenshtein, looseForm, normalizeForCompare } from "./text";
import type { BuildStep, ChoiceStep, GradeResult, GradedStep, LessonAnswer, MatchStep, TypeStep } from "./types";

/**
 * Shared grader: the player grades instantly with it and the server re-grades the submitted answers
 * against the stored plan, so both always agree.
 */

const ARTICLES: Record<string, string[]> = {
  de: ["der", "die", "das", "ein", "eine", "einen"],
  "pt-BR": ["o", "a", "os", "as", "um", "uma"],
  no: ["en", "ei", "et", "å"],
};

function wrong(expected: string, given: string, note: GradeResult["note"] = null): GradeResult {
  return { correct: false, note, expected, given };
}

function right(expected: string, given: string, note: GradeResult["note"] = null): GradeResult {
  return { correct: true, note, expected, given };
}

function gradeChoice(step: Pick<ChoiceStep, "options" | "answerId">, optionId: string): GradeResult {
  const expected = step.options.find((option) => option.id === step.answerId)?.text ?? "";
  const chosen = step.options.find((option) => option.id === optionId);
  if (!chosen) {
    return wrong(expected, "");
  }
  return optionId === step.answerId ? right(expected, chosen.text) : wrong(expected, chosen.text);
}

function gradeMatch(step: MatchStep, attempts: Array<[string, string]>): GradeResult {
  const expected = step.pairs.map((pair) => `${pair.target.text} = ${pair.english}`).join(", ");
  const ids = new Set(step.pairs.map((pair) => pair.id));
  const matched = new Set<string>();
  let firstMiss: [string, string] | null = null;

  for (const attempt of attempts.slice(0, 50)) {
    if (!Array.isArray(attempt) || attempt.length !== 2) {
      continue;
    }
    const [targetId, englishId] = attempt;
    if (targetId === englishId && ids.has(targetId)) {
      matched.add(targetId);
    } else if (!firstMiss) {
      firstMiss = [targetId, englishId];
    }
  }

  if (firstMiss) {
    const target = step.pairs.find((pair) => pair.id === firstMiss?.[0]);
    const english = step.pairs.find((pair) => pair.id === firstMiss?.[1]);
    return wrong(expected, target && english ? `${target.target.text} = ${english.english}` : "");
  }

  return matched.size === ids.size ? right(expected, expected) : wrong(expected, "");
}

function gradeBuild(step: BuildStep, tileIds: string[], language: string): GradeResult {
  const expected = step.sentence.text;
  const byId = new Map(step.tiles.map((tile) => [tile.id, tile.text]));
  const used = new Set<string>();
  const texts: string[] = [];
  for (const id of tileIds.slice(0, step.tiles.length)) {
    const text = byId.get(id);
    if (text === undefined || used.has(id)) {
      return wrong(expected, texts.join(" "));
    }
    used.add(id);
    texts.push(text);
  }

  const given = texts.join(language === "zh" ? "" : " ");
  const norms = texts.map((text) => normalizeForCompare(text, language));
  const matches = step.solutions.some(
    (solution) => solution.length === norms.length && solution.every((token, index) => token === norms[index])
  );
  return matches ? right(expected, given) : wrong(expected, given);
}

function stripArticle(text: string, language: string): string | null {
  const articles = ARTICLES[language];
  if (!articles) {
    return null;
  }
  const [first, ...rest] = text.split(" ");
  return rest.length > 0 && articles.includes(first) ? rest.join(" ") : null;
}

/**
 * Tolerant typed-answer grading: case, punctuation and spacing never matter; a missing accent or a
 * single typo in a longer word still counts (with a note), a missing article does not.
 */
export function gradeTyped(step: Pick<TypeStep, "answer" | "accepted">, input: string, language: string): GradeResult {
  const expected = step.answer;
  const given = input.trim().slice(0, 200);
  const answers = [step.answer, ...step.accepted];
  const normalizedGiven = normalizeForCompare(given, language);
  if (!normalizedGiven) {
    return wrong(expected, given);
  }

  if (answers.some((answer) => normalizeForCompare(answer, language) === normalizedGiven)) {
    return right(expected, given);
  }

  const looseGiven = looseForm(given, language);
  if (answers.some((answer) => looseForm(answer, language) === looseGiven)) {
    return right(expected, given, "accent");
  }

  for (const answer of answers) {
    const withoutArticle = stripArticle(normalizeForCompare(answer, language), language);
    if (withoutArticle && (withoutArticle === normalizedGiven || looseForm(withoutArticle, language) === looseGiven)) {
      return wrong(expected, given, "article");
    }
  }

  const typoMatch = answers.some((answer) => {
    const loose = looseForm(answer, language);
    return Array.from(loose).length >= 6 && levenshtein(loose, looseGiven) === 1;
  });
  return typoMatch ? right(expected, given, "typo") : wrong(expected, given);
}

export function gradeStep(step: GradedStep, answer: LessonAnswer | null | undefined, language: string): GradeResult {
  if (!answer || typeof answer !== "object") {
    return wrong("", "");
  }

  switch (step.kind) {
    case "choice":
    case "fill":
      return answer.type === "choice" ? gradeChoice(step, String(answer.optionId)) : wrong("", "");
    case "listen":
      if (answer.type !== "choice") return wrong("", "");
      return answer.variant === "fallback" ? gradeChoice(step.fallback, String(answer.optionId)) : gradeChoice(step, String(answer.optionId));
    case "match":
      return answer.type === "match" && Array.isArray(answer.attempts) ? gradeMatch(step, answer.attempts) : wrong("", "");
    case "build":
      return answer.type === "build" && Array.isArray(answer.tileIds) ? gradeBuild(step, answer.tileIds.map(String), language) : wrong(step.sentence.text, "");
    case "type":
      return answer.type === "type" && typeof answer.text === "string" ? gradeTyped(step, answer.text, language) : wrong(step.answer, "");
    default:
      return wrong("", "");
  }
}
