import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    learningLanguages: string[];
    accountSetup?: boolean;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      learningLanguages: string[];
      accountSetup?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    learningLanguages?: string[];
    accountSetup?: boolean;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    learningLanguages?: string[];
    accountSetup?: boolean;
  }
}