/* eslint-disable @typescript-eslint/no-unused-vars */
import NextAuth from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface User {
    id: string
    email: string
    name: string | null
    learningLanguages: string[]
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      learningLanguages: string[]
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email: string
    name: string | null
    learningLanguages: string[]
  }
} 