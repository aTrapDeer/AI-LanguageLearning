import { redis } from './redis'

interface SessionData {
  email?: string
  name?: string
  lastActivity?: number
  [key: string]: string | number | undefined
}

export class SessionManager {
  private static instance: SessionManager | null = null
  private readonly SESSION_EXPIRY = 4 * 60 * 60 // 4 hours in seconds
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000 // Run cleanup every hour

  private constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupInactiveSessions(), this.CLEANUP_INTERVAL)
  }

  public static getInstance(): SessionManager {
    if (!this.instance) {
      this.instance = new SessionManager()
    }
    return this.instance
  }

  async createSession(userId: string, data: SessionData): Promise<string | null> {
    try {
      const sessionId = `session:${userId}:${Date.now()}`
      const sessionData = {
        ...data,
        lastActivity: Date.now()
      }
      await redis.set(sessionId, JSON.stringify(sessionData), 'EX', this.SESSION_EXPIRY)
      return sessionId
    } catch (error) {
      console.error('Failed to create session:', error)
      return null
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const data = await redis.get(sessionId)
      if (!data) return null

      const sessionData = JSON.parse(data)
      // Update last activity
      sessionData.lastActivity = Date.now()
      await this.updateSession(sessionId, sessionData)
      return sessionData
    } catch (error) {
      console.error('Failed to get session:', error)
      return null
    }
  }

  async updateSession(sessionId: string, data: SessionData): Promise<boolean> {
    try {
      await redis.set(sessionId, JSON.stringify(data), 'EX', this.SESSION_EXPIRY)
      return true
    } catch (error) {
      console.error('Failed to update session:', error)
      return false
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await redis.del(sessionId)
      return true
    } catch (error) {
      console.error('Failed to delete session:', error)
      return false
    }
  }

  private async cleanupInactiveSessions(): Promise<void> {
    try {
      const keys = await redis.keys('session:*')
      const now = Date.now()
      const inactivityThreshold = 2 * 60 * 60 * 1000 // 2 hours in milliseconds

      for (const key of keys) {
        const data = await redis.get(key)
        if (data) {
          const session = JSON.parse(data)
          if (now - session.lastActivity > inactivityThreshold) {
            await this.deleteSession(key)
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup sessions:', error)
    }
  }
} 