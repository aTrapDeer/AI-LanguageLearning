import Redis, { RedisOptions } from 'ioredis'

const getRedisConfig = (): RedisOptions => {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is not defined');
  }
  
  const baseConfig = {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    commandTimeout: 5000,
    enableOfflineQueue: false, // Disable offline queue to prevent memory buildup
    lazyConnect: true, // Enable lazy connect to reduce unnecessary connections
    maxReconnectTime: 5000, // Maximum time to attempt reconnection
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 100, 2000);
    },
    // Add connection pool settings
    poolSize: 5, // Limit maximum connections
    idleTimeoutMillis: 300000, // Close idle connections after 5 minutes
  };

  // In development, use the EC2 proxy
  if (process.env.NODE_ENV === 'development') {
    return {
      ...baseConfig,
      host: 'ec2-44-217-124-246.compute-1.amazonaws.com',
      port: 6380,
      tls: undefined,
    };
  }
  
  // For production, parse the URL
  return {
    ...baseConfig,
    host: url,
    tls: {
      rejectUnauthorized: false
    }
  };
};

// Add development mode logging
const isDevelopment = process.env.NODE_ENV === 'development'
if (isDevelopment) {
  console.log('🔧 Redis Configuration:')
  console.log('- Environment:', process.env.NODE_ENV)
  const config = getRedisConfig()
  console.log('- Redis Host:', config.host)
  console.log('- Allowed IPs:', process.env.ALLOWED_IPS)
}

// Create Redis client with connection handling
const redisClient = new Redis(getRedisConfig())

// Enhanced connection event listeners
redisClient.on('connect', () => {
  console.log('🔄 Redis client connecting...')
})

redisClient.on('ready', () => {
  console.log('✅ Redis client connected and ready!')
  if (isDevelopment) {
    console.log('📍 Connected to Redis at:', process.env.REDIS_URL?.replace(/:[^:@]*@/, ':****@'))
  }
})

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err)
  if (isDevelopment) {
    console.log('🔍 Debug Info:')
    console.log('- Error Name:', err.name)
    console.log('- Error Message:', err.message)
    console.log('- Stack Trace:', err.stack)
  }
})

redisClient.on('close', () => {
  console.log('🔒 Redis client disconnected')
})

// Wait for connection before testing
const waitForConnection = async () => {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Redis connection timeout'))
    }, 5000)

    redisClient.once('ready', () => {
      clearTimeout(timeout)
      resolve()
    })

    redisClient.once('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

// Enhanced startup check for development
if (isDevelopment) {
  waitForConnection()
    .then(() => redisClient.ping())
    .then(() => {
      console.log('✅ Redis connection test successful')
      console.log('🎉 Redis is ready for use!')
    })
    .catch((err) => {
      console.error('❌ Redis connection test failed:', err)
      console.log('\n🔍 Troubleshooting Tips:')
      console.log('1. Check if your IP is allowed:', process.env.ALLOWED_IPS)
      console.log('2. Verify Redis URL format is correct')
      console.log('3. Ensure AWS security group allows inbound on port 6380')
      console.log('4. Check if TLS/SSL is properly configured\n')
    })
}

export const redis = redisClient 