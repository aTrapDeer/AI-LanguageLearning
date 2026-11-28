import { zodResponseFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import { getUnitById } from "../../curriculum";
import { MISTAKE_KINDS } from "../../db/mistakes";
import { LANGUAGES } from "../../language-config";
import type { JsonChatClient } from "../../openai";
import { generateTutorReply } from "../generate";
import { buildHistoryMessages, buildTutorSystemPrompt, describeReplyStyle, HISTORY_MESSAGE_LIMIT, type TutorPromptContext } from "../prompt";
import { getTutorScenario, isTutorScenarioId, ROLE_PLAY_SCENARIOS, TUTOR_SCENARIO_IDS, TUTOR_SCENARIOS } from "../scenarios";
import {
  normalizeTutorReply,
  readTutorPayload,
  TUTOR_MISTAKE_KINDS,
  TutorReplyFormatSchema,
  TutorReplySchema,
  type TutorReply,
} from "../schema";

const validReply: TutorReply = {
  reply: "Hallo! Wie heißt du?",
  romanization: null,
  translation: "Hi! What's your name?",
  tip: "Answer with: Ich heiße …",
  praise: null,
  corrections: [],
  suggestions: [{ text: "Ich heiße Sam.", translation: "My name is Sam.", romanization: null }],
  vocabulary: [{ word: "heißen", translation: "to be called", romanization: null }],
};

function context(overrides: Partial<TutorPromptContext> = {}): TutorPromptContext {
  return {
    language: LANGUAGES.de,
    level: 1,
    scenario: getTutorScenario("free"),
    unit: null,
    weakWords: [],
    recentWords: [],
    recentMistakes: [],
    ...overrides,
  };
}

describe("scenarios", () => {
  it("has unique, stable ids with complete copy", () => {
    expect(new Set(TUTOR_SCENARIOS.map((scenario) => scenario.id)).size).toBe(TUTOR_SCENARIOS.length);
    expect(TUTOR_SCENARIOS.map((scenario) => scenario.id)).toEqual([...TUTOR_SCENARIO_IDS]);
    for (const scenario of TUTOR_SCENARIOS) {
      expect(scenario.title && scenario.description && scenario.learnerGoal && scenario.opening && scenario.emoji).toBeTruthy();
    }
  });

  it("includes free chat, unit practice and at least five role-plays", () => {
    expect(isTutorScenarioId("free")).toBe(true);
    expect(isTutorScenarioId("unit")).toBe(true);
    expect(ROLE_PLAY_SCENARIOS.length).toBeGreaterThanOrEqual(5);
    expect(ROLE_PLAY_SCENARIOS.every((scenario) => scenario.role)).toBe(true);
    expect(ROLE_PLAY_SCENARIOS.map((scenario) => scenario.id)).toEqual(expect.arrayContaining(["cafe", "directions", "hotel", "meeting", "shopping"]));
  });

  it("falls back to free chat for unknown ids", () => {
    expect(isTutorScenarioId("karaoke")).toBe(false);
    expect(getTutorScenario("karaoke").id).toBe("free");
    expect(getTutorScenario(undefined).id).toBe("free");
  });
});

describe("tutor reply schema", () => {
  it("keeps mistake kinds in sync with the database", () => {
    expect([...TUTOR_MISTAKE_KINDS]).toEqual([...MISTAKE_KINDS]);
  });

  it("is strict structured-output compatible", () => {
    const format = zodResponseFormat(TutorReplyFormatSchema, "tutor_reply");
    const schema = format.json_schema.schema as { required: string[]; properties: Record<string, unknown> };
    expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
    expect(JSON.stringify(schema)).not.toContain("minLength");
    expect(JSON.stringify(schema)).not.toContain("$ref");
  });

  it("validates the same shape it asks the API for", () => {
    expect(TutorReplyFormatSchema.safeParse(validReply).success).toBe(true);
    // Blank text passes the wire shape but not local validation, which is what triggers the retry.
    expect(TutorReplyFormatSchema.safeParse({ ...validReply, reply: "   " }).success).toBe(true);
    expect(Object.keys(TutorReplyFormatSchema.shape)).toEqual(Object.keys(TutorReplySchema.shape));
  });

  it("rejects empty replies and unknown correction kinds", () => {
    expect(TutorReplySchema.safeParse(validReply).success).toBe(true);
    expect(TutorReplySchema.safeParse({ ...validReply, reply: "   " }).success).toBe(false);
    expect(
      TutorReplySchema.safeParse({
        ...validReply,
        corrections: [{ original: "a", corrected: "b", explanation: "c", kind: "style" }],
      }).success
    ).toBe(false);
  });

  it("normalises: caps lists, drops no-op corrections and duplicate words, strips Latin-script romanization", () => {
    const messy: TutorReply = {
      ...validReply,
      romanization: "Hallo",
      praise: "Great!",
      corrections: [
        { original: "ich bin Sam", corrected: "Ich bin Sam", explanation: "capital", kind: "spelling" },
        { original: "Ich heiße ist Sam", corrected: "Ich heiße Sam", explanation: "one verb", kind: "grammar" },
        { original: "a", corrected: "b", explanation: "x", kind: "grammar" },
        { original: "c", corrected: "d", explanation: "y", kind: "grammar" },
      ],
      suggestions: Array.from({ length: 5 }, (_, index) => ({ text: `S${index}`, translation: `T${index}`, romanization: "r" })),
      vocabulary: [
        { word: "Haus", translation: "house", romanization: "x" },
        { word: "haus", translation: "house", romanization: null },
        { word: "Auto", translation: "car", romanization: null },
        { word: "Baum", translation: "tree", romanization: null },
        { word: "Tisch", translation: "table", romanization: null },
      ],
    };

    const normalized = normalizeTutorReply(messy, { needsRomanization: false });
    expect(normalized.romanization).toBeNull();
    expect(normalized.corrections.map((correction) => correction.original)).toEqual(["Ich heiße ist Sam", "a"]);
    expect(normalized.praise).toBeNull();
    expect(normalized.suggestions).toHaveLength(3);
    expect(normalized.suggestions.every((suggestion) => suggestion.romanization === null)).toBe(true);
    expect(normalized.vocabulary.map((item) => item.word)).toEqual(["Haus", "Auto", "Baum"]);
  });

  it("keeps romanization for non-Latin scripts and praise when there is nothing to correct", () => {
    const normalized = normalizeTutorReply(
      { ...validReply, reply: "你好！", romanization: " nǐ hǎo ", praise: "Perfect!", tip: "  " },
      { needsRomanization: true }
    );
    expect(normalized.romanization).toBe("nǐ hǎo");
    expect(normalized.praise).toBe("Perfect!");
    expect(normalized.tip).toBeNull();
  });

  it("reads stored payloads defensively", () => {
    expect(readTutorPayload(validReply)?.reply).toBe(validReply.reply);
    expect(readTutorPayload({ reply: "old format" })).toBeNull();
    expect(readTutorPayload(null)).toBeNull();
  });
});

describe("tutor system prompt", () => {
  it("adapts sentence length and English support to the level", () => {
    expect(describeReplyStyle(1)).toContain("very short");
    expect(describeReplyStyle(1)).toContain("Always give a `tip`");
    expect(describeReplyStyle(3)).not.toContain("Always give a `tip`");
    expect(describeReplyStyle(9)).toContain("native speaker");
    expect(describeReplyStyle(1)).not.toEqual(describeReplyStyle(5));
    expect(buildTutorSystemPrompt(context({ level: 1 }))).toContain("Level 1/10");
    expect(buildTutorSystemPrompt(context({ level: 9 }))).toContain("CEFR C1");
  });

  it("includes the unit, recycled words and recent mistakes", () => {
    const unit = getUnitById("l1-cafe")!;
    const prompt = buildTutorSystemPrompt(
      context({
        scenario: getTutorScenario("unit"),
        unit,
        weakWords: [{ word: "der Kaffee", translation: "the coffee" }],
        recentWords: [{ word: "bitte", translation: "please" }],
        recentMistakes: [{ incorrect: "ein Kaffee", correction: "einen Kaffee", explanation: "accusative" }],
      })
    );

    expect(prompt).toContain(unit.goal);
    expect(prompt).toContain(unit.grammarFocus);
    expect(prompt).toContain("der Kaffee = the coffee");
    expect(prompt).toContain("bitte = please");
    expect(prompt).toContain('"ein Kaffee" → "einen Kaffee" (accusative)');
  });

  it("puts the tutor in role for role-plays", () => {
    const prompt = buildTutorSystemPrompt(context({ scenario: getTutorScenario("hotel") }));
    expect(prompt).toContain("receptionist");
    expect(prompt).toContain("Stay in that role");
  });

  it("asks for romanization only where the script needs it", () => {
    expect(buildTutorSystemPrompt(context())).toContain("Set every `romanization` field to null");
    const korean = buildTutorSystemPrompt(context({ language: LANGUAGES.ko }));
    expect(korean).toContain("Revised Romanization");
    expect(buildTutorSystemPrompt(context({ language: LANGUAGES.ar }))).toContain("Arabic transliteration");
    expect(korean).toContain("ONLY in Korean");
  });

  it("omits empty sections", () => {
    const prompt = buildTutorSystemPrompt(context());
    expect(prompt).not.toContain("## Words to recycle");
    expect(prompt).not.toContain("## Recent mistakes");
  });
});

describe("history", () => {
  it("keeps the most recent messages, oldest first, without blanks", () => {
    const history = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? ("assistant" as const) : ("user" as const),
      content: index === 29 ? " last " : `m${index}`,
    }));
    history.splice(20, 0, { role: "user", content: "   " });

    const trimmed = buildHistoryMessages(history);
    expect(trimmed).toHaveLength(HISTORY_MESSAGE_LIMIT);
    expect(trimmed.at(-1)).toEqual({ role: "user", content: "last" });
    expect(trimmed.some((entry) => entry.content === "")).toBe(false);
    expect(trimmed[0].content).toBe("m14");
  });
});

describe("generateTutorReply", () => {
  function fakeClient(replies: string[]) {
    const calls: Array<{ messages: Array<{ role: string; content: unknown }> }> = [];
    const client: JsonChatClient = {
      chat: {
        completions: {
          async create(params) {
            calls.push(JSON.parse(JSON.stringify(params)));
            return { choices: [{ message: { content: replies[calls.length - 1] ?? null } }] };
          },
        },
      },
    };
    return { client, calls };
  }

  it("opens the conversation with the scenario instruction when there is no history", async () => {
    const { client, calls } = fakeClient([JSON.stringify(validReply)]);
    const reply = await generateTutorReply({ context: context({ scenario: getTutorScenario("cafe") }), history: [], client });

    expect(reply.reply).toBe(validReply.reply);
    expect(calls[0].messages).toHaveLength(2);
    expect(calls[0].messages[0].role).toBe("system");
    expect(String(calls[0].messages[1].content)).toContain("barista");
  });

  it("sends the conversation history and retries once on invalid output", async () => {
    const { client, calls } = fakeClient([JSON.stringify({ reply: "" }), JSON.stringify(validReply)]);
    const history = [
      { role: "assistant" as const, content: "Hallo! Wie heißt du?" },
      { role: "user" as const, content: "Ich heiße Sam." },
    ];

    await generateTutorReply({ context: context(), history, client });

    expect(calls).toHaveLength(2);
    expect(calls[0].messages.slice(1)).toEqual(history);
    expect(String(calls[1].messages.at(-1)?.content)).toContain("not valid");
  });
});
