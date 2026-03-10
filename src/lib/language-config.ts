export const SUPPORTED_LANGUAGE_CODES = ["de", "pt-BR", "zh", "no", "ko", "ar"] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export const SUPPORTED_LANGUAGES = [
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "pt-BR", name: "Portuguese (Brazilian)", flag: "🇧🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
] as const;

export function isSupportedLanguageCode(value: string): value is SupportedLanguageCode {
  return SUPPORTED_LANGUAGE_CODES.includes(value as SupportedLanguageCode);
}

export function getSupportedLanguage(code: string) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code) ?? null;
}

export function getSupportedLanguageName(code: string) {
  return getSupportedLanguage(code)?.name ?? code;
}
