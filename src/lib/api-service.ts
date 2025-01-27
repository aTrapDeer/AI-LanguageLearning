export interface ChatMessage {
  message: string;
  language: 'English' | 'German' | 'Portuguese (Brazilian)' | 'Chinese' | 'Norwegian'; // Full language names as expected by the API
}

export interface ChatResponse {
  response: string;
  audio_url?: string;
}

// Convert WebSocket URL to HTTP URL if needed
function getHttpUrl(url: string | undefined): string {
  if (!url) return 'http://localhost:8000';
  
  // Remove /ws path if present for HTTP requests
  const cleanUrl = url.replace('/ws/', '/').replace('/ws', '');
  
  // In production with custom domain (api.laingfy.com)
  if (process.env.NODE_ENV === 'production') {
    if (cleanUrl.includes('api.laingfy.com')) {
      // Already using the correct domain, just ensure HTTPS
      return cleanUrl.replace(/^(ws|http|wss):\/\//, 'https://');
    }
    
    // For ELB domain, remove port and use HTTPS unless HTTP is explicitly allowed
    const allowHttp = process.env.NEXT_PUBLIC_ALLOW_HTTP === 'true';
    if (!allowHttp) {
      const urlWithoutPort = cleanUrl.replace(':8000', '');
      return urlWithoutPort.replace(/^(ws|http|wss):\/\//, 'https://');
    }
  }
  
  // In development or when HTTP is allowed
  if (cleanUrl.startsWith('ws://')) {
    return cleanUrl.replace('ws://', 'http://');
  }
  if (cleanUrl.startsWith('wss://')) {
    return cleanUrl.replace('wss://', 'https://');
  }
  
  return cleanUrl;
}

// Determine the API base URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.laingfy.com'
  : getHttpUrl(process.env.NEXT_PUBLIC_API_URL);

// Log the API URL in development for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
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
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  static async sendAudio(formData: FormData): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      return response.json();
    } catch (error) {
      console.error('Error sending audio:', error);
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