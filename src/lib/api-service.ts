export interface ChatMessage {
  message: string;
  language: 'English' | 'German' | 'Portuguese (Brazilian)' | 'Chinese' | 'Norwegian' | 'Korean' | 'Arabic'; // Full language names as expected by the API
}

// Define SupportedLanguage type using the same values from ChatMessage.language
export type SupportedLanguage = 'English' | 'German' | 'Portuguese (Brazilian)' | 'Chinese' | 'Norwegian' | 'Korean' | 'Arabic';

export interface ChatResponse {
  response: string;
  audio_url?: string;
  follow_up_question?: string;
}

// Mock API responses for development
const mockResponses: Record<SupportedLanguage, ChatResponse> = {
  'English': {
    response: `That's an interesting question! I think the weather has been quite unpredictable lately.
💡 Correction: None needed, your English is excellent!
❓ Have you noticed any changes in the weather patterns where you live?`,
    follow_up_question: 'Have you noticed any changes in the weather patterns where you live?'
  },
  'German': {
    response: `🇩🇪 Das ist eine interessante Frage! Ich denke, das Wetter ist in letzter Zeit ziemlich unvorhersehbar gewesen.
🇺🇸 That's an interesting question! I think the weather has been quite unpredictable lately.
💡 Correction: None needed, your German is coming along well!`,
    follow_up_question: 'Haben Sie Änderungen in den Wettermustern bemerkt, wo Sie wohnen? / Have you noticed any changes in the weather patterns where you live?'
  },
  'Chinese': {
    response: `🇨🇳 这是个有趣的问题！我认为最近天气变化无常。
📝 Pinyin: Zhè shì gè yǒuqù de wèntí! Wǒ rènwéi zuìjìn tiānqì biànhuà wúcháng.
🇺🇸 That's an interesting question! I think the weather has been quite unpredictable lately.
💡 Correction: None needed, your Chinese is very good!`,
    follow_up_question: '你注意到你住的地方的天气模式有什么变化吗？ / Nǐ zhùyì dào nǐ zhù de dìfāng de tiānqì móshì yǒu shénme biànhuà ma? / Have you noticed any changes in the weather patterns where you live?'
  },
  'Norwegian': {
    response: `🇳🇴 Det er et interessant spørsmål! Jeg tror været har vært ganske uforutsigbart i det siste.
🇺🇸 That's an interesting question! I think the weather has been quite unpredictable lately.
💡 Correction: None needed, your Norwegian sounds natural!`,
    follow_up_question: 'Har du lagt merke til endringer i værmønstrene der du bor? / Have you noticed any changes in the weather patterns where you live?'
  },
  'Portuguese (Brazilian)': {
    response: `🇧🇷 Essa é uma pergunta interessante! Eu acho que o clima tem sido bastante imprevisível ultimamente.
🇺🇸 That's an interesting question! I think the weather has been quite unpredictable lately.
💡 Correction: None needed, your Portuguese is excellent!`,
    follow_up_question: 'Você notou alguma mudança nos padrões climáticos onde você mora? / Have you noticed any changes in the weather patterns where you live?'
  },
  'Korean': {
    response: `🇰🇷 흥미로운 질문이네요! 저는 최근에 날씨가 꽤 예측할 수 없게 변했다고 생각해요.
📝 발음: heung-mi-ro-un jil-mun-i-ne-yo! jeo-neun choe-geun-e nal-ssi-ga kkwae ye-cheuk-hal su eop-ge byeon-haess-da-go saeng-gak-hae-yo.
🇺🇸 That's an interesting question! I think the weather has been quite unpredictable lately.
💡 Correction: None needed, your Korean is coming along well!`,
    follow_up_question: '당신이 사는 곳의 날씨 패턴에 변화가 있었나요? / dangsin-i sa-neun gos-ui nal-ssi pae-teon-e byeon-hwa-ga iss-eoss-na-yo? / Have you noticed any changes in the weather patterns where you live?'
  },
  'Arabic': {
    response: `🇸🇦 هذا سؤال مثير للاهتمام! أعتقد أن الطقس كان غير متوقع تمامًا في الآونة الأخيرة.
📝 النطق: hādhā su'āl muthīr lil-ihtimām! a'taqid anna al-ṭaqs kāna ghayr mutawaqqa' tamāman fī al-āwina al-akhīra.
🇺🇸 That's an interesting question! I think the weather has been quite unpredictable lately.
💡 Correction: None needed, your Arabic is very good!`,
    follow_up_question: 'هل لاحظت أي تغييرات في أنماط الطقس حيث تعيش؟ / hal lāḥaẓta ayy taghyīrāt fī anmāṭ al-ṭaqs ḥaythu ta\'īsh? / Have you noticed any changes in the weather patterns where you live?'
  }
};

// Check if we should use mock responses (for development)
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

// Determine the API base URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api' // Use relative path in production
  : '/api'; // Use relative path in development too

// Log the API URL in development for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
  if (USE_MOCK_API) {
    console.log('Using mock API responses for development');
  }
}

export class ApiService {
  private static ws: WebSocket | null = null;
  private static audioContext: AudioContext | null = null;
  private static isWaitingForResponse = false;
  private static isInitialGreetingPlayed = false;
  private static sessionId = `frontend_${Date.now()}`;
  private static audioWorkletNode: AudioWorkletNode | null = null;
  private static isListening = false;
  private static audioLevel = 0;
  private static silenceTimeout: NodeJS.Timeout | null = null;
  private static SILENCE_THRESHOLD = 0.01;
  private static SILENCE_DURATION = 1000; // 1 second of silence before sending end_of_speech

  static async initializeConversation(language: string): Promise<void> {
    console.log(`[${this.sessionId}] Initializing conversation for language: ${language}`);
    
    // Reset all state
    if (this.ws) {
      console.log(`[${this.sessionId}] Closing existing WebSocket connection`);
      this.ws.close();
      this.ws = null;
    }
    
    this.isWaitingForResponse = false;
    this.isInitialGreetingPlayed = false;
    this.isListening = false;
    
    const config = {
      language,
      voice: "alloy",
      proficiency_level: "intermediate",
      focus_areas: ["pronunciation", "grammar", "vocabulary"],
      conversation_style: "casual",
      instructions: `Practice ${language} conversation with focus on daily situations`
    };

    this.ws = new WebSocket(`ws://localhost:8000/rtc`);
    
    this.ws.onopen = () => {
      console.log(`[${this.sessionId}] WebSocket connection established`);
      this.ws?.send(JSON.stringify(config));
      console.log(`[${this.sessionId}] Sent initial configuration:`, config);
    };

    this.ws.onmessage = async (event) => {
      try {
        if (event.data instanceof Blob) {
          console.log(`[${this.sessionId}] Received audio blob of size: ${event.data.size} bytes`);
          const arrayBuffer = await event.data.arrayBuffer();
          
          if (!this.audioContext) {
            console.log(`[${this.sessionId}] Creating new AudioContext`);
            this.audioContext = new AudioContext({
              sampleRate: 24000
            });
          }
          
          console.log(`[${this.sessionId}] Processing audio data`);
          const int16Data = new Int16Array(arrayBuffer);
          const float32Data = new Float32Array(int16Data.length);
          for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768.0;
          }
          
          const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
          audioBuffer.getChannelData(0).set(float32Data);
          
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.audioContext.destination);
          
          console.log(`[${this.sessionId}] Starting audio playback`);
          source.start();
          
          source.onended = () => {
            if (!this.isInitialGreetingPlayed) {
              this.isInitialGreetingPlayed = true;
              console.log(`[${this.sessionId}] Initial greeting finished, starting to listen`);
              this.startListening();
            } else {
              console.log(`[${this.sessionId}] Response finished playing, ready for next input`);
              this.isWaitingForResponse = false;
              this.startListening();
            }
          };
        }
      } catch (err) {
        console.error(`[${this.sessionId}] Error processing audio response:`, err);
        this.isWaitingForResponse = false;
      }
    };

    this.ws.onerror = (error) => {
      console.error(`[${this.sessionId}] WebSocket error:`, error);
    };

    this.ws.onclose = (event) => {
      console.log(`[${this.sessionId}] WebSocket connection closed:`, event.code, event.reason);
      this.stopListening();
    };
  }

  private static startListening(): void {
    if (this.isListening || this.isWaitingForResponse) return;
    
    console.log(`[${this.sessionId}] Starting to listen for user input`);
    this.isListening = true;
    this.audioLevel = 0;
    
    // Reset silence timeout if it exists
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  private static stopListening(): void {
    if (!this.isListening) return;
    
    console.log(`[${this.sessionId}] Stopping listening`);
    this.isListening = false;
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  static async sendAudioData(audioData: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isListening || this.isWaitingForResponse) {
      return;
    }

    try {
      // Calculate audio level
      const int16Data = new Int16Array(audioData.buffer);
      let sum = 0;
      for (let i = 0; i < int16Data.length; i++) {
        sum += Math.abs(int16Data[i]);
      }
      this.audioLevel = sum / int16Data.length / 32768.0;

      // If audio level is above threshold, send data and reset silence timeout
      if (this.audioLevel > this.SILENCE_THRESHOLD) {
        console.log(`[${this.sessionId}] Sending audio data, level: ${this.audioLevel}`);
        const base64Audio = Buffer.from(audioData).toString('base64');
        const message = {
          type: "input_audio_buffer.append",
          audio: base64Audio
        };
        await this.ws.send(JSON.stringify(message));

        // Reset silence timeout
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
        }
        this.silenceTimeout = setTimeout(() => {
          this.sendEndOfSpeech();
        }, this.SILENCE_DURATION);
      }
    } catch (err) {
      console.error(`[${this.sessionId}] Error sending audio data:`, err);
    }
  }

  static async sendEndOfSpeech(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isListening || this.isWaitingForResponse) {
      return;
    }

    try {
      console.log(`[${this.sessionId}] Sending end of speech signal`);
      const message = {
        type: "end_of_speech"
      };
      await this.ws.send(JSON.stringify(message));
      this.isWaitingForResponse = true;
      this.stopListening();
      console.log(`[${this.sessionId}] End of speech signal sent, waiting for response`);
    } catch (err) {
      console.error(`[${this.sessionId}] Error sending end of speech:`, err);
    }
  }

  // Legacy chat methods
  static async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    try {
      // Use mock responses if enabled (for development/testing)
      if (USE_MOCK_API) {
        console.log('Using mock response for language:', message.language);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return mockResponses[message.language];
      }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      
      // If in development mode, fall back to mock responses on connection errors
      if (process.env.NODE_ENV === 'development' && 
          (error instanceof TypeError || (error instanceof Error && error.message.includes('Failed to fetch')))) {
        console.log('API connection failed. Falling back to mock response for development.');
        return mockResponses[message.language];
      }
      
      throw error;
    }
  }

  static async sendAudio(formData: FormData): Promise<ChatResponse> {
    try {
      // Use mock responses if enabled (for development/testing)
      if (USE_MOCK_API) {
        const language = formData.get('language') as SupportedLanguage;
        console.log('Using mock response for audio in language:', language);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        return mockResponses[language];
      }

      const response = await fetch(`${API_BASE_URL}/chat/audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      return response.json();
    } catch (error: unknown) {
      console.error('Error sending audio:', error);
      
      // If in development mode, fall back to mock responses on connection errors
      if (process.env.NODE_ENV === 'development') {
        const language = formData.get('language') as SupportedLanguage;
        console.log('API connection failed. Falling back to mock response for development.');
        return mockResponses[language];
      }
      
      throw error;
    }
  }

  async checkHealth(): Promise<{ status: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error('Health check failed');
      }
      return await response.json();
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  }
} 