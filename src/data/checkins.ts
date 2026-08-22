import 'server-only'

import { prisma } from '@/lib/db'
import { requireUser } from '@/data/session'
import {
  calcStreak,
  calcWeeklyStreak,
  isoWeekStart,
  jstDateString,
  jstWeekday,
} from '@/lib/date'
import { NotAllowedError, isAlreadyCheckedIn, isDailySeqConflict } from '@/lib/errors'
import type { ActionResult } from '@/lib/validate'

/** 今日の画面が必要とするものを一度に返す。 */
export async function getTodayView() {
  const user = await requireUser()
  const today = jstDateString(new Date())
  const todayWeekday = jstWeekday(today)

  // 3つのクエリは互いに独立しているので並行に投げる。順に await すると待ち時間が積み上がる。
  const [habits, logs, ticketCount] = await Promise.all([
    prisma.habit.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, daysOfWeek: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.habitLog.findMany({
      where: { userId: user.id },
      select: { habitId: true, date: true },
    }),
    prisma.ticket.count({ where: { userId: user.id, consumedAt: null } }),
  ])

  // DB の date 型は UTC 0時の Date として返るので、'YYYY-MM-DD' に揃えてから純粋関数に渡す
  const allDates = logs.map((l) => l.date.toISOString().slice(0, 10))
  const doneToday = new Set(
    logs.filter((l) => l.date.toISOString().slice(0, 10) === today).map((l) => l.habitId),
  )

  return {
    today,
    streak: calcStreak(allDates, today),
    ticketCount,
    habits: habits.map((h) => {
      const dates = logs
        .filter((l) => l.habitId === h.id)
        .map((l) => l.date.toISOString().slice(0, 10))
      const thisWeek = isoWeekStart(today)
      return {
        id: h.id,
        name: h.name,
        isToday: h.daysOfWeek.includes(todayWeekday),
        doneToday: doneToday.has(h.id),
        weekDone: dates.filter((d) => isoWeekStart(d) === thisWeek).length,
        // 週の目標回数は daysOfWeek.length から求める。カラムには持たない。
        weekTarget: h.daysOfWeek.length,
        weeklyStreak: calcWeeklyStreak(dates, h.daysOfWeek.length, today),
      }
    }),
  }
}

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

/**
 * Ticket → HabitLog は Restrict なので、Ticket を先に消す。
 * 消費済み（GachaResult が存在する）チケットは GachaResult → Ticket の Restrict により
 * 削除がブロックされる。DB 側でも守られるが、アプリ側でも事前に判定して意味のあるエラーを返す。
 */
export async function undoCheckInForUser(userId: string, habitId: string): Promise<ActionResult> {
  const today = jstDateString(new Date())

  return prisma.$transaction(async (tx) => {
    const log = await tx.habitLog.findFirst({
      where: { userId, habitId, date: new Date(`${today}T00:00:00Z`) },
      select: { id: true, ticket: { select: { id: true, consumedAt: true } } },
    })
    if (!log) return { ok: false, message: '取り消せる記録がありません' }
    if (log.ticket?.consumedAt) {
      return { ok: false, message: 'このチケットは使用済みのため取り消せません' }
    }

    if (log.ticket) await tx.ticket.delete({ where: { id: log.ticket.id } })
    await tx.habitLog.delete({ where: { id: log.id } })
    return { ok: true }
  })
}

export async function undoCheckIn(habitId: string): Promise<ActionResult> {
  const user = await requireUser()
  return undoCheckInForUser(user.id, habitId)
}
