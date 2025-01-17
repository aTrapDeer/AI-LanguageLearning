export interface ChatMessage {
  message: string;
  language: string;
}

export interface ChatResponse {
  response: string;
  audio_url?: string;
}

// Determine the API base URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? process.env.NEXT_PUBLIC_AGENT_WS_URL
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Log the API URL in development for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
}

export const ApiService = {
  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send message');
      }

      const data = await response.json();
      
      // If there's an audio URL, prepend the API base URL if it's a relative path
      if (data.audio_url && data.audio_url.startsWith('/')) {
        data.audio_url = `${API_BASE_URL}${data.audio_url}`;
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

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
  },

  async sendAudio(formData: FormData): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to process audio');
      }

      const data = await response.json();
      
      // If there's an audio URL, prepend the API base URL if it's a relative path
      if (data.audio_url && data.audio_url.startsWith('/')) {
        data.audio_url = `${API_BASE_URL}${data.audio_url}`;
      }

      return data;
    } catch (error) {
      console.error('Error sending audio:', error);
      throw error;
    }
  }
}; 