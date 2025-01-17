import { PrismaClient, Prisma } from "@prisma/client"

/* eslint-disable no-var */
declare global {
  var cachedPrisma: PrismaClient
}
/* eslint-enable no-var */

const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
  ] as Prisma.LogDefinition[],
}

export let db: PrismaClient
if (process.env.NODE_ENV === "production") {
  db = new PrismaClient(prismaClientOptions)
  
  // Add event listeners for logging
  db.$on('error', (e) => {
    console.error('Prisma Error:', e)
  })
  
  db.$on('warn', (e) => {
    console.warn('Prisma Warning:', e)
  })
  
  db.$on('info', (e) => {
    console.log('Prisma Info:', e)
  })
  
  db.$on('query', (e) => {
    console.log('Prisma Query:', e)
  })
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient(prismaClientOptions)
  }
  db = global.cachedPrisma
} 