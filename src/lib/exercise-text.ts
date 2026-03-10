function getSegmenterLocale(language?: string) {
  switch (language) {
    case "zh":
      return "zh-CN";
    case "ja":
      return "ja-JP";
    case "ko":
      return "ko-KR";
    case "ar":
      return "ar";
    default:
      return language;
  }
}

function isPunctuationOnly(value: string) {
  return !/[A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(value);
}

function cleanToken(token: string) {
  return token.trim();
}

export function normalizeTokenForComparison(token: string) {
  const cleaned = token.replace(/^[\s"'`“”‘’.,!?;:()[\]{}<>/\\|+=*_~-]+|[\s"'`“”‘’.,!?;:()[\]{}<>/\\|+=*_~-]+$/g, "").trim();
  return cleaned.length > 0 ? cleaned.toLocaleLowerCase() : token.trim().toLocaleLowerCase();
}

export function tokenizeExerciseText(text: string, language?: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [] as string[];
  }

  if (/\s/.test(normalized)) {
    return normalized.split(" ").map(cleanToken).filter(Boolean);
  }

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter(getSegmenterLocale(language), { granularity: "word" });
    const mergedTokens: string[] = [];

    const segments = Array.from(segmenter.segment(normalized));
    for (const segment of segments) {
      const token = cleanToken(segment.segment);
      if (!token) {
        continue;
      }

      if (isPunctuationOnly(token) && mergedTokens.length > 0) {
        mergedTokens[mergedTokens.length - 1] += token;
      } else {
        mergedTokens.push(token);
      }
    }

    if (mergedTokens.length > 0) {
      return mergedTokens;
    }
  }

  return Array.from(normalized);
}

export function joinExerciseTokens(tokens: string[], language?: string) {
  if (language === "zh" || language === "ja") {
    return tokens.join("");
  }

  return tokens.join(" ");
}

export function arraysEqual<T>(left: T[], right: T[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function findTokenIndicesForWords(sentence: string, targetWords: string[], language?: string) {
  const sentenceTokens = tokenizeExerciseText(sentence, language);
  if (sentenceTokens.length === 0 || targetWords.length === 0) {
    return null;
  }

  const usedIndices = new Set<number>();
  const indices: number[] = [];
  let cursor = 0;

  for (const targetWord of targetWords) {
    const normalizedTarget = normalizeTokenForComparison(targetWord);
    let foundIndex = -1;

    for (let i = cursor; i < sentenceTokens.length; i += 1) {
      if (usedIndices.has(i)) {
        continue;
      }

      if (normalizeTokenForComparison(sentenceTokens[i]) === normalizedTarget) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex === -1) {
      for (let i = 0; i < sentenceTokens.length; i += 1) {
        if (usedIndices.has(i)) {
          continue;
        }

        if (normalizeTokenForComparison(sentenceTokens[i]) === normalizedTarget) {
          foundIndex = i;
          break;
        }
      }
    }

    if (foundIndex === -1) {
      return null;
    }

    usedIndices.add(foundIndex);
    indices.push(foundIndex);
    cursor = foundIndex + 1;
  }

  return {
    tokens: sentenceTokens,
    indices,
    matchedWords: indices.map((index) => sentenceTokens[index]),
  };
}
