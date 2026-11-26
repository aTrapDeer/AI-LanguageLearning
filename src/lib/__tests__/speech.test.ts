import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../language-config";
import { pickVoice } from "../speech";

const voice = (lang: string, name = lang, extra: { localService?: boolean; default?: boolean } = {}) => ({ lang, name, ...extra });

describe("pickVoice", () => {
  it("prefers the exact locale, then local voices", () => {
    const voices = [voice("de-AT", "Austrian"), voice("de-DE", "Remote"), voice("de-DE", "Local", { localService: true })];
    expect(pickVoice(voices, LANGUAGES.de)?.name).toBe("Local");
  });

  it("falls back to a related locale", () => {
    expect(pickVoice([voice("en-US"), voice("de_CH", "Swiss")], LANGUAGES.de)?.name).toBe("Swiss");
    expect(pickVoice([voice("no-NO", "Norsk")], LANGUAGES.no)?.name).toBe("Norsk");
    expect(pickVoice([voice("pt-PT", "Portugal")], LANGUAGES["pt-BR"])?.name).toBe("Portugal");
  });

  it("never reads Mandarin with a Cantonese voice", () => {
    expect(pickVoice([voice("zh-HK", "Cantonese")], LANGUAGES.zh)).toBeNull();
    expect(pickVoice([voice("zh-HK", "Cantonese"), voice("zh-TW", "Taiwan")], LANGUAGES.zh)?.name).toBe("Taiwan");
    expect(pickVoice([voice("zh", "Generic")], LANGUAGES.zh)?.name).toBe("Generic");
  });

  it("returns null when nothing matches", () => {
    expect(pickVoice([voice("en-US"), voice("fr-FR")], LANGUAGES.ko)).toBeNull();
    expect(pickVoice([], LANGUAGES.ar)).toBeNull();
  });
});
