"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useRequireAccount } from "@/components/dashboard/use-require-account";
import { BrandBackground } from "@/components/learn";
import { ReviewExperience } from "@/components/review";
import { useLanguage } from "@/contexts/language-context";
import { isSupportedLanguageCode } from "@/lib/language-config";

function Loading() {
  return (
    <div className="relative isolate flex min-h-[100dvh] items-center justify-center text-white">
      <BrandBackground className="-z-10 fixed" />
      <Loader2 aria-label="Loading" className="h-8 w-8 animate-spin" />
    </div>
  );
}

function ReviewPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedLanguage } = useLanguage();
  const ready = useRequireAccount("/flashcards");

  const langParam = searchParams.get("lang");
  const language = isSupportedLanguageCode(langParam) ? langParam : null;
  const fallback = selectedLanguage?.code ?? null;
  const initialTab = searchParams.get("tab") === "words" ? "words" : "review";

  useEffect(() => {
    if (!language && fallback) {
      router.replace(`/flashcards?lang=${encodeURIComponent(fallback)}`);
    }
  }, [language, fallback, router]);

  if (!ready || !language) {
    return <Loading />;
  }

  return <ReviewExperience key={language} language={language} initialTab={initialTab} />;
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ReviewPageContent />
    </Suspense>
  );
}
