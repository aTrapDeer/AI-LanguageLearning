"use client"

import { Header1 } from "@/components/ui/header";
import { usePathname } from "next/navigation";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const isLearnPage = pathname?.startsWith('/learn/');

  return (
    <>
      {!isLearnPage && <Header1 />}
      <main className="flex-1">
        {children}
      </main>
    </>
  );
} 