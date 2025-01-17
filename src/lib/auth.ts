import { NextAuthOptions } from "next-auth"
import { db } from "./db"
import { compare } from "bcryptjs"
import { SessionManager } from "./session-manager"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60 // 24 hours
  },
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.error("Missing credentials")
            throw new Error("Missing credentials")
          }

          // Test database connection
          try {
            await db.$connect()
            console.log("Database connection successful")
          } catch (dbError) {
            console.error("Database connection failed:", dbError)
            throw new Error("Database connection failed")
          }

          const user = await db.user.findUnique({
            where: {
              email: credentials.email
            },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              learningLanguages: true
            }
          }).catch(error => {
            console.error("Database query failed:", error)
            throw error
          })

          if (!user) {
            console.error("User not found:", credentials.email)
            throw new Error("Invalid credentials")
          }

          const isPasswordValid = await compare(credentials.password, user.password)

          if (!isPasswordValid) {
            console.error("Invalid password for user:", credentials.email)
            throw new Error("Invalid credentials")
          }

          // Return user without password
          const { password: _, ...userWithoutPassword } = user
          return userWithoutPassword
        } catch (error) {
          console.error("Authorization error:", error)
          throw error
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name

        // Try to create Redis session but don't fail if it errors
        try {
          const sessionManager = SessionManager.getInstance()
          const sessionId = await sessionManager.createSession(user.id, {
            email: user.email || undefined,
            name: user.name || undefined
          })
          if (sessionId) {
            token.sessionId = sessionId
          }
        } catch (error) {
          console.warn('Failed to create Redis session:', error)
          // Continue without Redis session
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id?.toString() || ''
        session.user.email = token.email || ''
        session.user.name = token.name || ''
        
        // Try to get Redis session data but don't fail if it errors
        if (token.sessionId) {
          try {
            const sessionManager = SessionManager.getInstance()
            const sessionData = await sessionManager.getSession(token.sessionId as string)
            if (sessionData) {
              session.user = { ...session.user, ...sessionData }
            }
          } catch (error) {
            console.warn('Failed to get Redis session:', error)
            // Continue with basic session data
          }
        }
      }
      return session
    }
  },
  pages: {
    signIn: '/login'
  },
  events: {
    async signOut({ token }) {
      // Try to delete Redis session but don't fail if it errors
      if (token?.sessionId) {
        try {
          const sessionManager = SessionManager.getInstance()
          await sessionManager.deleteSession(token.sessionId as string)
        } catch (error) {
          console.warn('Failed to delete Redis session:', error)
        }
      }
    }
  }
} 