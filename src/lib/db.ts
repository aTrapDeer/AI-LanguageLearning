import { PrismaClient, Prisma } from "@prisma/client"

/* eslint-disable no-var */
declare global {
  var cachedPrisma: PrismaClient
}
/* eslint-enable no-var */

const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
  ] as Prisma.LogDefinition[],
}

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

export let db: PrismaClient

if (process.env.NODE_ENV === "production") {
  console.log('Initializing Prisma Client in production mode')
  console.log('Database URL format:', cleanDbUrl.replace(/:[^:@]*@/, ':****@'))
  
  try {
    db = new PrismaClient({
      ...prismaClientOptions,
      datasources: {
        db: {
          url: cleanDbUrl
        }
      }
    })
    
    // @ts-expect-error - Prisma types are not correctly handling query events
    db.$on('query', (e: Prisma.QueryEvent) => {
      console.log('Query:', e.query)
      console.log('Duration:', e.duration + 'ms')
    })
  } catch (error) {
    console.error('Failed to initialize Prisma Client:', error)
    throw error
  }
} else {
  if (!global.cachedPrisma) {
    console.log('Initializing cached Prisma Client in development mode')
    try {
      global.cachedPrisma = new PrismaClient({
        ...prismaClientOptions,
        datasources: {
          db: {
            url: cleanDbUrl
          }
        }
      })
    } catch (error) {
      console.error('Failed to initialize cached Prisma Client:', error)
      throw error
    }
  }
  db = global.cachedPrisma
}

export const prisma = db 