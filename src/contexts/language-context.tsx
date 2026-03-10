"use client"

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SUPPORTED_LANGUAGES } from '@/lib/language-config';

type Language = {
  code: string;
  name: string;
  flag: string;
};

type LanguageContextType = {
  selectedLanguage: Language | null;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const languages: Language[] = [...SUPPORTED_LANGUAGES];

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const router = useRouter();
  const { data: session } = useSession();

  const getCurrentLocation = () => {
    const { pathname, search } = window.location;
    return `${pathname}${search}`;
  };

  const routeWithLanguage = (languageCode: string) => {
    const url = new URL(window.location.href);

    if (url.pathname.startsWith('/learn/')) {
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length === 2 && languages.some((lang) => lang.code === segments[1])) {
        url.pathname = `/learn/${languageCode}`;
      } else {
        url.searchParams.set('lang', languageCode);
      }

      return `${url.pathname}${url.search}`;
    }

    if (url.pathname === '/flashcards' || url.pathname === '/travel') {
      url.searchParams.set('lang', languageCode);
      return `${url.pathname}${url.search}`;
    }

    return null;
  };

  const buildAccountSetupUrl = (languageCode: string) => {
    const params = new URLSearchParams({
      mode: 'add-language',
      lang: languageCode,
      redirect: getCurrentLocation(),
    });

    return `/account-setup?${params.toString()}`;
  };

  useEffect(() => {
    const initializeLanguage = async () => {
      // Try to get the language from localStorage first
      const savedLanguage = localStorage.getItem('selectedLanguage');
      let languageToSet = savedLanguage ? JSON.parse(savedLanguage) : languages[0];

      // If user is authenticated, try to get their active language from the database
      if (session?.user) {
        try {
          const response = await fetch('/api/user/active-language');
          if (response.ok) {
            const data = await response.json();
            if (data.activeLanguage) {
              const dbLanguage = languages.find(lang => lang.code === data.activeLanguage);
              if (dbLanguage) {
                languageToSet = dbLanguage;
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch active language:', error);
        }
      }

      setSelectedLanguage(languageToSet);
      localStorage.setItem('selectedLanguage', JSON.stringify(languageToSet));
    };

    initializeLanguage();
  }, [session]);

  useEffect(() => {
    const syncSelectedLanguage = () => {
      const savedLanguage = localStorage.getItem('selectedLanguage');
      if (!savedLanguage) {
        return;
      }

      try {
        setSelectedLanguage(JSON.parse(savedLanguage));
      } catch (error) {
        console.error('Failed to sync selected language from storage:', error);
      }
    };

    window.addEventListener('storage', syncSelectedLanguage);
    window.addEventListener('selected-language-updated', syncSelectedLanguage);

    return () => {
      window.removeEventListener('storage', syncSelectedLanguage);
      window.removeEventListener('selected-language-updated', syncSelectedLanguage);
    };
  }, []);

  const setLanguage = async (language: Language) => {
    if (session?.user) {
      try {
        // Check if user has progress for this language
        const progressResponse = await fetch(`/api/user/progress/check?language=${language.code}`);

        if (progressResponse.status === 404 || progressResponse.status === 406) {
          // No progress found for this language - redirect to account setup
          console.log(`No progress found for language ${language.code}, redirecting to setup`);

          // Keep legacy storage flags as a fallback while using an explicit add-language route.
          localStorage.setItem('setupLanguage', language.code);
          localStorage.setItem('setupRedirect', getCurrentLocation());
          router.push(buildAccountSetupUrl(language.code));
          return;
        }

        setSelectedLanguage(language);
        localStorage.setItem('selectedLanguage', JSON.stringify(language));
        window.dispatchEvent(new Event('selected-language-updated'));

        // Update their active language in the database
        await fetch('/api/user/active-language', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ language: language.code }),
        });
      } catch (error) {
        console.error('Failed to check progress or update active language:', error);
        // Continue anyway, let the journey page handle the missing progress
        setSelectedLanguage(language);
        localStorage.setItem('selectedLanguage', JSON.stringify(language));
        window.dispatchEvent(new Event('selected-language-updated'));
      }
    } else {
      setSelectedLanguage(language);
      localStorage.setItem('selectedLanguage', JSON.stringify(language));
      window.dispatchEvent(new Event('selected-language-updated'));
    }

    const nextRoute = routeWithLanguage(language.code);
    if (nextRoute) {
      router.push(nextRoute);
    }
  };

  return (
    <LanguageContext.Provider value={{ selectedLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
} 
