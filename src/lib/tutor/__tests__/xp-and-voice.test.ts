import { describe, expect, it } from "vitest";
import { getUnitById } from "../../curriculum";
import { XP_REWARDS } from "../../gamification";
import { LANGUAGES } from "../../language-config";
import { buildVoiceTutorRealtimeSession } from "../../openai-realtime";
import { buildVoiceTranscriptionPrompt, buildVoiceTutorInstructions, isVoiceMode, type VoicePromptContext } from "../voice-prompt";
import { CHAT_XP_DAILY_TURN_CAP, chatTurnXp, isMeaningfulTurn, VOICE_SESSION_MAX_MINUTES, VOICE_XP_DAILY_CAP, voiceSessionXp } from "../xp";

describe("chat XP", () => {
  it("counts real turns only", () => {
    expect(isMeaningfulTurn("Ich heiße Sam", null)).toBe(true);
    expect(isMeaningfulTurn("你好", null)).toBe(true);
    expect(isMeaningfulTurn("a", null)).toBe(false);
    expect(isMeaningfulTurn("?? !!", null)).toBe(false);
    expect(isMeaningfulTurn("Hallo", " hallo ")).toBe(false);
    expect(isMeaningfulTurn("Hallo du", "Hallo")).toBe(true);
  });

  it("awards XP per turn up to the daily cap, then nothing", () => {
    expect(chatTurnXp(0, true)).toEqual({ xp: XP_REWARDS.chatTurn, capReached: false, rewardedTurnsToday: 1 });

    const last = chatTurnXp(CHAT_XP_DAILY_TURN_CAP - 1, true);
    expect(last.xp).toBe(XP_REWARDS.chatTurn);
    expect(last.capReached).toBe(true);

    const over = chatTurnXp(CHAT_XP_DAILY_TURN_CAP, true);
    expect(over.xp).toBe(0);
    expect(over.capReached).toBe(true);
    expect(over.rewardedTurnsToday).toBe(CHAT_XP_DAILY_TURN_CAP);

    expect(chatTurnXp(3, false).xp).toBe(0);
  });

  it("caps a day's chat XP", () => {
    let total = 0;
    for (let turn = 0; turn < 100; turn += 1) total += chatTurnXp(turn, true).xp;
    expect(total).toBe(CHAT_XP_DAILY_TURN_CAP * XP_REWARDS.chatTurn);
  });
});

describe("voice XP", () => {
  const startedAt = new Date("2026-06-01T10:00:00Z");
  const after = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);

  it("uses the server-measured duration", () => {
    expect(voiceSessionXp({ startedAt, endedAt: after(300), xpAwardedToday: 0 })).toEqual({ xp: 15, seconds: 300, capReached: false });
  });

  it("lets the client lower but never raise the credited time", () => {
    expect(voiceSessionXp({ startedAt, endedAt: after(300), clientActiveSeconds: 60, xpAwardedToday: 0 }).seconds).toBe(60);
    expect(voiceSessionXp({ startedAt, endedAt: after(60), clientActiveSeconds: 6000, xpAwardedToday: 0 }).seconds).toBe(60);
    expect(voiceSessionXp({ startedAt, endedAt: after(60), clientActiveSeconds: Number.NaN, xpAwardedToday: 0 }).seconds).toBe(60);
  });

  it("caps each session and each day", () => {
    const long = voiceSessionXp({ startedAt, endedAt: after(3 * 60 * 60), xpAwardedToday: 0 });
    expect(long.seconds).toBe(VOICE_SESSION_MAX_MINUTES * 60);
    expect(long.xp).toBe(XP_REWARDS.voiceSessionMax);

    const nearCap = voiceSessionXp({ startedAt, endedAt: after(600), xpAwardedToday: VOICE_XP_DAILY_CAP - 5 });
    expect(nearCap.xp).toBe(5);
    expect(nearCap.capReached).toBe(true);
    expect(voiceSessionXp({ startedAt, endedAt: after(600), xpAwardedToday: VOICE_XP_DAILY_CAP }).xp).toBe(0);
  });

  it("never goes negative for clock skew", () => {
    expect(voiceSessionXp({ startedAt, endedAt: after(-30), xpAwardedToday: 0 })).toEqual({ xp: 0, seconds: 0, capReached: false });
  });
});

describe("voice tutor instructions", () => {
  const base: VoicePromptContext = {
    language: LANGUAGES["pt-BR"],
    level: 2,
    mode: "native",
    unit: null,
    weakWords: [],
    recentMistakes: [],
  };

  it("validates modes", () => {
    expect(isVoiceMode("native")).toBe(true);
    expect(isVoiceMode("assisted")).toBe(true);
    expect(isVoiceMode("travel")).toBe(false);
  });

  it("native mode never switches to English; assisted mode scaffolds in English", () => {
    const native = buildVoiceTutorInstructions(base);
    expect(native).toContain("Speak ONLY Portuguese (Brazilian)");
    expect(native).toContain("Never switch to English");

    const assisted = buildVoiceTutorInstructions({ ...base, mode: "assisted" });
    expect(assisted).toContain("English support");
    expect(assisted).toContain("briefly give the English meaning");
    expect(buildVoiceTutorInstructions({ ...base, mode: "assisted", level: 7 })).not.toContain("briefly give the English meaning");
  });

  it("reflects level, unit, weak words and mistakes", () => {
    const instructions = buildVoiceTutorInstructions({
      ...base,
      level: 3,
      unit: getUnitById("l3-directions"),
      weakWords: [{ word: "esquerda", translation: "left" }],
      recentMistakes: [{ incorrect: "eu vai", correction: "eu vou", explanation: null }],
    });
    expect(instructions).toContain("Level 3/10");
    expect(instructions).toContain("Finding the Way");
    expect(instructions).toContain("esquerda (left)");
    expect(instructions).toContain('"eu vai" → "eu vou"');
    expect(instructions).toContain("connected to the current unit");
  });

  it("builds a realtime session with the language's transcription hint", () => {
    const session = buildVoiceTutorRealtimeSession({
      languageCode: "pt-BR",
      instructions: "x",
      transcriptionPrompt: buildVoiceTranscriptionPrompt("Portuguese (Brazilian)", "native"),
    });
    expect(session.model).toBe("gpt-realtime-2.1");
    expect(session.audio.input.transcription).toEqual({
      model: "gpt-live-transcribe",
      languages: ["pt"],
      prompt: buildVoiceTranscriptionPrompt("Portuguese (Brazilian)", "native"),
    });
    expect(session.output_modalities).toEqual(["audio"]);
    expect(session.audio.input.turn_detection.create_response).toBe(true);
    expect(session.instructions).toBe("x");
  });
});
