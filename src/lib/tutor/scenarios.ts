/**
 * Conversation starters for the chat tutor. Pure and client-safe. Scenario ids are stored in
 * chat_sessions.metadata, so never rename or reuse one.
 */

export const TUTOR_SCENARIO_IDS = [
  "free",
  "unit",
  "cafe",
  "directions",
  "hotel",
  "meeting",
  "shopping",
  "restaurant",
] as const;

export type TutorScenarioId = (typeof TUTOR_SCENARIO_IDS)[number];

export interface TutorScenario {
  id: TutorScenarioId;
  title: string;
  emoji: string;
  /** One line for the picker, written to the learner. */
  description: string;
  /** Who the tutor plays and where; null for plain tutor chat. */
  role: string | null;
  /** What the learner should try to achieve in the conversation; written for the prompt. */
  learnerGoal: string;
  /** How the tutor opens the conversation; written for the prompt. */
  opening: string;
}

export const TUTOR_SCENARIOS: readonly TutorScenario[] = [
  {
    id: "free",
    title: "Free chat",
    emoji: "💬",
    description: "Talk about anything. Your tutor keeps it at your level.",
    role: null,
    learnerGoal: "Have a relaxed, personal conversation about the learner's life, interests and day.",
    opening: "Greet the learner warmly and ask one easy, personal question to get them talking.",
  },
  {
    id: "unit",
    title: "Practice my unit",
    emoji: "🎯",
    description: "Use the words and grammar from your current lesson.",
    role: null,
    learnerGoal: "Use the current unit's vocabulary and grammar in real sentences until it feels natural.",
    opening:
      "Say in one short sentence that you'll practise the unit together, then ask a first question the learner can answer with the unit's vocabulary.",
  },
  {
    id: "cafe",
    title: "At the café",
    emoji: "☕",
    description: "Order a drink and a snack from a friendly barista.",
    role: "a friendly barista in a busy neighbourhood café",
    learnerGoal: "Order a drink and something to eat, ask about the price and pay.",
    opening: "Greet the customer as the barista and ask what they would like.",
  },
  {
    id: "directions",
    title: "Asking for directions",
    emoji: "🧭",
    description: "You're lost in town. Ask a local the way.",
    role: "a helpful local standing on a street corner in the city centre",
    learnerGoal: "Ask how to get to a place (station, museum, pharmacy), understand the directions and thank the local.",
    opening: "As the local, notice the learner looks a little lost and ask if they need help.",
  },
  {
    id: "hotel",
    title: "Hotel check-in",
    emoji: "🏨",
    description: "Check in, ask about breakfast and sort out your room.",
    role: "the receptionist at a small, friendly hotel",
    learnerGoal: "Check in with a reservation, ask about breakfast times and Wi-Fi, and solve a small problem with the room.",
    opening: "Welcome the guest at the reception desk and ask for the name on the reservation.",
  },
  {
    id: "meeting",
    title: "Meeting someone new",
    emoji: "🙋",
    description: "Small talk with a new friend at a party.",
    role: "a curious, friendly person the learner has just met at a friend's party",
    learnerGoal: "Introduce themselves, say where they are from and what they do, and ask the other person questions back.",
    opening: "Introduce yourself with your first name and ask the learner's name.",
  },
  {
    id: "shopping",
    title: "Shopping",
    emoji: "🛍️",
    description: "Find the right size and colour in a clothes shop.",
    role: "a shop assistant in a clothes shop",
    learnerGoal: "Ask for an item, a size and a colour, ask the price, and decide whether to buy it.",
    opening: "Greet the customer as the shop assistant and ask if you can help them find something.",
  },
  {
    id: "restaurant",
    title: "At the restaurant",
    emoji: "🍽️",
    description: "Order a meal and ask for the bill.",
    role: "a waiter in a cosy local restaurant",
    learnerGoal: "Ask for a table, order a starter and a main course, and ask for the bill.",
    opening: "Greet the guests as the waiter and ask how many people the table is for.",
  },
];

const BY_ID = new Map<string, TutorScenario>(TUTOR_SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function isTutorScenarioId(value: unknown): value is TutorScenarioId {
  return typeof value === "string" && BY_ID.has(value);
}

export function getTutorScenario(id: unknown): TutorScenario {
  return (typeof id === "string" && BY_ID.get(id)) || BY_ID.get("free")!;
}

/** Role-plays only (excludes free chat and unit practice), for the picker grid. */
export const ROLE_PLAY_SCENARIOS: readonly TutorScenario[] = TUTOR_SCENARIOS.filter((scenario) => scenario.role !== null);
