import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TutorChat } from "@/components/chat/tutor-chat";
import { isCurriculumUnitId } from "@/lib/curriculum";
import { getLanguageConfig, isSupportedLanguageCode, resolveLanguageCode } from "@/lib/language-config";
import { firstParam, requireLearner, resolveLearnerLanguage, toQueryString } from "@/lib/tutor/page-auth";
import { isTutorScenarioId } from "@/lib/tutor/scenarios";

interface PageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const config = getLanguageConfig(decodeURIComponent(lang));
  return config
    ? { title: `${config.name} tutor · Laingfy`, description: `Practise ${config.name} conversation with a tutor that adapts to your level.` }
    : { title: "Tutor · Laingfy" };
}

export default async function TutorChatPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  const query = await searchParams;
  const requested = decodeURIComponent(lang);
  const user = await requireLearner(`/learn/${encodeURIComponent(requested)}${toQueryString(query)}`);

  if (!isSupportedLanguageCode(requested)) {
    // Old links: language names ("/learn/German") and removed modes ("/learn/chat", "/learn/visual").
    const legacyCode = resolveLanguageCode(requested);
    if (legacyCode) {
      redirect(`/learn/${legacyCode}${toQueryString(query)}`);
    }
    if (requested === "flashcards") {
      redirect(isSupportedLanguageCode(user.activeLanguage) ? `/flashcards?lang=${user.activeLanguage}` : "/flashcards");
    }
    redirect(isSupportedLanguageCode(user.activeLanguage) ? `/learn/${user.activeLanguage}` : "/dashboard");
  }

  const language = resolveLearnerLanguage(user, requested, (code) => `/learn/${code}${toQueryString(query)}`);
  const scenario = firstParam(query.scenario);
  const unit = firstParam(query.unit);

  return (
    <TutorChat
      key={language}
      language={language}
      initialScenarioId={isTutorScenarioId(scenario) ? scenario : null}
      initialUnitId={unit && isCurriculumUnitId(unit) ? unit : null}
    />
  );
}
