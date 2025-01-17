import { redis } from '../lib/redis'

interface RedisMetrics {
  [key: string]: string
}

async function monitorRedisUsage() {
  try {
    // Get Redis INFO
    const info = await redis.info()
    console.log('\n📊 Redis Usage Statistics:')
    
    // Parse important metrics
    const metrics = info.split('\n').reduce((acc: RedisMetrics, line) => {
      const [key, value] = line.split(':')
      if (key && value) acc[key.trim()] = value.trim()
      return acc
    }, {})

    // Display key metrics
    console.log('\n🔄 Memory Usage:')
    console.log(`- Used Memory: ${metrics.used_memory_human}`)
    console.log(`- Peak Memory: ${metrics.used_memory_peak_human}`)
    console.log(`- Memory Fragmentation Ratio: ${metrics.mem_fragmentation_ratio}`)

    console.log('\n👥 Connections:')
    console.log(`- Connected Clients: ${metrics.connected_clients}`)
    console.log(`- Blocked Clients: ${metrics.blocked_clients}`)
    console.log(`- Total Connections Received: ${metrics.total_connections_received}`)

    console.log('\n⚡ Operations:')
    console.log(`- Total Commands Processed: ${metrics.total_commands_processed}`)
    console.log(`- Keyspace Hits: ${metrics.keyspace_hits}`)
    console.log(`- Keyspace Misses: ${metrics.keyspace_misses}`)

    // Get all keys and their memory usage
    const keys = await redis.keys('*')
    console.log('\n🔑 Key Statistics:')
    console.log(`- Total Keys: ${keys.length}`)

    // Sample memory usage of some keys
    const sampleSize = Math.min(5, keys.length)
    if (sampleSize > 0) {
      console.log('\n📝 Sample Key Memory Usage:')
      for (let i = 0; i < sampleSize; i++) {
        const memory = await redis.memory('USAGE', keys[i])
        console.log(`- ${keys[i]}: ${memory} bytes`)
      }
    }

  } catch (error) {
    console.error('Failed to monitor Redis:', error)
  } finally {
    process.exit()
  }
}

monitorRedisUsage() 