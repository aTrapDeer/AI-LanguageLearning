"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LessonPlayer, PathView } from "@/components/lesson";
import { isCurriculumUnitId } from "@/lib/curriculum";
import { resolveLanguageCode } from "@/lib/language-config";

/**
 * /learn/journey?lang=<code>[&unit=<unitId>]: the path for a language, or straight into a unit's lesson.
 * An unknown language never falls back to another one silently: the learner is sent to their active
 * language (or the dashboard).
 */
export function JourneyRoute() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawLang = searchParams.get("lang");
  const rawUnit = searchParams.get("unit");
  const language = resolveLanguageCode(rawLang);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      const query = searchParams.toString();
      router.replace(`/login?callbackUrl=${encodeURIComponent(`${pathname}${query ? `?${query}` : ""}`)}`);
    }
  }, [pathname, router, searchParams, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    if (language && rawLang !== language) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("lang", language);
      router.replace(`/learn/journey?${params.toString()}`);
      return;
    }

    if (!language) {
      let cancelled = false;
      fetch("/api/user/active-language", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { activeLanguage?: string } | null) => {
          if (cancelled) return;
          const active = resolveLanguageCode(data?.activeLanguage);
          router.replace(active ? `/learn/journey?lang=${encodeURIComponent(active)}` : "/dashboard");
        })
        .catch(() => {
          if (!cancelled) router.replace("/dashboard");
        });
      return () => {
        cancelled = true;
      };
    }

    if (rawUnit && !isCurriculumUnitId(rawUnit)) {
      setNotice("We couldn't find that unit, so here's your path.");
      router.replace(`/learn/journey?lang=${encodeURIComponent(language)}`);
    }
  }, [language, rawLang, rawUnit, router, searchParams, status]);

  if (status !== "authenticated" || !language || rawLang !== language) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (rawUnit && isCurriculumUnitId(rawUnit)) {
    return <LessonPlayer key={`${language}:${rawUnit}`} language={language} unitId={rawUnit} />;
  }

  return <PathView language={language} notice={notice} />;
}
