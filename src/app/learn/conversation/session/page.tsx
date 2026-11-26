import type { Metadata } from "next";
import { VoiceSession } from "@/components/voice/voice-session";
import { isCurriculumUnitId } from "@/lib/curriculum";
import { firstParam, requireLearner, resolveLearnerLanguage, toQueryString } from "@/lib/tutor/page-auth";
import { isVoiceMode } from "@/lib/tutor/voice-prompt";

export const metadata: Metadata = { title: "Voice practice · Laingfy" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConversationSessionPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const user = await requireLearner(`/learn/conversation/session${toQueryString(query)}`);
  const mode = firstParam(query.mode);
  const unit = firstParam(query.unit);
  const language = resolveLearnerLanguage(user, firstParam(query.lang), (code) => `/learn/conversation/session?lang=${code}${mode ? `&mode=${mode}` : ""}`);

  return (
    <VoiceSession
      key={`${language}-${mode}`}
      language={language}
      mode={isVoiceMode(mode) ? mode : "native"}
      unitId={unit && isCurriculumUnitId(unit) ? unit : null}
    />
  );
}
