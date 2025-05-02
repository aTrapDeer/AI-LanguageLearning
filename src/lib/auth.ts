import { NextAuthOptions } from "next-auth"
import { compare } from "bcryptjs"
// import { db } from "./db"
import { supabase } from "./supabase"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { SupabaseAdapter } from "./supabase-auth-adapter"

// Extended types for our custom user properties
interface CustomUser {
  id: string;
  learningLanguages?: string[];
  accountSetup?: boolean;
}

// Extend the existing types
declare module "next-auth" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends CustomUser {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AdapterUser extends CustomUser {}
  interface Session {
    user: CustomUser & {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
}

declare module "next-auth/jwt" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface JWT extends CustomUser {}
}

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter(),
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60 // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  // Add better cookie configuration to prevent conflicts
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" 
        ? `__Secure-next-auth.session-token` 
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 // 24 hours
      }
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production"
        ? `__Secure-next-auth.callback-url`
        : `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === "production"
      }
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production"
        ? `__Host-next-auth.csrf-token`
        : `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === "production"
      }
    }
  },
  debug: process.env.NODE_ENV === "development",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        console.log("Google profile received:", JSON.stringify(profile, null, 2));
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          learningLanguages: [],
          accountSetup: false
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
          console.log("Authorizing with credentials");
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Missing credentials")
          }

          // Using supabase directly for credentials login
          const { data: user, error } = await supabase
            .from('users')
            .select('id, email, name, password, learning_languages, account_setup')
            .eq('email', credentials.email)
            .single();

          console.log("User data from DB:", { ...user, password: '[REDACTED]' });

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

          // Add additional fields for checks later
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            learningLanguages: user.learning_languages || [],
            accountSetup: user.account_setup
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
      console.log("JWT callback - Token before:", JSON.stringify(token, null, 2));
      console.log("JWT callback - User:", user ? JSON.stringify({ ...user, password: undefined }, null, 2) : null);
      console.log("JWT callback - Account:", account ? JSON.stringify(account, null, 2) : null);
      
      if (account && user) {
        const updatedToken = {
          ...token,
          id: user.id,
          learningLanguages: user.learningLanguages || [],
          accountSetup: user.accountSetup
        };
        console.log("JWT callback - Token after:", JSON.stringify(updatedToken, null, 2));
        return updatedToken;
      }
      
      console.log("JWT callback - Returning unchanged token");
      return token
    },
    async session({ session, token }) {
      console.log("Session callback - Token:", JSON.stringify(token, null, 2));
      console.log("Session callback - Session before:", JSON.stringify(session, null, 2));
      
      if (!token || !token.id) {
        console.warn("Session callback - Token missing ID!");
      }
      
      const updatedSession = {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          learningLanguages: token.learningLanguages as string[] || [],
          accountSetup: token.accountSetup
        }
      };
      
      console.log("Session callback - Session after:", JSON.stringify(updatedSession, null, 2));
      return updatedSession;
    }
  }
} 