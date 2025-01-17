"use client";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import Link from "next/link";

const languages = [
  {
    from: "English",
    to: "German",
    code: "de",
    flag: "🇩🇪",
  },
  {
    from: "English",
    to: "Portuguese (Brazilian)",
    code: "pt-br",
    flag: "🇧🇷",
  },
  {
    from: "English",
    to: "Mandarin",
    code: "zh",
    flag: "🇨🇳",
  },
  {
    from: "English",
    to: "Norwegian",
    code: "no",
    flag: "🇳🇴",
  },
];

export function LanguageSelect() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="hidden md:inline">
          Choose Language
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Your Learning Path</DialogTitle>
          <DialogDescription>
            Select the language you want to learn. We&apos;ll personalize your experience accordingly.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant="outline"
              className="justify-start h-auto py-4"
              asChild
            >
              <Link href={`/learn/${lang.code}`}>
                <div className="flex items-center w-full">
                  <span className="text-2xl mr-4">{lang.flag}</span>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      {lang.from} → {lang.to}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Learn {lang.to} as an {lang.from} speaker
                    </span>
                  </div>
                </div>
              </Link>
            </Button>
          ))}
          <p className="text-sm text-muted-foreground text-center mt-2">
            More languages coming soon!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
} 