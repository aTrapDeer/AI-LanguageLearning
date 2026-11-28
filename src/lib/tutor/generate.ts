import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { generateJson, type JsonChatClient } from "@/lib/openai";
import { buildHistoryMessages, buildOpeningInstruction, buildTutorSystemPrompt, type HistoryEntry, type TutorPromptContext } from "./prompt";
import { normalizeTutorReply, TutorReplyFormatSchema, TutorReplySchema, type TutorReply } from "./schema";

/**
 * One tutor turn. With an empty history the tutor opens the conversation for the scenario;
 * otherwise the last history entry is the learner's new message.
 */
export async function generateTutorReply(options: {
  context: TutorPromptContext;
  history: HistoryEntry[];
  client?: JsonChatClient;
}): Promise<TutorReply> {
  const history = buildHistoryMessages(options.history);
  const messages: ChatCompletionMessageParam[] =
    history.length === 0
      ? [{ role: "user", content: buildOpeningInstruction(options.context.scenario) }]
      : history.map((entry) => ({ role: entry.role, content: entry.content }));

  const reply = await generateJson({
    schema: TutorReplySchema,
    formatSchema: TutorReplyFormatSchema,
    schemaName: "tutor_reply",
    system: buildTutorSystemPrompt(options.context),
    user: messages,
    temperature: 0.7,
    maxTokens: 900,
    client: options.client,
  });

  return normalizeTutorReply(reply, { needsRomanization: options.context.language.needsRomanization });
}
