import { redis } from './redis'

interface SessionData {
  userId: string
  email?: string
  name?: string
  lastActivity: number
  [key: string]: string | number | undefined
}

export class RedisSessionStore {
  private redis: typeof redis

  constructor() {
    this.redis = redis
  }

  async createSession(userId: string, sessionData: SessionData) {
    const sessionId = `session:${userId}:${Date.now()}`
    const sessionExpiry = 24 * 60 * 60 // 24 hours in seconds

    await this.redis.setex(
      sessionId,
      sessionExpiry,
      JSON.stringify(sessionData)
    )

    return sessionId
  }

  async getSession(sessionId: string) {
    const data = await this.redis.get(sessionId)
    if (!data) return null

    try {
      return JSON.parse(data) as SessionData
    } catch {
      return null
    }
  }

  async updateSession(sessionId: string, sessionData: SessionData) {
    const currentTTL = await this.redis.ttl(sessionId)
    if (currentTTL < 0) return false

    await this.redis.setex(
      sessionId,
      currentTTL,
      JSON.stringify(sessionData)
    )
    return true
  }

  async deleteSession(sessionId: string) {
    await this.redis.del(sessionId)
  }
} 