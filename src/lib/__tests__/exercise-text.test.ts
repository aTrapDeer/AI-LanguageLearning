import { describe, expect, it } from "vitest";
import {
  arraysEqual,
  findTokenIndicesForWords,
  joinExerciseTokens,
  normalizeTokenForComparison,
  normalizeVocabularyKey,
  tokenizeExerciseText,
} from "../exercise-text";

describe("tokenizeExerciseText", () => {
  it("splits spaced scripts on whitespace", () => {
    expect(tokenizeExerciseText("  Ich   trinke Kaffee. ", "de")).toEqual(["Ich", "trinke", "Kaffee."]);
    expect(tokenizeExerciseText("أنا أشرب القهوة", "ar")).toEqual(["أنا", "أشرب", "القهوة"]);
    expect(tokenizeExerciseText("저는 커피를 마셔요", "ko")).toEqual(["저는", "커피를", "마셔요"]);
    expect(tokenizeExerciseText("", "de")).toEqual([]);
  });

  it("segments unspaced Chinese into words and keeps punctuation attached", () => {
    const tokens = tokenizeExerciseText("我喜欢喝咖啡。", "zh");
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join("")).toBe("我喜欢喝咖啡。");
    expect(tokens[tokens.length - 1].endsWith("。")).toBe(true);
    expect(joinExerciseTokens(tokens, "zh")).toBe("我喜欢喝咖啡。");
  });

  it("joins with spaces for spaced languages", () => {
    expect(joinExerciseTokens(["Ich", "bin"], "de")).toBe("Ich bin");
  });
});

describe("normalisation", () => {
  it("normalises tokens for comparison", () => {
    expect(normalizeTokenForComparison("Kaffee.")).toBe("kaffee");
    expect(normalizeTokenForComparison("“Olá!”")).toBe("olá");
    expect(normalizeTokenForComparison("...")).toBe("...");
  });

  it("builds vocabulary keys that merge trivial variants", () => {
    expect(normalizeVocabularyKey("  Hallo! ")).toBe("hallo");
    expect(normalizeVocabularyKey("der   Hund")).toBe("der hund");
    expect(normalizeVocabularyKey("你好！")).toBe("你好");
    expect(normalizeVocabularyKey("مرحبا؟")).toBe("مرحبا");
    expect(normalizeVocabularyKey("Ｈａｌｌｏ")).toBe("hallo");
    expect(normalizeVocabularyKey("Straße")).not.toBe(normalizeVocabularyKey("Strasse"));
  });
});

describe("findTokenIndicesForWords", () => {
  it("locates target words in order", () => {
    const result = findTokenIndicesForWords("Ich trinke gern Kaffee.", ["trinke", "Kaffee"], "de");
    expect(result?.indices).toEqual([1, 3]);
    expect(result?.matchedWords).toEqual(["trinke", "Kaffee."]);
  });

  it("returns null when a word is missing", () => {
    expect(findTokenIndicesForWords("Ich trinke Tee", ["Kaffee"], "de")).toBeNull();
    expect(findTokenIndicesForWords("", ["x"], "de")).toBeNull();
  });

  it("compares arrays", () => {
    expect(arraysEqual([1, 2], [1, 2])).toBe(true);
    expect(arraysEqual([1, 2], [2, 1])).toBe(false);
  });
});
