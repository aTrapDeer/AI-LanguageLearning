import { NextAuthOptions } from "next-auth"
import { compare } from "bcryptjs"
import { db } from "./db"
import { supabase } from "./supabase"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { SupabaseAdapter } from "./supabase-auth-adapter"
// import { User } from "@prisma/client"

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter(),
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60 // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          learningLanguages: [],
        }
      },
    }),
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Missing credentials")
          }

          // Using supabase directly for credentials login
          const { data: user, error } = await supabase
            .from('users')
            .select('id, email, name, password, learning_languages')
            .eq('email', credentials.email)
            .single();

          if (error) {
            console.error("Database error:", error);
            throw new Error("Error finding user");
          }

          if (!user?.password) {
            throw new Error("Please sign in with Google")
          }

          const isPasswordValid = await compare(credentials.password, user.password)

          if (!isPasswordValid) {
            throw new Error("Invalid credentials")
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            learningLanguages: user.learning_languages || []
          }
        } catch (error) {
          console.error("Auth error:", error)
          throw error
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        return {
          ...token,
          id: user.id,
          learningLanguages: user.learningLanguages || []
        }
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          learningLanguages: token.learningLanguages as string[]
        }
      }
    }
  }
} 