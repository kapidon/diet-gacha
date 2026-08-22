import { prisma } from '@/lib/db'

/**
 * テスト間で状態を持ち越さない。
 * TRUNCATE ... CASCADE が波及するのは「参照している側」なので、
 * user を消さない限り2回目の実行で email が衝突する。
 * テーブル名は Better Auth の生成結果（@@map による小文字）に合わせる。
 */
export async function resetDb() {
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
