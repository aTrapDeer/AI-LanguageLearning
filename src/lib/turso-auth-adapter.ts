import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";
import {
  createAdapterSession,
  createAdapterUser,
  createAdapterVerificationToken,
  consumeAdapterVerificationToken,
  deleteAdapterSession,
  deleteAdapterUser,
  getAdapterSessionAndUser,
  getAdapterUser,
  getAdapterUserByAccount,
  getAdapterUserByEmail,
  linkAdapterAccount,
  unlinkAdapterAccount,
  updateAdapterSession,
  updateAdapterUser,
} from "./database";

export function TursoAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      return createAdapterUser(user);
    },
    async getUser(id: string) {
      return getAdapterUser(id);
    },
    async getUserByEmail(email: string) {
      return getAdapterUserByEmail(email);
    },
    async getUserByAccount({
      provider,
      providerAccountId,
    }: {
      provider: string;
      providerAccountId: string;
    }) {
      return getAdapterUserByAccount(provider, providerAccountId);
    },
    async updateUser(user: Partial<AdapterUser> & { id: string }) {
      return updateAdapterUser(user);
    },
    async linkAccount(account: AdapterAccount) {
      return linkAdapterAccount(account);
    },
    async unlinkAccount({
      provider,
      providerAccountId,
    }: {
      provider: string;
      providerAccountId: string;
    }) {
      return unlinkAdapterAccount(provider, providerAccountId);
    },
    async createSession(session: AdapterSession) {
      return createAdapterSession(session);
    },
    async getSessionAndUser(sessionToken: string) {
      return getAdapterSessionAndUser(sessionToken);
    },
    async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">) {
      return updateAdapterSession(session);
    },
    async deleteSession(sessionToken: string) {
      return deleteAdapterSession(sessionToken);
    },
    async createVerificationToken(token: VerificationToken) {
      return createAdapterVerificationToken(token);
    },
    async useVerificationToken({
      identifier,
      token,
    }: {
      identifier: string;
      token: string;
    }) {
      return consumeAdapterVerificationToken(identifier, token);
    },
    async deleteUser(userId: string) {
      return deleteAdapterUser(userId);
    },
  };
}
