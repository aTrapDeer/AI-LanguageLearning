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
import { useLanguage, languages } from "@/contexts/language-context";

export function LanguageSelect() {
  const { selectedLanguage, setLanguage } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <span className="text-xl">{selectedLanguage?.flag}</span>
          <span className="text-sm font-medium">{selectedLanguage?.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Language</DialogTitle>
          <DialogDescription>
            Select the language you want to learn
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 py-4">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant={selectedLanguage?.code === lang.code ? "default" : "outline"}
              className="w-full justify-start gap-2"
              onClick={() => {
                setLanguage(lang);
              }}
            >
              <span className="text-xl">{lang.flag}</span>
              <span>{lang.name}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
} 