import 'dotenv/config'
import { redis } from '../lib/redis'
import type { Redis } from 'ioredis'

async function waitForConnection(client: Redis, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'))
    }, timeoutMs)

    client.once('ready', () => {
      clearTimeout(timeout)
      resolve()
    })

    client.once('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function testRedisConnection(client: Redis) {
  console.log('\n🔄 Testing Redis Connection...\n')

  try {
    // Wait for connection
    console.log('Waiting for Redis connection...')
    await waitForConnection(client)
    console.log('Connection established')

    // Test basic connection
    console.log('\n1️⃣ Testing basic connection...')
    const pong = await client.ping()
    console.log('✅ PING response:', pong)

    // Test write operation
    console.log('\n2️⃣ Testing write operation...')
    await client.set('test_key', 'Hello from AI LangLearn!')
    console.log('✅ Successfully wrote test key')

    // Test read operation
    console.log('\n3️⃣ Testing read operation...')
    const value = await client.get('test_key')
    console.log('✅ Read value:', value)

    // Clean up
    console.log('\n4️⃣ Cleaning up...')
    await client.del('test_key')
    console.log('✅ Test key removed')

    console.log('\n✨ All Redis tests passed successfully!')
  } catch (err: any) {
    console.error('\n❌ Redis connection test failed:', err)
    console.error('Details:', {
      message: err.message,
      stack: err.stack
    })
  } finally {
    console.log('\n👋 Closing connection...')
    await client.quit()
  }
}

// Run the test
testRedisConnection(redis).catch(console.error) 