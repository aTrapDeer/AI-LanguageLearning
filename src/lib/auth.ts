import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getUserByEmail, getUserById } from "./database";
import { TursoAdapter } from "./turso-auth-adapter";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) {
        throw new Error("Missing credentials");
      }

      const user = await getUserByEmail(credentials.email);
      if (!user) {
        throw new Error("Invalid credentials");
      }

      if (!user.password) {
        throw new Error("Please sign in with Google");
      }

      const isPasswordValid = await compare(credentials.password, user.password);
      if (!isPasswordValid) {
        throw new Error("Invalid credentials");
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        learningLanguages: user.learningLanguages,
        accountSetup: user.accountSetup,
      };
    },
  }),
];

if (googleClientId && googleClientSecret) {
  providers.unshift(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          learningLanguages: [],
          accountSetup: false,
        };
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: TursoAdapter(),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.learningLanguages = user.learningLanguages ?? [];
        token.accountSetup = user.accountSetup ?? false;
      }

      if (typeof token.id === "string") {
        const currentUser = await getUserById(token.id);
        if (currentUser) {
          token.id = currentUser.id;
          token.email = currentUser.email;
          token.name = currentUser.name;
          token.picture = currentUser.image ?? undefined;
          token.learningLanguages = currentUser.learningLanguages;
          token.accountSetup = currentUser.accountSetup;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.learningLanguages = (token.learningLanguages as string[]) ?? [];
        session.user.accountSetup = Boolean(token.accountSetup);
      }

      return session;
    },
  },
};