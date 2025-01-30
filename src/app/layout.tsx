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

export const metadata: Metadata = {
  title: "Laignfy - AI Language Learning Platform",
  description: "Learn languages naturally with AI-powered tutoring, real-time feedback, and interactive conversations. Master new languages with personalized practice sessions.",
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
    title: "Laignfy - AI Language Learning Platform",
    description: "Learn languages naturally with AI-powered tutoring and real-time feedback",
    images: [{ url: "/favicon/LOGO1.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Laignfy - AI Language Learning Platform",
    description: "Learn languages naturally with AI-powered tutoring and real-time feedback",
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
