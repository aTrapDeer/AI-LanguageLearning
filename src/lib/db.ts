import { PrismaClient } from "@prisma/client"

/* eslint-disable no-var */
declare global {
  var cachedPrisma: PrismaClient
}
/* eslint-enable no-var */

export let db: PrismaClient
if (process.env.NODE_ENV === "production") {
  db = new PrismaClient()
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient()
  }
  db = global.cachedPrisma
} 