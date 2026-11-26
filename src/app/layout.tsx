import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header1 } from "@/components/ui/header";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Absolute base for Open Graph/Twitter image URLs; falls back to localhost in development. */
function resolveSiteUrl(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const candidate of candidates) {
    try {
      if (candidate) return new URL(candidate);
    } catch {
      // Ignore malformed values and try the next one.
    }
  }

  return new URL("http://localhost:3000");
}

const DESCRIPTION =
  "A structured path from A1 to C2 in German, Brazilian Portuguese, Chinese, Norwegian, Korean and Arabic: adaptive lessons, spaced-repetition review, a tutor that remembers you, and live voice practice.";

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: "Laingfy - Learn a language that sticks",
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
    shortcut: "/favicon/favicon.ico",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Laingfy - Learn a language that sticks",
    description: DESCRIPTION,
    images: [{ url: "/favicon/LOGO1.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "Laingfy - Learn a language that sticks",
    description: DESCRIPTION,
    images: ["/favicon/LOGO1.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen flex flex-col`}
      >
        <Providers>
          <Header1 />
          <main className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
