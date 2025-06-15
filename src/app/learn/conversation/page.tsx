'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { SpeakerLoudIcon, ChatBubbleIcon } from '@radix-ui/react-icons';

const ConversationModePage = () => {
  const router = useRouter();
  const { selectedLanguage } = useLanguage();

  const conversationModes = [
    {
      id: 'native',
      title: 'Native Mode',
      description: 'Practice with AI speaking only in your target language. Perfect for immersive practice.',
      icon: SpeakerLoudIcon,
      gradient: 'from-blue-500 to-blue-600',
      features: [
        'Full immersion in target language',
        'Natural conversation flow',
        'Grammar corrections in target language',
        'Cultural context and expressions'
      ]
    },
    {
      id: 'assisted',
      title: 'Assisted Mode',
      description: 'Get explanations in English to perfect your foreign language skills with detailed guidance.',
      icon: ChatBubbleIcon,
      gradient: 'from-emerald-500 to-emerald-600',
      features: [
        'English explanations for grammar',
        'Translation help when needed',
        'Detailed feedback on mistakes',
        'Learning tips and suggestions'
      ]
    }
  ];

  const handleModeSelect = (mode: string) => {
    router.push(`/learn/conversation/session?mode=${mode}&lang=${selectedLanguage?.code || 'en'}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Conversation Mode
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Select the conversation style that best fits your learning goals and current level.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {conversationModes.map((mode) => (
            <div
              key={mode.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer group"
              onClick={() => handleModeSelect(mode.id)}
            >
              <div className={`h-2 bg-gradient-to-r ${mode.gradient}`}></div>
              
              <div className="p-8">
                <div className="flex items-center mb-6">
                  <div className={`p-3 rounded-xl bg-gradient-to-r ${mode.gradient} text-white mr-4`}>
                    <mode.icon className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {mode.title}
                  </h2>
                </div>
                
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg leading-relaxed">
                  {mode.description}
                </p>
                
                <div className="space-y-3 mb-8">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Features:</h3>
                  <ul className="space-y-2">
                    {mode.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-gray-600 dark:text-gray-300">
                        <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button 
                  className={`w-full py-4 px-6 rounded-xl bg-gradient-to-r ${mode.gradient} text-white font-semibold text-lg hover:shadow-lg transition-all duration-300 group-hover:scale-105`}
                >
                  Start {mode.title}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button
            onClick={() => router.back()}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversationModePage;