import type {
  CreateChatInput,
  CreateLearningInput,
  CreateProgressInput,
  CreateUserInput,
  DatabaseChat,
  DatabaseLearning,
  DatabaseProgress,
  DatabaseUser,
  UpdateProgressInput,
  UpdateUserInput,
} from "./database";
import * as database from "./database";

// This adapter maintains the existing db.user/db.progress surface while using Turso.
export const dbAdapter = {
  user: {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id) {
        return database.getUserById(where.id as string);
      } else if (where.email) {
        return database.getUserByEmail(where.email as string);
      }
      return null;
    },
    create: async ({ data }: { data: CreateUserInput }) => {
      return database.createUser(data);
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: UpdateUserInput }) => {
      if (where.id) {
        return database.updateUser(where.id as string, data);
      }
      return null;
    }
  },
  
  progress: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.userId && where.language) {
        return database.getProgress(where.userId as string, where.language as string);
      }
      return null;
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: UpdateProgressInput }) => {
      if (where.id) {
        return database.updateProgress(where.id as string, data);
      }
      return null;
    },
    create: async ({ data }: { data: CreateProgressInput }) => {
      return database.createProgress(data);
    },
    getAllForUser: async (userId: string) => {
      return database.getAllUserProgress(userId);
    }
  },

  chat: {
    create: async ({ data }: { data: CreateChatInput }) => {
      return database.createChatMessage(data);
    },
    findMany: async ({ where }: { where: Record<string, unknown>; orderBy?: unknown }) => {
      if (where.userId && where.language) {
        return database.getChatHistory(where.userId as string, where.language as string);
      }
      return [];
    }
  },

  learning: {
    create: async ({ data }: { data: CreateLearningInput }) => {
      return database.createLearningItem(data);
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.userId && where.language) {
        return database.getLearningItems(where.userId as string, where.language as string);
      }
      return [];
    }
  }
};

export type DbUser = DatabaseUser;
export type DbProgress = DatabaseProgress;
export type DbLearning = DatabaseLearning;
export type DbChat = DatabaseChat;

export default dbAdapter;