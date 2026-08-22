import 'server-only'

import { prisma } from '@/lib/db'
import { requireUser } from '@/data/session'
import { validateHabit, type ActionResult, type HabitInput } from '@/lib/validate'

/** 必要な項目だけを返す。Prisma のモデルをそのまま外へ出さない。 */
export async function listHabits() {
  const user = await requireUser()
  return prisma.habit.findMany({
    where: { userId: user.id, archivedAt: null },
    select: { id: true, name: true, daysOfWeek: true },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createHabit(input: HabitInput): Promise<ActionResult> {
  const user = await requireUser()
  const v = validateHabit(input)
  if (!v.ok) return v

  await prisma.habit.create({
    data: { userId: user.id, name: input.name.trim(), daysOfWeek: input.daysOfWeek },
  })
  return { ok: true }
}

export async function updateHabit(id: string, input: HabitInput): Promise<ActionResult> {
  const user = await requireUser()
  const v = validateHabit(input)
  if (!v.ok) return v

  // userId で絞ることで、他人の習慣は 0 件になり更新されない。
  const r = await prisma.habit.updateMany({
    where: { id, userId: user.id, archivedAt: null },
    data: { name: input.name.trim(), daysOfWeek: input.daysOfWeek },
  })
  if (r.count === 0) return { ok: false, message: '操作できませんでした' }
  return { ok: true }
}

/** 物理削除しない。UserCard.viaHabitId が指す記録を失わせないため。 */
export async function archiveHabit(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const r = await prisma.habit.updateMany({
    where: { id, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  if (r.count === 0) return { ok: false, message: '操作できませんでした' }
  return { ok: true }
}
