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
    
    // If user is authenticated, check if they have progress for this language
    if (session?.user) {
      try {
        // Check if user has progress for this language
        const progressResponse = await fetch(`/api/user/progress/check?language=${language.code}`);
        
        if (progressResponse.status === 404 || progressResponse.status === 406) {
          // No progress found for this language - redirect to account setup
          console.log(`No progress found for language ${language.code}, redirecting to setup`);
          
          // Set a flag to indicate this is for language setup, not initial account setup
          localStorage.setItem('setupLanguage', language.code);
          router.push('/account-setup');
          return;
        }
        
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