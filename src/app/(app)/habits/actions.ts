'use server'

import { revalidatePath } from 'next/cache'
import * as habits from '@/data/habits'
import { parseWeekdays, type ActionResult } from '@/lib/validate'

/** FormData は信用しない。型が付いていても実行時には何でも入る。 */
function readInput(formData: FormData): { name: string; daysOfWeek: string[] } {
  return {
    name: String(formData.get('name') ?? ''),
    daysOfWeek: formData.getAll('daysOfWeek').map(String),
  }
}

export async function createHabitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = readInput(formData)
  const daysOfWeek = parseWeekdays(raw.daysOfWeek)
  if (!daysOfWeek) return { ok: false, message: '実行する曜日の指定が不正です' }

  const result = await habits.createHabit({ name: raw.name, daysOfWeek })
  if (result.ok) revalidatePath('/habits')
  return result
}

export async function updateHabitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '')
  if (id === '') return { ok: false, message: '操作できませんでした' }

  const raw = readInput(formData)
  const daysOfWeek = parseWeekdays(raw.daysOfWeek)
  if (!daysOfWeek) return { ok: false, message: '実行する曜日の指定が不正です' }

  const result = await habits.updateHabit(id, { name: raw.name, daysOfWeek })
  if (result.ok) revalidatePath('/habits')
  return result
}

export async function archiveHabitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await habits.archiveHabit(String(formData.get('id') ?? ''))
  if (result.ok) revalidatePath('/habits')
  return result
}
