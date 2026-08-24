import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { isAlreadyCheckedIn, isDailySeqConflict } from '@/lib/errors'
import { jstDateString } from '@/lib/date'
import { resetDb, createUser } from './helpers'

// getTodayView は内部で requireUser() を呼ぶ（habits.test.ts と同じ理由でモックする）。
let currentUserId = ''

vi.mock('@/data/session', () => ({
  requireUser: async () => ({ id: currentUserId }),
}))

const { checkInForUser, checkInForUserWithRetry, undoCheckInForUser, getTodayView } =
  await import('@/data/checkins')

// テストからは DAL の「セッションに依存しない側」を直接呼ぶ。
const checkInAs = checkInForUser
const checkInWithRetryAs = checkInForUserWithRetry
const undoCheckInAs = undoCheckInForUser

describe('チケット発行', () => {
  beforeEach(resetDb)

  it('1日に4件達成してもチケットは3枚で止まる', async () => {
    const user = await createUser('a@example.com')
    const habitIds: string[] = []
    for (let i = 0; i < 4; i++) {
      const h = await prisma.habit.create({
        data: { userId: user.id, name: `h${i}`, daysOfWeek: ['MON'] },
        select: { id: true },
      })
      habitIds.push(h.id)
    }

    for (const id of habitIds) await checkInAs(user.id, id)

    const count = await prisma.ticket.count({ where: { userId: user.id } })
    expect(count).toBe(3)
  })

  it('同じ習慣を並行して2回チェックしてもチケットは1枚', async () => {
    const user = await createUser('c@example.com')
    const id = await createHabit(user.id)

    await Promise.allSettled([checkInAs(user.id, id), checkInAs(user.id, id)])

    expect(await prisma.ticket.count({ where: { userId: user.id } })).toBe(1)
    expect(await prisma.habitLog.count({ where: { userId: user.id } })).toBe(1)
  })

  // 上のテストは HabitLog(habitId,date) の競合であって、dailySeq の競合ではない。
  // リトライ経路を通すには、異なる2習慣が同じ空き枠を同時に取りに行く必要がある。
  //
  // 5回反復するのは、Promise.all のタイミング任せでは競合が起きないまま PASS しうるため。
  // リトライ回数を数える版を 30 trial 実測したところ 29 回で実際に競合が起きたので、
  // この構成では1回でもほぼ確実に踏むが、余裕を見て5回にしてある。
  // 「リトライが起きたこと」自体は assert していない。assert するには回数を数える仕掛けを
  // 本番コードに入れる必要があり、テストのためだけに本番の形を歪めたくないため。
  it('異なる2習慣を並行チェックすると両方成功し dailySeq が 1 と 2 になる', async () => {
    for (let trial = 0; trial < 5; trial++) {
      await resetDb()
      const user = await createUser('e@example.com')
      const [a, b] = await createHabits(user.id, 2)

      const rs = await Promise.all([
        checkInWithRetryAs(user.id, a!),
        checkInWithRetryAs(user.id, b!),
      ])

      expect(rs.every((r) => r.ok)).toBe(true)
      expect(await prisma.habitLog.count({ where: { userId: user.id } })).toBe(2)
      const seqs = await prisma.ticket.findMany({
        where: { userId: user.id },
        select: { dailySeq: true },
        orderBy: { dailySeq: 'asc' },
      })
      expect(seqs.map((s) => s.dailySeq)).toEqual([1, 2])
    }
  })

  it('取り消して再チェックしても dailySeq が衝突しない', async () => {
    const user = await createUser('b@example.com')
    const ids = await createHabits(user.id, 4)

    for (const id of ids.slice(0, 3)) await checkInAs(user.id, id)
    await undoCheckInAs(user.id, ids[1]!)
    const r = await checkInAs(user.id, ids[3]!)

    expect(r.ok).toBe(true)
    const seqs = await prisma.ticket.findMany({
      where: { userId: user.id },
      select: { dailySeq: true },
      orderBy: { dailySeq: 'asc' },
    })
    expect(seqs.map((s) => s.dailySeq)).toEqual([1, 2, 3])
  })
})

describe('今日のチケット上限', () => {
  beforeEach(resetDb)

  it('今日3枚獲得していれば todayLimitReached が true になる', async () => {
    const user = await createUser('limit-a@example.com')
    const ids = await createHabits(user.id, 3)
    for (const id of ids) await checkInAs(user.id, id)

    currentUserId = user.id
    const view = await getTodayView()

    expect(view.todayEarned).toBe(3)
    expect(view.todayLimitReached).toBe(true)
  })

  it('未使用チケットの残高が3枚以上あっても、今日の獲得が3枚未満なら上限扱いにしない', async () => {
    // 前日以前に貯めた未使用チケットが多くても、今日の判定には影響しないことを確かめる。
    // Ticket.habitLogId は 1:1 なので、3枚分の HabitLog を別々に作る。
    const user = await createUser('limit-b@example.com')
    const habitIds = await createHabits(user.id, 3)
    for (let i = 0; i < 3; i++) {
      const log = await prisma.habitLog.create({
        data: { userId: user.id, habitId: habitIds[i]!, date: new Date('2026-01-01T00:00:00Z') },
        select: { id: true },
      })
      await prisma.$executeRaw`
        INSERT INTO "Ticket" ("id","userId","habitLogId","earnedDate","dailySeq")
        VALUES (gen_random_uuid()::text, ${user.id}, ${log.id}, '2026-01-01'::date, ${i + 1})
      `
    }

    currentUserId = user.id
    const view = await getTodayView()

    expect(view.ticketCount).toBeGreaterThanOrEqual(3)
    expect(view.todayEarned).toBe(0)
    expect(view.todayLimitReached).toBe(false)
  })
})

describe('他人の習慣は操作できない', () => {
  beforeEach(resetDb)

  it('checkInForUser は他人の習慣にチェックできない', async () => {
    const userA = await createUser('cross-a@example.com')
    const userB = await createUser('cross-b@example.com')
    const habitId = await createHabit(userB.id)

    const r = await checkInAs(userA.id, habitId)

    expect(r).toEqual({ ok: false, message: '操作できませんでした' })
    expect(await prisma.habitLog.count({ where: { userId: userB.id } })).toBe(0)
    expect(await prisma.ticket.count({ where: { userId: userB.id } })).toBe(0)
  })

  it('undoCheckInForUser は他人の達成記録を取り消せない', async () => {
    const userA = await createUser('cross-c@example.com')
    const userB = await createUser('cross-d@example.com')
    const habitId = await createHabit(userB.id)
    await checkInAs(userB.id, habitId)

    const r = await undoCheckInAs(userA.id, habitId)

    expect(r).toEqual({ ok: false, message: '取り消せる記録がありません' })
    expect(await prisma.habitLog.count({ where: { userId: userB.id } })).toBe(1)
    expect(await prisma.ticket.count({ where: { userId: userB.id } })).toBe(1)
  })
})

describe('チェックの取り消し', () => {
  beforeEach(resetDb)

  it('未消費チケットが紐づくチェックは取り消せる', async () => {
    const user = await createUser('d@example.com')
    const id = await createHabit(user.id)
    await checkInAs(user.id, id)

    const r = await undoCheckInAs(user.id, id)

    expect(r.ok).toBe(true)
    expect(await prisma.habitLog.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.ticket.count({ where: { userId: user.id } })).toBe(0)
  })
})

// エラー判定が壊れたら、業務ロジックのテストより先にここが落ちるようにする。
// Prisma を上げたときに meta の形が変わっても気づける。
describe('一意制約違反の形状', () => {
  beforeEach(resetDb)

  it('Prisma API 経由の HabitLog 衝突を isAlreadyCheckedIn が拾う', async () => {
    const user = await createUser('f@example.com')
    const id = await createHabit(user.id)
    await checkInAs(user.id, id)

    const r = await checkInAs(user.id, id)
    expect(r).toEqual({ ok: false, message: '今日はすでにチェック済みです' })
  })

  it('raw SQL 経由の Ticket 衝突を isDailySeqConflict が拾い、isAlreadyCheckedIn は拾わない', async () => {
    const user = await createUser('g@example.com')
    const id = await createHabit(user.id)
    await checkInAs(user.id, id)

    // 同じ (userId, earnedDate, dailySeq) をもう一度入れて衝突させる
    const err = await captureError(() => insertDuplicateTicket(user.id))

    expect(isDailySeqConflict(err)).toBe(true)
    expect(isAlreadyCheckedIn(err)).toBe(false)
  })
})

/**
 * 1件だけ作るとき用。noUncheckedIndexedAccess 下では ids[0] が string | undefined になるが、
 * n=1 で呼ぶ以上そこには必ず要素がある。`!` を各テストに撒かず、ここだけに閉じ込める。
 */
async function createHabit(userId: string): Promise<string> {
  const [id] = await createHabits(userId, 1)
  return id!
}

async function createHabits(userId: string, n: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const h = await prisma.habit.create({
      data: { userId, name: `h${i}`, daysOfWeek: ['MON'] },
      select: { id: true },
    })
    ids.push(h.id)
  }
  return ids
}

async function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn()
  } catch (e) {
    return e
  }
  throw new Error('エラーが発生しませんでした')
}

/**
 * すでに使われている dailySeq=1 の枠を、別の HabitLog から奪いに行く。
 * habitLogId は新しいものを使う。そうしないと Ticket.habitLogId の一意制約と
 * どちらが先に違反するか分からなくなる。
 */
async function insertDuplicateTicket(userId: string) {
  const today = jstDateString(new Date())
  const habitId = await createHabit(userId)
  const log = await prisma.habitLog.create({
    data: { userId, habitId, date: new Date(`${today}T00:00:00Z`) },
    select: { id: true },
  })
  await prisma.$executeRaw`
    INSERT INTO "Ticket" ("id","userId","habitLogId","earnedDate","dailySeq")
    VALUES (gen_random_uuid()::text, ${userId}, ${log.id}, ${today}::date, 1)
  `
}
