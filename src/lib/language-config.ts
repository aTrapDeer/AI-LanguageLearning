/**
 * Single source of truth for the languages Laingfy teaches.
 * Safe to import from both server and client code (no I/O).
 */

export const SUPPORTED_LANGUAGE_CODES = ["de", "pt-BR", "zh", "no", "ko", "ar"] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export interface LanguageConfig {
  code: SupportedLanguageCode;
  /** English name, e.g. "German". */
  name: string;
  /** Endonym, e.g. "Deutsch". */
  nativeName: string;
  flag: string;
  /** BCP-47 locale passed to `speechSynthesis` / `SpeechSynthesisUtterance.lang`. */
  speechLocale: string;
  /**
   * Lower-case language prefixes a browser voice may report for this language.
   * Norwegian voices show up as nb-NO, no-NO or nn-NO depending on the platform.
   */
  voiceLanguagePrefixes: readonly string[];
  /** ISO-639-1 code accepted by the transcription APIs. */
  transcriptionCode: string;
  rtl: boolean;
  /** Whether learners need a Latin-script reading aid alongside the native script. */
  needsRomanization: boolean;
  romanizationName: string | null;
}

export const LANGUAGES: Readonly<Record<SupportedLanguageCode, LanguageConfig>> = {
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    speechLocale: "de-DE",
    voiceLanguagePrefixes: ["de"],
    transcriptionCode: "de",
    rtl: false,
    needsRomanization: false,
    romanizationName: null,
  },
  "pt-BR": {
    code: "pt-BR",
    name: "Portuguese (Brazilian)",
    nativeName: "Português (Brasil)",
    flag: "🇧🇷",
    speechLocale: "pt-BR",
    voiceLanguagePrefixes: ["pt-br", "pt"],
    transcriptionCode: "pt",
    rtl: false,
    needsRomanization: false,
    romanizationName: null,
  },
  zh: {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
    flag: "🇨🇳",
    speechLocale: "zh-CN",
    // Deliberately not bare "zh": zh-HK voices speak Cantonese.
    voiceLanguagePrefixes: ["zh-cn", "zh-hans", "cmn", "zh-sg", "zh-tw"],
    transcriptionCode: "zh",
    rtl: false,
    needsRomanization: true,
    romanizationName: "Pinyin",
  },
  no: {
    code: "no",
    name: "Norwegian",
    nativeName: "Norsk",
    flag: "🇳🇴",
    speechLocale: "nb-NO",
    voiceLanguagePrefixes: ["nb", "no", "nn"],
    transcriptionCode: "no",
    rtl: false,
    needsRomanization: false,
    romanizationName: null,
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
    speechLocale: "ko-KR",
    voiceLanguagePrefixes: ["ko"],
    transcriptionCode: "ko",
    rtl: false,
    needsRomanization: true,
    romanizationName: "Revised Romanization",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    speechLocale: "ar-SA",
    voiceLanguagePrefixes: ["ar"],
    transcriptionCode: "ar",
    rtl: true,
    needsRomanization: true,
    romanizationName: "Arabic transliteration",
  },
};

/** Ordered list for pickers. Keeps the `{ code, name, flag }` shape older callers rely on. */
export const SUPPORTED_LANGUAGES: readonly LanguageConfig[] = SUPPORTED_LANGUAGE_CODES.map((code) => LANGUAGES[code]);

export function isSupportedLanguageCode(value: unknown): value is SupportedLanguageCode {
  return typeof value === "string" && (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(value);
}

export function getLanguageConfig(code: string): LanguageConfig | null {
  return isSupportedLanguageCode(code) ? LANGUAGES[code] : null;
}

/** @deprecated alias of {@link getLanguageConfig}; kept for existing callers. */
export const getSupportedLanguage = getLanguageConfig;

export function getSupportedLanguageName(code: string): string {
  return getLanguageConfig(code)?.name ?? code;
}

const LEGACY_ALIASES: Record<string, SupportedLanguageCode> = {
  german: "de",
  deutsch: "de",
  "portuguese (brazilian)": "pt-BR",
  "brazilian portuguese": "pt-BR",
  portuguese: "pt-BR",
  pt: "pt-BR",
  "pt-br": "pt-BR",
  "pt_br": "pt-BR",
  chinese: "zh",
  mandarin: "zh",
  "zh-cn": "zh",
  norwegian: "no",
  nb: "no",
  "nb-no": "no",
  korean: "ko",
  arabic: "ar",
};

/**
 * Accepts a code or a legacy English display name ("German", "pt-br", "Portuguese (Brazilian)")
 * and returns the canonical code, or null when the language is not taught.
 */
export function resolveLanguageCode(value: unknown): SupportedLanguageCode | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (isSupportedLanguageCode(trimmed)) {
    return trimmed;
  }

  return LEGACY_ALIASES[trimmed.toLowerCase()] ?? null;
}
