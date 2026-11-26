"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { DailyGoalRing, StreakBadge } from "@/components/learn";
import { LanguageSelect } from "@/components/ui/language-select";
import { useLanguage } from "@/contexts/language-context";
import { useLearnSummary } from "@/hooks/use-learn-summary";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  /** Pathname prefix that marks this item active. */
  match: (pathname: string) => boolean;
  badge?: number;
}

function buildNav(lang: string, dueCount: number): NavItem[] {
  const code = encodeURIComponent(lang);
  return [
    { href: "/dashboard", label: "Home", match: (path) => path === "/dashboard" },
    { href: `/learn/journey?lang=${code}`, label: "Path", match: (path) => path.startsWith("/learn/journey") },
    { href: `/flashcards?lang=${code}`, label: "Review", match: (path) => path.startsWith("/flashcards"), badge: dueCount },
    {
      href: `/learn/${code}`,
      label: "Tutor",
      match: (path) => path.startsWith("/learn/") && !path.startsWith("/learn/journey") && !path.startsWith("/learn/conversation"),
    },
    { href: `/learn/conversation?lang=${code}`, label: "Voice", match: (path) => path.startsWith("/learn/conversation") },
    { href: `/travel?lang=${code}`, label: "Travel", match: (path) => path.startsWith("/travel") },
  ];
}

function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2" aria-label="Laingfy home">
      <Image src="/favicon/LOGO1.png" alt="" width={28} height={28} />
      <span className="bg-gradient-to-r from-indigo-600 via-rose-500 to-violet-600 bg-clip-text text-lg font-black tracking-tight text-transparent md:text-xl">
        LAINGFY
      </span>
    </Link>
  );
}

function Header1() {
  const { status } = useSession();
  const pathname = usePathname() ?? "/";
  const { selectedLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthenticated = status === "authenticated";
  const lang = selectedLanguage?.code ?? "de";
  const { summary } = useLearnSummary(selectedLanguage?.code ?? null, {
    enabled: isAuthenticated && Boolean(selectedLanguage),
    refreshOnFocus: true,
  });

  useEffect(() => setMenuOpen(false), [pathname]);

  const nav = buildNav(lang, summary?.review.dueCount ?? 0);
  const showProgress = isAuthenticated && summary?.hasProgress;

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:h-16 md:gap-4">
        <Wordmark href={isAuthenticated ? "/dashboard" : "/"} />

        {isAuthenticated && (
          <nav aria-label="Main" className="ml-2 hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.match(pathname) ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition",
                  item.match(pathname) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-extrabold tabular-nums text-white">{item.badge}</span>
                ) : null}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          {status === "loading" ? null : isAuthenticated ? (
            <>
              {showProgress && summary && (
                <Link href="/dashboard" className="flex items-center gap-1.5 rounded-full px-1 py-0.5 hover:bg-slate-100" aria-label="Your streak and daily goal">
                  <StreakBadge
                    streak={summary.streak.current}
                    todayDone={summary.streak.todayDone}
                    atRisk={summary.streak.atRisk}
                    surface="light"
                    size="sm"
                  />
                  <DailyGoalRing xp={summary.today.xp} goal={summary.today.goal} size={30} strokeWidth={4} surface="light" />
                </Link>
              )}
              <LanguageSelect />
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="hidden h-9 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 lg:inline-flex lg:items-center"
              >
                Sign out
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden"
              >
                {menuOpen ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 text-sm font-bold text-white shadow-sm hover:from-indigo-500 hover:to-purple-500"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      {isAuthenticated && menuOpen && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 shadow-lg lg:hidden">
          <ul className="grid grid-cols-2 gap-1.5">
            {nav.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={item.match(pathname) ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold",
                    item.match(pathname) ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {item.label}
                  {item.badge ? (
                    <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-extrabold tabular-nums text-white">{item.badge}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="mt-2 h-11 w-full rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}

export { Header1 };
