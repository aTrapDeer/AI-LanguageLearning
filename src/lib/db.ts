import { PrismaClient } from "@prisma/client"
import prismaAdapter from './db-adapter';

/* eslint-disable no-var */
declare global {
  var cachedPrisma: PrismaClient
}
/* eslint-enable no-var */

// Validate DATABASE_URL
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Remove any quotes that might have been accidentally included
const cleanDbUrl = dbUrl.replace(/^["'](.+)["']$/, '$1')
if (cleanDbUrl !== dbUrl) {
  console.warn('DATABASE_URL contained quotes which were removed')
}

// Validate URL format
if (!cleanDbUrl.startsWith('postgresql://') && !cleanDbUrl.startsWith('postgres://')) {
  throw new Error('DATABASE_URL must start with postgresql:// or postgres://')
}

console.log('Using Supabase database through adapter');

// Export the adapter with the Prisma-like interface
export const db = prismaAdapter;

// For backward compatibility
export const prisma = db; 