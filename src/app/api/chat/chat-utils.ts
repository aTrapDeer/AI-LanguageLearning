// Helper function to extract the follow-up question from the response
export function extractFollowUpQuestion(text: string): { mainResponse: string, followUpQuestion: string | null } {
  const lines = text.split('\n');
  let mainResponseLines: string[] = [];
  let followUpQuestion = null;

  // Find the follow-up question (identified by ❓)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('❓')) {
      followUpQuestion = lines[i].replace('❓', '').trim();
      // Only include lines before the follow-up question in the main response
      mainResponseLines = lines.slice(0, i);
      break;
    }
  }

  // If no follow-up question was found, use all lines for the main response
  if (!followUpQuestion) {
    mainResponseLines = lines;
  }

  return {
    mainResponse: mainResponseLines.join('\n'),
    followUpQuestion
  };
}

// Define language mapping type for better type checking
export type LanguageCodeMapping = {
  [key: string]: string;
}

// Define OpenAI voice types
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Helper to extract language-specific text for TTS
export function extractLanguageText(text: string, languageCode: string): string {
  const lines = text.split('\n');
  const ttsText = [];
  
  // For English, use the conversational response part (before any corrections)
  if (languageCode === 'en') {
    // Take text until we hit a line with an emoji
    for (const line of lines) {
      if (/[💡❓🌍]/.test(line)) {
        break;
      }
      if (line.trim()) {
        ttsText.push(line.trim());
      }
    }
  } else if (languageCode === 'de') {
    for (const line of lines) {
      if (line.startsWith('🇩🇪')) {
        // Get text between 🇩🇪 and 🇺🇸 if present
        let germanText = line.split('🇩🇪')[1];
        if (germanText.includes('🇺🇸')) {
          germanText = germanText.split('🇺🇸')[0];
        }
        ttsText.push(germanText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the German part before any translation
        let question = line.replace('❓', '').trim();
        if (question.includes('/')) {
          question = question.split('/')[0];
        }
        ttsText.push(question.trim());
      }
    }
  } else if (languageCode === 'zh') {
    for (const line of lines) {
      if (line.startsWith('🇨🇳')) {
        // Get text between 🇨🇳 and 📝 (before pinyin)
        let chineseText = line.split('🇨🇳')[1];
        if (chineseText.includes('📝')) {
          chineseText = chineseText.split('📝')[0];
        }
        ttsText.push(chineseText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the Chinese part before pinyin or translation
        let question = line.replace('❓', '').trim();
        
        // Handle format: Chinese - English
        if (question.includes(' - ')) {
          question = question.split(' - ')[0].trim();
        }
        // Handle format: Chinese (pinyin) - English
        else if (question.includes(') - ')) {
          question = question.split(' - ')[0].trim();
        }
        // Handle format: Chinese / Pinyin / English
        else if (question.includes(' / ')) {
          question = question.split(' / ')[0].trim();
        }
        // Handle format: Chinese / English
        else if (question.includes('/')) {
          question = question.split('/')[0].trim();
        }
        
        // Strip out pinyin in parentheses if needed
        if (question.includes('(') && question.includes(')')) {
          question = question.split('(')[0].trim();
        }
        
        ttsText.push(question.trim());
      }
    }
  } else if (languageCode === 'no') {
    for (const line of lines) {
      if (line.startsWith('🇳🇴')) {
        // Get text between 🇳🇴 and 🇺�� if present
        let norwegianText = line.split('🇳🇴')[1];
        if (norwegianText.includes('🇺🇸')) {
          norwegianText = norwegianText.split('🇺🇸')[0];
        }
        ttsText.push(norwegianText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the Norwegian part before translation
        let question = line.replace('❓', '').trim();
        
        // Handle various formats similar to other languages
        if (question.includes(' - ')) {
          question = question.split(' - ')[0].trim();
        } else if (question.includes('/')) {
          question = question.split('/')[0].trim();
        }
        
        ttsText.push(question.trim());
      }
    }
  } else if (languageCode === 'pt-BR') {
    for (const line of lines) {
      if (line.startsWith('🇧🇷')) {
        // Get text between 🇧🇷 and 🇺🇸
        let portugueseText = line.split('🇧🇷')[1];
        if (portugueseText.includes('🇺🇸')) {
          portugueseText = portugueseText.split('🇺🇸')[0];
        }
        ttsText.push(portugueseText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the Portuguese part before translation
        let question = line.replace('❓', '').trim();
        if (question.includes('/')) {
          question = question.split('/')[0];
        }
        ttsText.push(question.trim());
      }
    }
  } else if (languageCode === 'ko') {
    for (const line of lines) {
      if (line.startsWith('🇰🇷')) {
        // Get text between 🇰🇷 and 📝 (before pronunciation)
        let koreanText = line.split('🇰🇷')[1];
        if (koreanText.includes('📝')) {
          koreanText = koreanText.split('📝')[0];
        }
        ttsText.push(koreanText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the Korean part before translation or romanization
        let question = line.replace('❓', '').trim();
        
        // Handle format: Korean - English
        if (question.includes(' - ')) {
          question = question.split(' - ')[0].trim();
        }
        // Handle format: Korean (romanization) - English
        else if (question.includes(') - ')) {
          question = question.split(' - ')[0].trim();
        }
        // Handle format: Korean / English
        else if (question.includes('/')) {
          question = question.split('/')[0].trim();
        }
        
        // Strip out romanization in parentheses if needed
        if (question.includes('(') && question.includes(')')) {
          question = question.split('(')[0].trim();
        }
        
        ttsText.push(question.trim());
      }
    }
  } else if (languageCode === 'ar') {
    for (const line of lines) {
      if (line.startsWith('🇸🇦')) {
        // Get text between 🇸🇦 and 📝 (before pronunciation)
        let arabicText = line.split('🇸🇦')[1];
        if (arabicText.includes('📝')) {
          arabicText = arabicText.split('📝')[0];
        }
        ttsText.push(arabicText.trim());
      } else if (line.startsWith('❓')) {
        // For questions, get the Arabic part before translation or romanization
        let question = line.replace('❓', '').trim();
        
        // Handle format: Arabic - English
        if (question.includes(' - ')) {
          question = question.split(' - ')[0].trim();
        }
        // Handle format: Arabic (romanization) - English
        else if (question.includes(') - ')) {
          question = question.split(' - ')[0].trim();
        }
        // Handle format: Arabic / English
        else if (question.includes('/')) {
          question = question.split('/')[0].trim();
        }
        
        // Strip out romanization in parentheses if needed
        if (question.includes('(') && question.includes(')')) {
          question = question.split('(')[0].trim();
        }
        
        ttsText.push(question.trim());
      }
    }
  }
  
  // Join all extracted text with proper spacing
  const combinedText = ttsText.join(' ').trim();
  return combinedText || text;
} 