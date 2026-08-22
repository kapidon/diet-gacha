import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser } from './helpers'

/**
 * habits.ts の関数は userId を引数で受け取らず、内部で requireUser() を呼んで
 * セッションから決める（checkins.ts の *ForUser 版のような分離が無い）。
 * テストから「別のユーザーとして呼ぶ」ことができないため、requireUser をモックして
 * 呼び出しごとに任意のユーザー ID を返せるようにする。
 *
 * habits.ts に *ForUser 版を新設する案は避けた。プロダクションコードをテストのためだけに
 * 変えることになり、checkIn の削除（他人のリソースを DB の where 句だけで弾く設計）とも逆行するため。
 */
let currentUserId = ''

vi.mock('@/data/session', () => ({
  requireUser: async () => ({ id: currentUserId }),
}))

const { createHabit, updateHabit, archiveHabit } = await import('@/data/habits')

describe('他人の習慣は操作できない', () => {
  beforeEach(resetDb)

  it('updateHabit は他人の習慣を更新できない', async () => {
    const userA = await createUser('habits-a@example.com')
    const userB = await createUser('habits-b@example.com')

    currentUserId = userB.id
    const created = await createHabit({ name: '元の名前', daysOfWeek: ['MON'] })
    expect(created.ok).toBe(true)
    const habit = await prisma.habit.findFirstOrThrow({ where: { userId: userB.id } })

    currentUserId = userA.id
    const r = await updateHabit(habit.id, { name: '書き換え', daysOfWeek: ['TUE'] })

    expect(r).toEqual({ ok: false, message: '操作できませんでした' })
    const after = await prisma.habit.findUniqueOrThrow({ where: { id: habit.id } })
    expect(after.name).toBe('元の名前')
    expect(after.daysOfWeek).toEqual(['MON'])
  })

  it('archiveHabit は他人の習慣をアーカイブできない', async () => {
    const userA = await createUser('habits-c@example.com')
    const userB = await createUser('habits-d@example.com')

    currentUserId = userB.id
    await createHabit({ name: '筋トレ', daysOfWeek: ['MON'] })
    const habit = await prisma.habit.findFirstOrThrow({ where: { userId: userB.id } })

    currentUserId = userA.id
    const r = await archiveHabit(habit.id)

    expect(r).toEqual({ ok: false, message: '操作できませんでした' })
    const after = await prisma.habit.findUniqueOrThrow({ where: { id: habit.id } })
    expect(after.archivedAt).toBeNull()
  })
})
