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
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials")
        }

        const user = await db.user.findUnique({
          where: {
            email: credentials.email
          },
          select: {
            id: true,
            email: true,
            name: true,
            password: true
          }
        })

        if (!user) {
          throw new Error("Invalid credentials")
        }

        const isPasswordValid = await compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error("Invalid credentials")
        }

        // Return user without password
        const { password: _, ...userWithoutPassword } = user
        return userWithoutPassword
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