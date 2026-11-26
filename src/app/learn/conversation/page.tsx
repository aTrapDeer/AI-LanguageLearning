import type { Metadata } from "next";
import { VoiceModePicker } from "@/components/voice/voice-mode-picker";
import { isCurriculumUnitId } from "@/lib/curriculum";
import { getLanguageConfig } from "@/lib/language-config";
import { firstParam, requireLearner, resolveLearnerLanguage, toQueryString } from "@/lib/tutor/page-auth";

export const metadata: Metadata = { title: "Voice conversation · Laingfy" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConversationModePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const user = await requireLearner(`/learn/conversation${toQueryString(query)}`);
  const language = resolveLearnerLanguage(user, firstParam(query.lang), (code) => `/learn/conversation?lang=${code}`);
  const unit = firstParam(query.unit);

  return <VoiceModePicker language={getLanguageConfig(language)!} unitId={unit && isCurriculumUnitId(unit) ? unit : null} />;
}
