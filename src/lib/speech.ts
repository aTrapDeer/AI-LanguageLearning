/**
 * Voice selection for the browser `speechSynthesis` API. Pure so it can be unit-tested; the React
 * side lives in `@/hooks/use-speech`.
 */

import type { LanguageConfig } from "./language-config";

export interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
  default?: boolean;
}

function normalizeLang(lang: string) {
  return lang.replace(/_/g, "-").toLowerCase();
}

/**
 * Best voice for a language: exact locale first, then any voice whose language matches one of the
 * configured prefixes; within a tier prefer local (offline, low-latency) voices. Null when none match,
 * in which case speech should be hidden rather than read in the wrong accent.
 */
export function pickVoice<T extends VoiceLike>(
  voices: readonly T[],
  config: Pick<LanguageConfig, "speechLocale" | "voiceLanguagePrefixes">
): T | null {
  const exact = normalizeLang(config.speechLocale);
  const base = exact.split("-")[0];
  const prefixes = config.voiceLanguagePrefixes.map(normalizeLang);

  const score = (voice: T) => {
    const lang = normalizeLang(voice.lang);
    let tier = -1;
    if (lang === exact) {
      tier = 3;
    } else {
      const index = prefixes.findIndex((prefix) => lang === prefix || lang.startsWith(`${prefix}-`));
      if (index !== -1) {
        tier = 2 - Math.min(index, 1);
      } else if (lang === base) {
        tier = 1;
      }
    }

    if (tier < 0) {
      return -1;
    }

    return tier * 10 + (voice.localService ? 2 : 0) + (voice.default ? 1 : 0);
  };

  let best: T | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const value = score(voice);
    if (value > bestScore) {
      best = voice;
      bestScore = value;
    }
  }

  return best;
}
