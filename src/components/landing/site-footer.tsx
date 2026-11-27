import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-ink-950 px-4 py-8 text-white/70 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <Image src="/favicon/LOGO1.png" alt="" width={22} height={22} />
          <span className="font-display text-lg font-extrabold tracking-tight text-white">Laingfy</span>
          <span className="text-sm">· Learn a language that sticks</span>
        </p>
        <nav aria-label="Legal" className="-mx-3 flex text-sm">
          <Link href="/privacy" className="inline-flex h-11 items-center rounded-lg px-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
            Privacy
          </Link>
          <Link href="/terms" className="inline-flex h-11 items-center rounded-lg px-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
