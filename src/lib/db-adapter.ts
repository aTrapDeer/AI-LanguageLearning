import * as supabaseDb from './supabase-db';
import { User, Progress, Learning, Chat } from '@prisma/client';

// This adapter maintains Prisma-like interface but uses Supabase under the hood
export const prismaAdapter = {
  user: {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id) {
        return supabaseDb.getUserById(where.id as string);
      } else if (where.email) {
        return supabaseDb.getUserByEmail(where.email as string);
      }
      return null;
    },
    create: async ({ data }: { data: Omit<User, 'id' | 'createdAt' | 'updatedAt'> }) => {
      return supabaseDb.createUser(data);
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Partial<User> }) => {
      if (where.id) {
        return supabaseDb.updateUser(where.id as string, data);
      }
      return null;
    }
  },
  
  progress: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.userId && where.language) {
        return supabaseDb.getProgress(where.userId as string, where.language as string);
      }
      return null;
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Progress> }) => {
      if (where.id) {
        return supabaseDb.updateProgress(where.id as string, data);
      }
      return null;
    },
    create: async ({ data }: { data: Omit<Progress, 'id' | 'createdAt' | 'updatedAt'> }) => {
      return supabaseDb.createProgress(data);
    },
    getAllForUser: async (userId: string) => {
      return supabaseDb.getAllUserProgress(userId);
    }
  },

  chat: {
    create: async ({ data }: { data: Omit<Chat, 'id' | 'createdAt'> }) => {
      return supabaseDb.createChatMessage(data);
    },
    findMany: async ({ where }: { where: Record<string, unknown>; orderBy?: unknown }) => {
      if (where.userId && where.language) {
        return supabaseDb.getChatHistory(where.userId as string, where.language as string);
      }
      return [];
    }
  },

  learning: {
    create: async ({ data }: { data: Omit<Learning, 'id' | 'createdAt' | 'updatedAt'> }) => {
      return supabaseDb.createLearningItem(data);
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.userId && where.language) {
        return supabaseDb.getLearningItems(where.userId as string, where.language as string);
      }
      return [];
    }
  }
  
  // Add more models and methods as needed to match your Prisma usage
};

// Use this adapter instead of Prisma in your code
export default prismaAdapter; 