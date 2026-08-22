import { PrismaPg } from '@prisma/adapter-pg'
// `auth` CLI が jiti でこのファイルを読むとき tsconfig の `@/` エイリアスを解決できないため、
// 相対 import にしている。
import { PrismaClient } from '../generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
