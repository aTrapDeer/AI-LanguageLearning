import { spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '../..')

function spawnProcess(command: string, args: string[], name: string) {
  const proc = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    cwd: rootDir
  })

  proc.stdout.on('data', (data) => {
    console.log(`[${name}] ${data.toString().trim()}`)
  })

  proc.stderr.on('data', (data) => {
    console.error(`[${name}] ${data.toString().trim()}`)
  })

  proc.on('close', (code) => {
    console.log(`[${name}] Process exited with code ${code}`)
  })

  return proc
}

// Start Next.js
const nextProcess = spawnProcess('npm', ['run', process.env.NODE_ENV === 'production' ? 'start' : 'dev'], 'Next.js')

// Start LiveKit agent
const agentProcess = spawnProcess(
  'npm',
  ['run', process.env.NODE_ENV === 'production' ? 'agent:prod' : 'agent'],
  'LiveKit Agent'
)

// Handle process termination
process.on('SIGINT', () => {
  nextProcess.kill()
  agentProcess.kill()
  process.exit()
})

process.on('SIGTERM', () => {
  nextProcess.kill()
  agentProcess.kill()
  process.exit()
}) 