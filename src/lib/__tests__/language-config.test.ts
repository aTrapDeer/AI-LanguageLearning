import { describe, expect, it } from "vitest";
import {
  getLanguageConfig,
  getSupportedLanguageName,
  isSupportedLanguageCode,
  LANGUAGES,
  resolveLanguageCode,
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
} from "../language-config";

describe("language-config", () => {
  it("has a complete config for every supported code", () => {
    expect(SUPPORTED_LANGUAGES.map((language) => language.code)).toEqual([...SUPPORTED_LANGUAGE_CODES]);
    for (const code of SUPPORTED_LANGUAGE_CODES) {
      const config = LANGUAGES[code];
      expect(config.code).toBe(code);
      expect(config.name).not.toBe("");
      expect(config.nativeName).not.toBe("");
      expect(config.speechLocale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(config.transcriptionCode).toMatch(/^[a-z]{2}$/);
      expect(config.voiceLanguagePrefixes.length).toBeGreaterThan(0);
      expect(config.needsRomanization).toBe(config.romanizationName !== null);
    }
  });

  it("marks the expected scripts", () => {
    expect(LANGUAGES.ar.rtl).toBe(true);
    expect(SUPPORTED_LANGUAGES.filter((language) => language.rtl).map((language) => language.code)).toEqual(["ar"]);
    expect(SUPPORTED_LANGUAGES.filter((language) => language.needsRomanization).map((language) => language.code).sort()).toEqual([
      "ar",
      "ko",
      "zh",
    ]);
    expect(LANGUAGES.zh.romanizationName).toBe("Pinyin");
    expect(LANGUAGES.no.speechLocale).toBe("nb-NO");
    expect(LANGUAGES["pt-BR"].transcriptionCode).toBe("pt");
  });

  it("validates and looks up codes", () => {
    expect(isSupportedLanguageCode("de")).toBe(true);
    expect(isSupportedLanguageCode("pt-br")).toBe(false);
    expect(isSupportedLanguageCode(42)).toBe(false);
    expect(getLanguageConfig("ko")?.name).toBe("Korean");
    expect(getLanguageConfig("xx")).toBeNull();
    expect(getSupportedLanguageName("xx")).toBe("xx");
  });

  it("resolves legacy names and casing", () => {
    expect(resolveLanguageCode("German")).toBe("de");
    expect(resolveLanguageCode("Portuguese (Brazilian)")).toBe("pt-BR");
    expect(resolveLanguageCode("pt-br")).toBe("pt-BR");
    expect(resolveLanguageCode(" zh ")).toBe("zh");
    expect(resolveLanguageCode("English")).toBeNull();
    expect(resolveLanguageCode(undefined)).toBeNull();
  });
});
