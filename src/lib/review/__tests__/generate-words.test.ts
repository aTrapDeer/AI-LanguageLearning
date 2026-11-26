import { describe, expect, it } from "vitest";
import { buildWordPrompt, filterNewWords, type GeneratedWord } from "../generate-words";

const word = (value: string): GeneratedWord => ({
  word: value,
  translation: "x",
  romanization: null,
  exampleSentence: "s",
  exampleTranslation: "t",
});

describe("filterNewWords", () => {
  it("drops known words and duplicates, ignoring case and punctuation", () => {
    const result = filterNewWords([word("Hallo!"), word("Danke"), word("danke"), word("Bitte")], ["hallo"]);
    expect(result.map((entry) => entry.word)).toEqual(["Danke", "Bitte"]);
  });
});

describe("buildWordPrompt", () => {
  it("asks for romanization only where needed and lists words to avoid", () => {
    const zh = buildWordPrompt({
      languageName: "Chinese",
      levelDescription: "Level 1",
      unitDescription: "Greetings",
      count: 8,
      romanizationName: "Pinyin",
      avoid: ["你好"],
    });
    expect(zh.system).toContain("Pinyin");
    expect(zh.user).toContain("exactly 8");
    expect(zh.user).toContain("你好");
    expect(zh.user).toContain("Greetings");

    const de = buildWordPrompt({
      languageName: "German",
      levelDescription: "Level 1",
      unitDescription: null,
      count: 5,
      romanizationName: null,
      avoid: [],
    });
    expect(de.system).toContain('"romanization" to null');
    expect(de.user).not.toContain("already have");
  });
});
