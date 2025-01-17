import { Room, RoomEvent, DataPacket_Kind, LocalParticipant, LocalTrack } from 'livekit-client'

export interface Message {
  type: 'text' | 'audio'
  content: string
  timestamp: number
  url?: string
}

export type MessageHandler = (message: Message) => void

export class LiveKitService {
  private room: Room
  private localParticipant: LocalParticipant | null = null
  private messageHandler: MessageHandler | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private audioTrack: LocalTrack | null = null

  constructor() {
    this.room = new Room()
    this.setupRoomEventHandlers()
    console.log('LiveKitService initialized')
  }

  private setupRoomEventHandlers() {
    this.room.on(RoomEvent.ParticipantConnected, () => {
      console.log('Participant connected')
    })

    this.room.on(RoomEvent.DataReceived, async (payload: Uint8Array, participant, kind) => {
      if (kind !== DataPacket_Kind.RELIABLE) return
      
      try {
        const decoder = new TextDecoder()
        const data = JSON.parse(decoder.decode(payload))
        console.log('Received data from LiveKit:', data)
        
        // Send message to Python API
        console.log('Sending request to Python API:', {
          message: data.content,
          language: data.language || 'German'
        })
        
        const response = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: data.content,
            language: data.language || 'German'
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('API Error:', errorText)
          throw new Error(`Failed to get response from API: ${errorText}`)
        }

        const apiResponse = await response.json()
        console.log('Received response from Python API:', apiResponse)
        
        // Notify handler of received message
        if (this.messageHandler) {
          const message: Message = {
            type: 'text',
            content: apiResponse.response,
            timestamp: Date.now()
          }
          this.messageHandler(message)

          // If there's an audio URL, send it as well
          if (apiResponse.audio_url) {
            console.log('Sending audio response to room:', apiResponse.audio_url)
            const audioMessage: Message = {
              type: 'audio',
              content: apiResponse.audio_url,
              timestamp: Date.now(),
              url: apiResponse.audio_url
            }
            this.messageHandler(audioMessage)
          }
        }
      } catch (error) {
        console.error('Error processing message:', error)
      }
    })
  }

  async connect(token: string): Promise<void> {
    console.log('Connecting to LiveKit with token:', token)
    if (!process.env.NEXT_PUBLIC_LIVEKIT_URL) {
      throw new Error('LiveKit URL not configured')
    }
    
    await this.room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token, {
      autoSubscribe: true
    })
    
    this.localParticipant = this.room.localParticipant
    console.log('Connected to LiveKit room')
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting from LiveKit room')
    await this.room.disconnect()
  }

  async sendMessage(message: Message): Promise<void> {
    if (!this.localParticipant) {
      throw new Error('Not connected to room')
    }

    console.log('Sending message to room:', message)
    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(message))
    await this.localParticipant.publishData(data, { reliable: true })
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  async startRecording(): Promise<void> {
    try {
      console.log('Starting recording...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.mediaRecorder = new MediaRecorder(stream)
      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start()
      console.log('Recording started')
    } catch (error) {
      console.error('Error starting recording:', error)
      throw error
    }
  }

  async stopRecording(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'))
        return
      }

      console.log('Stopping recording...')
      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
          const audioUrl = URL.createObjectURL(audioBlob)
          
          // Send audio message
          await this.sendMessage({
            type: 'audio',
            content: audioUrl,
            timestamp: Date.now(),
            url: audioUrl
          })
          
          // Clean up
          this.audioChunks = []
          this.mediaRecorder = null
          resolve()
        } catch (error) {
          reject(error)
        }
      }

      this.mediaRecorder.stop()
    })
  }
} 