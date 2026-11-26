import { tokenizeExerciseText } from "@/lib/exercise-text";

/**
 * Text helpers for exercises: comparison-normal forms, tokenisation that keeps character offsets
 * (so a blank or a tile can be traced back to the exact sentence text) and script checks.
 */

const PUNCTUATION_OR_SYMBOL = /[\p{P}\p{S}]/gu;
const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;
// Harakat, Quranic marks, superscript alef and tatweel: optional in everyday Arabic writing.
const ARABIC_OPTIONAL_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

const NO_SPACE_LANGUAGES = new Set(["zh", "ja"]);

export function usesSpaces(language: string): boolean {
  return !NO_SPACE_LANGUAGES.has(language);
}

/** Case-, punctuation- and whitespace-insensitive form used for every answer comparison. */
export function normalizeForCompare(text: string, language?: string): string {
  let value = text.normalize("NFKC");
  if (language === "ar") {
    value = value.replace(ARABIC_OPTIONAL_MARKS, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي");
  }

  value = value.toLocaleLowerCase().replace(PUNCTUATION_OR_SYMBOL, " ").replace(/\s+/g, " ").trim();
  return language && !usesSpaces(language) ? value.replace(/\s/g, "") : value;
}

/** Additionally ignores accents and letter variants (ß/ss, ø/o, æ/ae), for "almost" feedback. */
export function looseForm(text: string, language?: string): string {
  return normalizeForCompare(text, language)
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .normalize("NFC");
}

export function stripEdgePunctuation(text: string): string {
  return text.replace(EDGE_PUNCTUATION, "");
}

export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface TextToken {
  /** The token without surrounding punctuation, as written. */
  core: string;
  /** Normalised core for comparisons. */
  norm: string;
  start: number;
  end: number;
}

function isSkippable(char: string) {
  return /[\s\p{P}\p{S}]/u.test(char);
}

/** Lines up `words` (in order) with `text`, skipping spaces and punctuation between them. */
function alignWords(text: string, words: string[], language: string): TextToken[] | null {
  const tokens: TextToken[] = [];
  let cursor = 0;

  for (const rawWord of words) {
    const word = stripEdgePunctuation(rawWord.trim());
    if (!word) {
      continue;
    }

    while (cursor < text.length && isSkippable(text[cursor]) && !text.startsWith(word, cursor)) {
      cursor += 1;
    }

    if (!text.startsWith(word, cursor)) {
      return null;
    }

    tokens.push({ core: word, norm: normalizeForCompare(word, language), start: cursor, end: cursor + word.length });
    cursor += word.length;
  }

  const rest = text.slice(cursor);
  if (Array.from(rest).some((char) => !isSkippable(char))) {
    return null;
  }

  return tokens.length > 0 ? tokens : null;
}

function splitOnSpaces(text: string, language: string): TextToken[] {
  const tokens: TextToken[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const leading = raw.length - raw.replace(/^[\p{P}\p{S}]+/u, "").length;
    const core = stripEdgePunctuation(raw);
    if (!core) {
      continue;
    }

    tokens.push({ core, norm: normalizeForCompare(core, language), start: index + leading, end: index + leading + core.length });
  }

  return tokens;
}

/**
 * Splits a sentence into word tokens with offsets. Space-separated scripts split on whitespace.
 * For Chinese the content's own word list is used when it lines up with the text exactly,
 * otherwise the platform word segmenter.
 */
export function tokenizeSentence(text: string, language: string, words?: string[] | null): TextToken[] {
  if (usesSpaces(language) && /\s/.test(text.trim())) {
    return splitOnSpaces(text, language);
  }

  if (words && words.length > 0) {
    const aligned = alignWords(text, words, language);
    if (aligned) {
      return aligned;
    }
  }

  if (usesSpaces(language)) {
    return splitOnSpaces(text, language);
  }

  return alignWords(text, tokenizeExerciseText(text, language), language) ?? [];
}

/** Every contiguous token span whose text equals `phrase` (after normalisation). */
export function findPhraseSpans(tokens: TextToken[], phrase: string, language: string): Array<[number, number]> {
  const target = normalizeForCompare(phrase, language);
  if (!target) {
    return [];
  }

  const joiner = usesSpaces(language) ? " " : "";
  const spans: Array<[number, number]> = [];
  for (let start = 0; start < tokens.length; start += 1) {
    let joined = "";
    for (let end = start; end < tokens.length; end += 1) {
      joined = end === start ? tokens[end].norm : `${joined}${joiner}${tokens[end].norm}`;
      if (joined === target) {
        spans.push([start, end]);
        break;
      }

      if (joined.length >= target.length) {
        break;
      }
    }
  }

  return spans;
}

/** True when `needle` occurs in `haystack` as whole words (space languages) or as a substring (Chinese). */
export function containsPhrase(haystack: string, needle: string, language: string): boolean {
  const hay = normalizeForCompare(haystack, language);
  const nee = normalizeForCompare(needle, language);
  if (!hay || !nee) {
    return false;
  }

  return usesSpaces(language) ? ` ${hay} `.includes(` ${nee} `) : hay.includes(nee);
}

const SCRIPT_PATTERNS = {
  latin: /\p{Script=Latin}/u,
  han: /\p{Script=Han}/u,
  hangul: /\p{Script=Hangul}/u,
  arabic: /\p{Script=Arabic}/u,
} as const;

const FOREIGN_LETTERS = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Hiragana}\p{Script=Katakana}]/u;

function targetScript(language: string): keyof typeof SCRIPT_PATTERNS {
  switch (language) {
    case "zh":
      return "han";
    case "ko":
      return "hangul";
    case "ar":
      return "arabic";
    default:
      return "latin";
  }
}

/**
 * The text is written in the language's script: it contains letters of that script and, for the
 * non-Latin languages, no Latin letters (catches English or romanisation in the wrong field).
 */
export function isInTargetScript(text: string, language: string): boolean {
  const script = targetScript(language);
  if (!SCRIPT_PATTERNS[script].test(text)) {
    return false;
  }

  if (script === "latin") {
    return !FOREIGN_LETTERS.test(text);
  }

  return !SCRIPT_PATTERNS.latin.test(text);
}

/** English (or romanisation): Latin letters only, no CJK/Hangul/Arabic. */
export function isLatinText(text: string): boolean {
  return SCRIPT_PATTERNS.latin.test(text) && !FOREIGN_LETTERS.test(text);
}

export function levenshtein(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }

  return previous[right.length];
}
