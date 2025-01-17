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

export let db: PrismaClient

if (process.env.NODE_ENV === "production") {
  console.log('Initializing Prisma Client in production mode')
  console.log('Database URL format:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'))
  
  db = new PrismaClient(prismaClientOptions)
  
  // @ts-expect-error - Prisma types are not correctly handling query events
  db.$on('query', (e: Prisma.QueryEvent) => {
    console.log('Query:', e.query)
    console.log('Duration:', e.duration + 'ms')
  })
} else {
  if (!global.cachedPrisma) {
    console.log('Initializing cached Prisma Client in development mode')
    global.cachedPrisma = new PrismaClient(prismaClientOptions)
  }
  db = global.cachedPrisma
}

export const prisma = db 