import { getLanguageConfig } from "@/lib/language-config";
import { cn } from "@/lib/utils";

export interface TargetTextProps {
  text: string;
  language: string;
  romanization?: string | null;
  showRomanization?: boolean;
  className?: string;
  romanizationClassName?: string;
  as?: "span" | "p" | "div";
}

/** Target-language text with the right `lang`/`dir` (RTL for Arabic) and an optional reading aid. */
export function TargetText({
  text,
  language,
  romanization,
  showRomanization = true,
  className,
  romanizationClassName,
  as: Tag = "span",
}: TargetTextProps) {
  const config = getLanguageConfig(language);
  return (
    <Tag className="inline-flex flex-col items-center">
      <span lang={config?.speechLocale ?? language} dir={config?.rtl ? "rtl" : "auto"} className={cn("break-words", className)}>
        {text}
      </span>
      {showRomanization && romanization && (
        <span lang="en" dir="ltr" className={cn("text-sm font-normal opacity-75", romanizationClassName)}>
          {romanization}
        </span>
      )}
    </Tag>
  );
}

export function targetDir(language: string): "rtl" | "ltr" {
  return getLanguageConfig(language)?.rtl ? "rtl" : "ltr";
}

export function targetLang(language: string): string {
  return getLanguageConfig(language)?.speechLocale ?? language;
}
