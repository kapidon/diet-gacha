import { prisma } from '@/lib/db'

/**
 * resetDb は user を含む全テーブルを無条件に TRUNCATE する。
 * DATABASE_URL が一時的に本番（Neon）を指した状態で npm test を実行すると
 * 本番データが消えるので、テスト DB であることが URL から確認できないなら実行を止める。
 */
function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  const isLocalTestDb = /localhost|127\.0\.0\.1/.test(url) && url.includes('diet_gacha_test')
  if (!isLocalTestDb) {
    throw new Error(`resetDb はテスト DB 以外では実行しない: ${url}`)
  }
}

/**
 * テスト間で状態を持ち越さない。
 * TRUNCATE ... CASCADE が波及するのは「参照している側」なので、
 * user を消さない限り2回目の実行で email が衝突する。
 * テーブル名は Better Auth の生成結果（@@map による小文字）に合わせる。
 */
export async function resetDb() {
  assertTestDatabase()
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "UserCard", "GachaResult", "Ticket", "HabitLog", "Habit", "ShareLink",
      "user", "session", "account", "verification"
    RESTART IDENTITY CASCADE
  `)
}

export async function createUser(email: string) {
  const id = crypto.randomUUID()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $2, false, now(), now())`,
    id,
    email,
  )
  return { id }
}
