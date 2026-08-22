import 'server-only'

import { prisma } from '@/lib/db'
import { requireUser } from '@/data/session'
import { jstDateString } from '@/lib/date'
import { NotAllowedError, isAlreadyCheckedIn, isDailySeqConflict } from '@/lib/errors'
import type { ActionResult } from '@/lib/validate'

export async function checkInForUser(userId: string, habitId: string): Promise<ActionResult> {
  const today = jstDateString(new Date())

  try {
    await prisma.$transaction(async (tx) => {
      // 他人の習慣なら 0 件になり、複合外部キーにより HabitLog も作れない
      const habit = await tx.habit.findFirst({
        where: { id: habitId, userId, archivedAt: null },
        select: { id: true },
      })
      if (!habit) throw new NotAllowedError()

      const log = await tx.habitLog.create({
        data: { userId, habitId, date: new Date(`${today}T00:00:00Z`) },
        select: { id: true },
      })

      // 未使用の最小 dailySeq を選ぶ。0 行なら本日の上限。
      // 「その日の件数 +1」で決めると、取り消しで穴が空いたとき（1 と 3 が残る）に
      // 常に 3 を選んで衝突し続ける。
      await tx.$executeRaw`
        INSERT INTO "Ticket" ("id","userId","habitLogId","earnedDate","dailySeq")
        SELECT gen_random_uuid()::text, ${userId}, ${log.id}, ${today}::date, s
        FROM generate_series(1, 3) AS s
        WHERE NOT EXISTS (
          SELECT 1 FROM "Ticket" t
          WHERE t."userId" = ${userId}
            AND t."earnedDate" = ${today}::date
            AND t."dailySeq" = s
        )
        ORDER BY s
        LIMIT 1
      `
    })
    return { ok: true }
  } catch (e) {
    if (isAlreadyCheckedIn(e)) return { ok: false, message: '今日はすでにチェック済みです' }
    if (e instanceof NotAllowedError) return { ok: false, message: '操作できませんでした' }
    throw e
  }
}

/** セッションを解決して checkInForUser に渡すだけ。 */
export async function checkIn(habitId: string): Promise<ActionResult> {
  const user = await requireUser()
  return checkInForUser(user.id, habitId)
}

/**
 * PostgreSQL では一意制約違反が起きた時点でトランザクション全体がアボート状態になり、
 * 内側では回復できない。だからリトライはトランザクションの外に置く。
 */
export async function checkInForUserWithRetry(
  userId: string,
  habitId: string,
): Promise<ActionResult> {
  for (let i = 0; i < 3; i++) {
    try {
      return await checkInForUser(userId, habitId)
    } catch (e) {
      if (!isDailySeqConflict(e)) throw e
    }
  }
  return { ok: false, message: 'しばらく待ってからもう一度お試しください' }
}

export async function checkInWithRetry(habitId: string): Promise<ActionResult> {
  const user = await requireUser()
  return checkInForUserWithRetry(user.id, habitId)
}
