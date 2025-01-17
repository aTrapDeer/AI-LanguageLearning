import { config } from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load environment variables from all possible env files
const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local'
]

envFiles.forEach(file => {
  config({ path: resolve(__dirname, '../../', file) })
})

// Verify OpenAI API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('OpenAI API key not found in environment variables')
  console.error('Available env vars:', Object.keys(process.env))
  process.exit(1)
}

// Import and run the agent
import '../lib/livekit-agent' 