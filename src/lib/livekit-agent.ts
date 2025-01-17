import { fileURLToPath } from 'node:url'
import { cli, defineAgent, llm, pipeline, WorkerOptions, type JobContext } from '@livekit/agents'
import * as deepgram from '@livekit/agents-plugin-deepgram'
import * as openai from '@livekit/agents-plugin-openai'
import * as silero from '@livekit/agents-plugin-silero'
import { JobType } from '@livekit/protocol'

interface LanguageConfig {
  instructions: string
  deepgramLanguage: string
  voice: openai.TTSVoices
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  'de': {
    instructions: `You are a German language tutor. Help the user learn German through conversation, 
    correct their mistakes gently, and provide cultural context when relevant. 
    Engage with the user in German, starting with simple phrases and gradually increasing complexity 
    based on their responses. Provide translations when needed.`,
    deepgramLanguage: 'de',
    voice: 'alloy'
  },
  'pt-BR': {
    instructions: `You are a Brazilian Portuguese language tutor. Help the user learn Portuguese through conversation, 
    correct their mistakes gently, and provide cultural context when relevant. 
    Engage with the user in Portuguese, starting with simple phrases and gradually increasing complexity 
    based on their responses. Provide translations when needed.`,
    deepgramLanguage: 'pt',
    voice: 'nova'
  },
  'zh': {
    instructions: `You are a Mandarin Chinese language tutor. Help the user learn Mandarin through conversation, 
    correct their mistakes gently, and provide cultural context when relevant. 
    Engage with the user in Mandarin, starting with simple phrases and gradually increasing complexity 
    based on their responses. Provide translations and pronunciation guidance when needed.`,
    deepgramLanguage: 'zh',
    voice: 'shimmer'
  },
  'no': {
    instructions: `You are a Norwegian language tutor. Help the user learn Norwegian through conversation, 
    correct their mistakes gently, and provide cultural context when relevant. 
    Engage with the user in Norwegian, starting with simple phrases and gradually increasing complexity 
    based on their responses. Provide translations when needed.`,
    deepgramLanguage: 'no',
    voice: 'echo'
  }
}

interface ParticipantMetadata {
  languageCode: string
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    try {
      console.log('Connecting to LiveKit...')
      await ctx.connect()
      console.log('Connected to LiveKit')

      const participant = await ctx.waitForParticipant()
      console.log('Participant joined:', participant.identity)

      const metadata = participant.metadata ? JSON.parse(participant.metadata) as ParticipantMetadata : null
      const languageCode = metadata?.languageCode || 'en'
      const config = LANGUAGE_CONFIGS[languageCode]

      if (!config) {
        throw new Error(`Unsupported language code: ${languageCode}`)
      }

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured')
      }

      if (!process.env.DEEPGRAM_API_KEY) {
        throw new Error('Deepgram API key not configured')
      }

      console.log(`Starting language learning agent for ${participant.identity} in ${languageCode}`)

      // Initialize chat context with system prompt
      const initialContext = new llm.ChatContext().append({
        role: llm.ChatRole.SYSTEM,
        text: config.instructions
      })

      console.log('Creating voice pipeline agent...')
      const agent = new pipeline.VoicePipelineAgent(
        await silero.VAD.load(),
        new deepgram.STT({ 
          apiKey: process.env.DEEPGRAM_API_KEY,
          model: 'nova-2-general',
          language: config.deepgramLanguage
        }),
        new openai.LLM({
          apiKey: process.env.OPENAI_API_KEY,
          model: 'gpt-4o-mini',
          temperature: 0.7
        }),
        new openai.TTS({
          apiKey: process.env.OPENAI_API_KEY,
          voice: config.voice,
          model: 'tts-1'
        }),
        {
          chatCtx: initialContext,
          allowInterruptions: true,
          interruptSpeechDuration: 500,
          interruptMinWords: 0,
          minEndpointingDelay: 500
        }
      )

      // Add debug logging
      console.log('Agent configuration:', {
        languageCode,
        deepgramLanguage: config.deepgramLanguage,
        voice: config.voice,
        instructions: config.instructions
      })

      console.log('Starting agent...')
      await agent.start(ctx.room, participant)
      console.log('Agent started successfully')

      // Keep the agent running
      await new Promise(() => {})
    } catch (error) {
      console.error('Agent error:', error)
      throw error
    }
  },
})

cli.runApp(new WorkerOptions({ 
  agent: fileURLToPath(import.meta.url), 
  workerType: JobType.JT_ROOM 
})) 