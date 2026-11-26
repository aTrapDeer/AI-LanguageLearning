import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUserById, type DatabaseUser } from "@/lib/database";
import { isSupportedLanguageCode, resolveLanguageCode, type SupportedLanguageCode } from "@/lib/language-config";

/** Server pages: the signed-in, set-up learner, or a redirect to login / account setup. */
export async function requireLearner(selfUrl: string): Promise<DatabaseUser> {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await getUserById(session.user.id) : null;
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(selfUrl)}`);
  }
  if (!user.accountSetup) {
    redirect("/account-setup");
  }
  return user;
}

/**
 * The language a page should use: the requested one if the learner studies it, else their active
 * language. Redirects to add-language setup for a supported language they haven't added, and to the
 * dashboard when nothing usable is known.
 */
export function resolveLearnerLanguage(user: DatabaseUser, requested: string | null, returnTo: (code: string) => string): SupportedLanguageCode {
  const code = resolveLanguageCode(requested);
  if (code) {
    if (!user.learningLanguages.includes(code)) {
      const setup = new URLSearchParams({ mode: "add-language", lang: code, redirect: returnTo(code) });
      redirect(`/account-setup?${setup.toString()}`);
    }
    return code;
  }

  if (isSupportedLanguageCode(user.activeLanguage)) {
    return user.activeLanguage;
  }

  redirect("/dashboard");
}

export function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export function toQueryString(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
