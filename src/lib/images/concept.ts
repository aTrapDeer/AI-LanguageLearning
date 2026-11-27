/**
 * Vocabulary pictures are keyed by an English concept so that "der Apfel", "a maçã" and "苹果" all
 * share one "apple" picture. Pure and client-safe.
 */

export const MAX_CONCEPT_KEY_LENGTH = 60;
export const MAX_PICTURE_DESCRIPTION_LENGTH = 160;

/** Register and grammar labels that do not change what a word looks like. */
const NEUTRAL_LABELS = new Set([
  "polite",
  "formal",
  "informal",
  "casual",
  "colloquial",
  "slang",
  "plural",
  "pl",
  "singular",
  "sg",
  "masculine",
  "feminine",
  "m",
  "f",
  "noun",
  "verb",
]);

const LEADING_WORDS = /^(?:to|a|an|the|some)(?:\s+|$)/;

/**
 * Normalised English concept for a word's meaning, or null when nothing usable is left.
 * "the Apple" → "apple", "to eat" → "eat", "orange (fruit)" → "orange fruit",
 * "thank you (polite)" → "thank you", "ice-cream / gelato" → "ice cream".
 */
export function conceptKeyFor(meaning: string | null | undefined): string | null {
  if (typeof meaning !== "string") return null;

  let text = meaning
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Labels in brackets: drop neutral ones, keep disambiguating ones ("orange (fruit)").
    .replace(/\(([^)]*)\)/g, (_match, inner: string) => {
      const label = inner.trim().replace(/\.$/, "");
      return NEUTRAL_LABELS.has(label) ? " " : ` ${inner} `;
    });

  // Several meanings ("to eat / to dine", "hi, hello"): the first one names the picture.
  text = text.split(/[/;,|]/)[0] ?? "";

  text = text
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  for (let pass = 0; pass < 2; pass += 1) {
    text = text.replace(LEADING_WORDS, "");
  }
  text = text.replace(/\s+/g, " ").trim();

  if (!text || text.length > MAX_CONCEPT_KEY_LENGTH) return null;
  return text;
}

/**
 * Cleans a model-written visual description: single line, no quotes or brackets that could break out
 * of the prompt template, bounded length. Returns null when it is empty or not plain English text.
 */
export function cleanPictureDescription(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/["“”«»<>{}[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
  if (!cleaned || cleaned.length > MAX_PICTURE_DESCRIPTION_LENGTH) return null;
  // English only: anything in another script would invite the model to draw lettering.
  if (!/^[\p{Script=Latin}\p{N}\p{P}\p{Zs}'’-]+$/u.test(cleaned)) return null;
  return cleaned;
}

/**
 * The one prompt template every picture is generated with, so the whole app shares a style. The
 * picture must never contain writing: it would give the answer away or show English.
 */
export function buildImagePrompt(description: string): string {
  const subject = cleanPictureDescription(description) ?? "a simple everyday object";
  return [
    `A friendly flat illustration of ${subject}.`,
    "One clear subject, centred and filling most of the square frame, on a plain light pastel background.",
    "Simple rounded shapes, soft colours, gentle outlines, no clutter, no extra objects, no border.",
    "Culturally neutral and suitable for all ages.",
    "Absolutely no text: no letters, words, numbers, labels, captions, signs, logos or writing of any kind anywhere in the image.",
  ].join(" ");
}

export type SniffedImageFormat = "png" | "jpeg" | "webp" | "gif";

/** Identifies an image from its first bytes. The Images API may return any of these. */
export function sniffImageFormat(bytes: Uint8Array): SniffedImageFormat | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";
  return null;
}

/** Public URL of a stored picture. */
export function conceptImageUrl(id: string): string {
  return `/api/images/${id}`;
}
