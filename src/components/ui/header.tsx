"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { House, Layers, LogOut, Menu, MessageCircle, Mic, Plane, Route, X, type LucideIcon } from "lucide-react";
import { DailyGoalRing, StreakBadge } from "@/components/learn";
import { LanguageSelect } from "@/components/ui/language-select";
import { useLanguage } from "@/contexts/language-context";
import { useLearnSummary } from "@/hooks/use-learn-summary";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Pathname prefix that marks this item active. */
  match: (pathname: string) => boolean;
  badge?: number;
}

function buildNav(lang: string, dueCount: number): NavItem[] {
  const code = encodeURIComponent(lang);
  return [
    { href: "/dashboard", label: "Home", icon: House, match: (path) => path === "/dashboard" },
    { href: `/learn/journey?lang=${code}`, label: "Path", icon: Route, match: (path) => path.startsWith("/learn/journey") },
    { href: `/flashcards?lang=${code}`, label: "Review", icon: Layers, match: (path) => path.startsWith("/flashcards"), badge: dueCount },
    {
      href: `/learn/${code}`,
      label: "Tutor",
      icon: MessageCircle,
      match: (path) => path.startsWith("/learn/") && !path.startsWith("/learn/journey") && !path.startsWith("/learn/conversation"),
    },
    { href: `/learn/conversation?lang=${code}`, label: "Voice", icon: Mic, match: (path) => path.startsWith("/learn/conversation") },
    { href: `/travel?lang=${code}`, label: "Travel", icon: Plane, match: (path) => path.startsWith("/travel") },
  ];
}

function Wordmark({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 flex h-11 shrink-0 items-center gap-2 rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
      aria-label="Laingfy home"
    >
      <Image src="/favicon/LOGO1.png" alt="" width={28} height={28} />
      <span className="font-display text-[1.35rem] font-extrabold tracking-[-0.03em] text-ink-950">Laingfy</span>
    </Link>
  );
}

function DueBadge({ count }: { count: number }) {
  return (
    <span className="min-w-[1.25rem] rounded-full bg-ember-400 px-1.5 text-center text-[11px] font-bold leading-5 tabular-nums text-ink-950">
      <span className="sr-only">, </span>
      {count}
      <span className="sr-only"> due</span>
    </span>
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
    <header className="fixed inset-x-0 top-0 z-30 border-b border-ink-900/[0.07] bg-paper/95 backdrop-blur-md supports-[backdrop-filter]:bg-paper/[0.88]">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1.5 px-4 sm:px-6 md:h-16 md:gap-3">
        <Wordmark href={isAuthenticated ? "/dashboard" : "/"} />

        {isAuthenticated && (
          <nav aria-label="Main" className="ml-3 hidden items-center gap-0.5 lg:flex">
            {nav.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500",
                    active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-900/[0.06] hover:text-ink-950"
                  )}
                >
                  {item.label}
                  {item.badge ? <DueBadge count={item.badge} /> : null}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-0.5 md:gap-1.5">
          {status === "loading" ? null : isAuthenticated ? (
            <>
              {showProgress && summary && (
                <Link
                  href="/dashboard"
                  className="flex h-11 items-center gap-1.5 rounded-full px-1.5 transition hover:bg-ink-900/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
                  aria-label={`Your streak and daily goal: ${summary.streak.current}-day streak, ${summary.today.xp} of ${summary.today.goal} XP today`}
                >
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
                className="hidden h-10 items-center rounded-full px-3.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-900/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 lg:inline-flex"
              >
                Sign out
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-900 transition hover:bg-ink-900/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 lg:hidden"
              >
                {menuOpen ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
                {!menuOpen && (summary?.review.dueCount ?? 0) > 0 && (
                  <span aria-hidden className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-paper bg-ember-400" />
                )}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-full px-3.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-900/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-full bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-300"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      {isAuthenticated && menuOpen && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-ink-900/[0.07] bg-paper px-4 pb-4 pt-3 shadow-[0_24px_40px_-24px_rgb(24_18_63/0.4)] lg:hidden">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {nav.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-14 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500",
                      active ? "bg-ink-900 text-white" : "border border-ink-900/[0.07] bg-white text-ink-900 hover:border-ink-900/20"
                    )}
                  >
                    <item.icon aria-hidden className={cn("h-5 w-5", active ? "text-ember-300" : "text-ink-500")} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? <DueBadge count={item.badge} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-ink-600 transition hover:bg-ink-900/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
          >
            <LogOut aria-hidden className="h-4 w-4" /> Sign out
          </button>
        </nav>
      )}
    </header>
  );
}

export { Header1 };
