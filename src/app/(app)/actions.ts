'use server'

import { revalidatePath } from 'next/cache'
import { checkInWithRetry } from '@/data/checkins'
import type { ActionResult } from '@/lib/validate'

/**
 * Server Action は公開 API と同じ入口として扱う。habitId を信用せず、
 * 認可は checkInForUser の中の `where: { id, userId }` で行う。
 */
export async function checkInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const habitId = String(formData.get('habitId') ?? '')
  if (habitId === '') return { ok: false, message: '操作できませんでした' }

  const result = await checkInWithRetry(habitId)
  if (result.ok) revalidatePath('/')
  return result
}
