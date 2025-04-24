"use client"

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

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

export const languages: Language[] = [
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt-BR', name: 'Portuguese (Brazilian)', flag: '🇧🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
];

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const router = useRouter();
  const { data: session } = useSession();

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

  const setLanguage = async (language: Language) => {
    setSelectedLanguage(language);
    localStorage.setItem('selectedLanguage', JSON.stringify(language));
    
    // If user is authenticated, update their active language in the database
    if (session?.user) {
      try {
        await fetch('/api/user/active-language', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ language: language.code }),
        });
      } catch (error) {
        console.error('Failed to update active language:', error);
      }
    }
    
    // Update URL if we're in a learning route
    const path = window.location.pathname;
    if (path.startsWith('/learn/')) {
      const route = path.split('/')[2]; // Get the route after /learn/
      router.push(`/learn/${route}?lang=${language.code}`);
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