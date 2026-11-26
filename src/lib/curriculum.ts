/**
 * Language-agnostic learning path. Each level (1–10) has an ordered list of units; lesson content is
 * generated per (language, unit) and pooled, so unit ids are persisted and MUST stay stable.
 * Add units by appending; never rename or reuse an id.
 */

import { clampLevel, MAX_LEVEL, MIN_LEVEL } from "./levels";

export interface CurriculumUnit {
  /** Stable id, e.g. "l1-greetings". Stored in lessons/lesson_attempts. */
  id: string;
  level: number;
  /** 1-based position within the level. */
  order: number;
  title: string;
  emoji: string;
  /** Can-do statement the unit builds towards. */
  goal: string;
  vocabularyDomain: string;
  grammarFocus: string;
}

type UnitSeed = Omit<CurriculumUnit, "level" | "order">;

const LEVEL_UNITS: Record<number, UnitSeed[]> = {
  1: [
    { id: "l1-greetings", title: "Hello & Goodbye", emoji: "👋", goal: "I can greet people and say goodbye politely.", vocabularyDomain: "greetings, farewells, please, thank you, sorry", grammarFocus: "fixed expressions; formal vs. informal greetings" },
    { id: "l1-introductions", title: "Nice to Meet You", emoji: "🙋", goal: "I can say my name and where I am from.", vocabularyDomain: "names, countries, nationalities", grammarFocus: "the verb 'to be' / identity sentences; personal pronouns" },
    { id: "l1-numbers", title: "Numbers 0–20", emoji: "🔢", goal: "I can count, give my age and say a phone number.", vocabularyDomain: "numbers 0–20, age", grammarFocus: "number words; 'I am … years old'" },
    { id: "l1-yes-no", title: "Yes, No & Questions", emoji: "❓", goal: "I can answer yes/no questions and ask very simple ones.", vocabularyDomain: "yes, no, maybe, question words (what, who)", grammarFocus: "yes/no question formation; negation basics" },
    { id: "l1-cafe", title: "At the Café", emoji: "☕", goal: "I can order a drink and a snack.", vocabularyDomain: "drinks, snacks, I would like", grammarFocus: "polite requests; indefinite articles or counters" },
    { id: "l1-colors-things", title: "Colours & Things", emoji: "🎨", goal: "I can name everyday objects and their colours.", vocabularyDomain: "colours, classroom and household objects", grammarFocus: "noun + adjective order; 'this is …'" },
  ],
  2: [
    { id: "l2-family", title: "My Family", emoji: "👨‍👩‍👧", goal: "I can introduce my family members.", vocabularyDomain: "family members, pets", grammarFocus: "possessives (my, your); plurals" },
    { id: "l2-daily-routine", title: "My Day", emoji: "⏰", goal: "I can describe what I do every day.", vocabularyDomain: "daily activities, times of day", grammarFocus: "present tense of common verbs; telling the time" },
    { id: "l2-food", title: "Food I Like", emoji: "🍎", goal: "I can say what I like and don't like to eat.", vocabularyDomain: "fruit, vegetables, meals", grammarFocus: "like / don't like; negation" },
    { id: "l2-home", title: "Home Sweet Home", emoji: "🏠", goal: "I can describe the rooms and furniture in my home.", vocabularyDomain: "rooms, furniture", grammarFocus: "there is / there are; basic prepositions of place" },
    { id: "l2-numbers-prices", title: "Numbers & Prices", emoji: "💰", goal: "I can understand and ask for prices.", vocabularyDomain: "numbers to 100, money, how much", grammarFocus: "how much / how many; quantities" },
    { id: "l2-weekdays", title: "Days & Weather", emoji: "📅", goal: "I can talk about the days of the week and the weather today.", vocabularyDomain: "weekdays, months, weather", grammarFocus: "time expressions; impersonal weather sentences" },
  ],
  3: [
    { id: "l3-shopping", title: "Going Shopping", emoji: "🛍️", goal: "I can buy clothes and ask for a size or colour.", vocabularyDomain: "clothes, sizes, shops", grammarFocus: "demonstratives (this/that); adjective agreement" },
    { id: "l3-directions", title: "Finding the Way", emoji: "🧭", goal: "I can ask for and follow simple directions.", vocabularyDomain: "places in town, left/right/straight", grammarFocus: "imperatives; prepositions of movement" },
    { id: "l3-restaurant", title: "At the Restaurant", emoji: "🍽️", goal: "I can order a meal and ask for the bill.", vocabularyDomain: "menu items, cutlery, ordering", grammarFocus: "polite conditional requests (I would like); object pronouns" },
    { id: "l3-hobbies", title: "Free Time", emoji: "⚽", goal: "I can talk about my hobbies and how often I do them.", vocabularyDomain: "sports, hobbies, frequency words", grammarFocus: "adverbs of frequency; verb + infinitive" },
    { id: "l3-past-weekend", title: "Last Weekend", emoji: "📸", goal: "I can say what I did last weekend.", vocabularyDomain: "weekend activities, past time markers", grammarFocus: "first past tense forms of common verbs" },
    { id: "l3-transport", title: "Getting Around", emoji: "🚌", goal: "I can buy a ticket and ask about departure times.", vocabularyDomain: "transport, tickets, stations", grammarFocus: "question words (when, where, how); times and schedules" },
  ],
  4: [
    { id: "l4-travel-plans", title: "Travel Plans", emoji: "✈️", goal: "I can describe where I'm going and what I'll do.", vocabularyDomain: "trips, luggage, accommodation", grammarFocus: "future forms; intentions" },
    { id: "l4-hotel", title: "At the Hotel", emoji: "🏨", goal: "I can check in and solve a simple problem with my room.", vocabularyDomain: "hotel, reservations, problems", grammarFocus: "modal verbs (can, must, need to)" },
    { id: "l4-health", title: "At the Doctor", emoji: "🩺", goal: "I can say how I feel and describe simple symptoms.", vocabularyDomain: "body parts, symptoms, pharmacy", grammarFocus: "expressing pain and duration; reflexive or experiencer constructions" },
    { id: "l4-describing-people", title: "Describing People", emoji: "🧑‍🤝‍🧑", goal: "I can describe someone's appearance and personality.", vocabularyDomain: "appearance, personality adjectives", grammarFocus: "comparatives; adjective position" },
    { id: "l4-past-stories", title: "When I Was Young", emoji: "🧸", goal: "I can tell a short story about my childhood.", vocabularyDomain: "childhood, school, memories", grammarFocus: "past habitual vs. completed past; sequencing words" },
    { id: "l4-invitations", title: "Making Plans", emoji: "🎉", goal: "I can invite someone, accept or decline politely.", vocabularyDomain: "events, invitations, excuses", grammarFocus: "suggestions (let's, shall we); polite refusals" },
  ],
  5: [
    { id: "l5-work", title: "Work & Study", emoji: "💼", goal: "I can talk about my job or studies and my responsibilities.", vocabularyDomain: "professions, workplace, studies", grammarFocus: "present perfect / experience forms; duration (for, since)" },
    { id: "l5-opinions", title: "In My Opinion", emoji: "💬", goal: "I can give and justify a simple opinion.", vocabularyDomain: "opinion phrases, agreeing and disagreeing", grammarFocus: "subordinate clauses with 'that' and 'because'" },
    { id: "l5-experiences", title: "Have You Ever…?", emoji: "🌍", goal: "I can talk about experiences and memorable events.", vocabularyDomain: "travel experiences, feelings", grammarFocus: "contrasting past tenses; time clauses" },
    { id: "l5-environment", title: "Nature & Environment", emoji: "🌱", goal: "I can describe landscapes and talk about simple environmental issues.", vocabularyDomain: "nature, weather, recycling", grammarFocus: "superlatives; quantifiers" },
    { id: "l5-media", title: "Films & Books", emoji: "🎬", goal: "I can recommend a film or book and say why.", vocabularyDomain: "genres, plot, recommendations", grammarFocus: "relative clauses (who, which, that)" },
    { id: "l5-problems", title: "Solving Problems", emoji: "🛠️", goal: "I can explain a problem and ask for help or a refund.", vocabularyDomain: "complaints, services, repairs", grammarFocus: "indirect questions; polite complaints" },
  ],
  6: [
    { id: "l6-hypotheticals", title: "What Would You Do?", emoji: "🤔", goal: "I can talk about hypothetical situations and wishes.", vocabularyDomain: "dreams, choices, wishes", grammarFocus: "conditional sentences (if … would)" },
    { id: "l6-news", title: "In the News", emoji: "📰", goal: "I can summarise a simple news story.", vocabularyDomain: "news, events, reporting verbs", grammarFocus: "reported speech basics" },
    { id: "l6-culture", title: "Traditions & Festivals", emoji: "🏮", goal: "I can describe traditions and compare them with my own culture.", vocabularyDomain: "holidays, customs, celebrations", grammarFocus: "passive voice in descriptions; comparisons" },
    { id: "l6-technology", title: "Digital Life", emoji: "📱", goal: "I can discuss how I use technology and its pros and cons.", vocabularyDomain: "devices, apps, internet", grammarFocus: "connectors of contrast (however, although)" },
    { id: "l6-relationships", title: "Friends & Relationships", emoji: "❤️", goal: "I can talk about relationships and give advice.", vocabularyDomain: "friendship, feelings, advice", grammarFocus: "giving advice (should, if I were you); emotional expressions" },
    { id: "l6-storytelling", title: "Telling a Story", emoji: "📖", goal: "I can narrate a story with a beginning, middle and end.", vocabularyDomain: "narrative phrases, sequence markers", grammarFocus: "past perfect / sequencing tenses; time connectors" },
  ],
  7: [
    { id: "l7-debate", title: "Pros & Cons", emoji: "⚖️", goal: "I can weigh up advantages and disadvantages of an issue.", vocabularyDomain: "argument language, society", grammarFocus: "concessive clauses; discourse markers" },
    { id: "l7-workplace", title: "Professional Communication", emoji: "📧", goal: "I can write a formal email and take part in a meeting.", vocabularyDomain: "business, meetings, formal phrases", grammarFocus: "formal register; polite indirectness" },
    { id: "l7-society", title: "Society & Change", emoji: "🏙️", goal: "I can discuss social trends and their causes.", vocabularyDomain: "urban life, demographics, change", grammarFocus: "cause and effect structures; passive with modals" },
    { id: "l7-science", title: "Science & Discovery", emoji: "🔬", goal: "I can explain a scientific idea or invention in simple terms.", vocabularyDomain: "science, research, inventions", grammarFocus: "nominalisation; defining relative clauses" },
    { id: "l7-idioms", title: "Everyday Idioms", emoji: "🗝️", goal: "I can understand and use common idiomatic expressions.", vocabularyDomain: "idioms, colloquial phrases", grammarFocus: "fixed expressions and collocations" },
    { id: "l7-regrets", title: "Regrets & Alternatives", emoji: "🔁", goal: "I can talk about past regrets and alternative outcomes.", vocabularyDomain: "decisions, consequences", grammarFocus: "past conditionals (if I had …)" },
  ],
  8: [
    { id: "l8-persuasion", title: "Persuade Me", emoji: "📣", goal: "I can build a persuasive argument and respond to counter-arguments.", vocabularyDomain: "persuasion, rhetoric", grammarFocus: "emphasis and cleft structures; hedging" },
    { id: "l8-economy", title: "Money & Economy", emoji: "📈", goal: "I can discuss economic topics and personal finance.", vocabularyDomain: "economy, finance, consumption", grammarFocus: "complex noun phrases; quantifying trends" },
    { id: "l8-arts", title: "Arts & Criticism", emoji: "🖼️", goal: "I can review a work of art, music or literature.", vocabularyDomain: "art, criticism, aesthetics", grammarFocus: "evaluative adjectives; participle clauses" },
    { id: "l8-politics", title: "Politics & Public Life", emoji: "🏛️", goal: "I can follow and discuss political debates neutrally.", vocabularyDomain: "government, elections, policy", grammarFocus: "reporting verbs; impersonal constructions" },
    { id: "l8-health-wellbeing", title: "Health & Wellbeing", emoji: "🧘", goal: "I can discuss lifestyle, health research and mental wellbeing.", vocabularyDomain: "wellbeing, medicine, research findings", grammarFocus: "expressing probability and certainty" },
    { id: "l8-register", title: "Formal vs. Informal", emoji: "🎭", goal: "I can switch register appropriately for the situation.", vocabularyDomain: "slang vs. formal equivalents", grammarFocus: "register shifts; politeness strategies" },
  ],
  9: [
    { id: "l9-ethics", title: "Ethical Dilemmas", emoji: "🧠", goal: "I can argue a position on an ethical dilemma with nuance.", vocabularyDomain: "ethics, values, responsibility", grammarFocus: "subjunctive or irrealis forms where the language has them; nuanced modality" },
    { id: "l9-academic", title: "Academic Language", emoji: "🎓", goal: "I can present and critique an argument in academic style.", vocabularyDomain: "academic vocabulary, citation phrases", grammarFocus: "complex subordination; impersonal academic style" },
    { id: "l9-humor", title: "Humour & Wordplay", emoji: "😄", goal: "I can understand jokes, irony and wordplay.", vocabularyDomain: "humour, irony, puns", grammarFocus: "ambiguity and double meanings" },
    { id: "l9-history", title: "History & Memory", emoji: "📜", goal: "I can discuss historical events and how they are remembered.", vocabularyDomain: "history, heritage, memory", grammarFocus: "narrative tenses in formal writing" },
    { id: "l9-negotiation", title: "Negotiation", emoji: "🤝", goal: "I can negotiate, compromise and close a deal.", vocabularyDomain: "negotiation, conditions, concessions", grammarFocus: "conditional offers; diplomatic softening" },
    { id: "l9-media-literacy", title: "Reading Between the Lines", emoji: "🔍", goal: "I can identify bias and implicit meaning in media.", vocabularyDomain: "media, bias, persuasion techniques", grammarFocus: "inference, implicature and evaluative language" },
  ],
  10: [
    { id: "l10-literature", title: "Literature", emoji: "📚", goal: "I can analyse a literary passage and its style.", vocabularyDomain: "literary devices, style", grammarFocus: "literary and archaic forms" },
    { id: "l10-philosophy", title: "Big Ideas", emoji: "🌌", goal: "I can discuss abstract philosophical questions fluently.", vocabularyDomain: "philosophy, abstraction", grammarFocus: "abstract nominal style; complex argument chains" },
    { id: "l10-regional", title: "Dialects & Regions", emoji: "🗺️", goal: "I can recognise regional variants and colloquialisms.", vocabularyDomain: "regional vocabulary, dialect features", grammarFocus: "regional grammatical variation" },
    { id: "l10-specialist", title: "Specialist Fields", emoji: "⚙️", goal: "I can handle specialist discussions in law, medicine or tech.", vocabularyDomain: "legal, medical and technical terms", grammarFocus: "precision and technical register" },
    { id: "l10-rhetoric", title: "Speeches & Rhetoric", emoji: "🎤", goal: "I can deliver and analyse a compelling speech.", vocabularyDomain: "rhetorical devices, public speaking", grammarFocus: "parallelism, inversion and emphasis" },
    { id: "l10-culture-deep", title: "Culture in Depth", emoji: "🏺", goal: "I can discuss cultural references, proverbs and subtext like a native.", vocabularyDomain: "proverbs, cultural references, allusions", grammarFocus: "idiomatic and figurative mastery" },
  ],
};

export const CURRICULUM: readonly CurriculumUnit[] = Object.entries(LEVEL_UNITS).flatMap(([level, units]) =>
  units.map((unit, index) => ({ ...unit, level: Number(level), order: index + 1 }))
);

const UNIT_BY_ID = new Map(CURRICULUM.map((unit) => [unit.id, unit]));

export function getUnitsForLevel(level: number): CurriculumUnit[] {
  const normalized = clampLevel(level);
  return CURRICULUM.filter((unit) => unit.level === normalized);
}

export function getUnitById(unitId: string): CurriculumUnit | null {
  return UNIT_BY_ID.get(unitId) ?? null;
}

export function isCurriculumUnitId(value: unknown): value is string {
  return typeof value === "string" && UNIT_BY_ID.has(value);
}

function toSet(ids: Iterable<string>) {
  return ids instanceof Set ? (ids as Set<string>) : new Set(ids);
}

/** First unit of `level` that is not in `completedUnitIds`, or null when the level is finished. */
export function getNextUnit(level: number, completedUnitIds: Iterable<string>): CurriculumUnit | null {
  const completed = toSet(completedUnitIds);
  return getUnitsForLevel(level).find((unit) => !completed.has(unit.id)) ?? null;
}

export function isLevelComplete(level: number, completedUnitIds: Iterable<string>): boolean {
  return getNextUnit(level, completedUnitIds) === null;
}

/** A unit is unlocked when it is the first of its level or the previous unit is completed. */
export function isUnitUnlocked(unitId: string, completedUnitIds: Iterable<string>): boolean {
  const unit = getUnitById(unitId);
  if (!unit) {
    return false;
  }

  if (unit.order === 1) {
    return true;
  }

  const previous = getUnitsForLevel(unit.level)[unit.order - 2];
  return previous ? toSet(completedUnitIds).has(previous.id) : true;
}

export function describeUnitForPrompt(unit: CurriculumUnit): string {
  return [
    `Unit "${unit.title}" (level ${unit.level}, unit ${unit.order}).`,
    `Learning goal: ${unit.goal}`,
    `Vocabulary domain: ${unit.vocabularyDomain}.`,
    `Grammar focus: ${unit.grammarFocus}.`,
  ].join("\n");
}

export const CURRICULUM_LEVELS: readonly number[] = Array.from(
  { length: MAX_LEVEL - MIN_LEVEL + 1 },
  (_, index) => MIN_LEVEL + index
);
