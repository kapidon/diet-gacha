import type { Weekday } from '@/generated/prisma/client'

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; values?: HabitInput }

export type HabitInput = { name: string; daysOfWeek: Weekday[] }

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

/**
 * FormData から来た文字列を Weekday に絞り込む。
 * TypeScript の cast は実行時に何も確かめないので、allowlist で照合する。
 * Server Action の引数は改変できるため、チェックボックスが正しくても検証は要る。
 */
export function parseWeekdays(values: string[]): Weekday[] | null {
  const allowed: readonly string[] = WEEKDAYS
  if (values.some((v) => !allowed.includes(v))) return null
  return values as Weekday[]
}

/**
 * 作成と更新の両方から呼ぶ。検証はここ1箇所だけに置く。
 *
 * 失敗時は入力値を values に載せて返す。useActionState を使うフォームは
 * アクション完了時に非制御フィールドをすべて既定値へ戻す（React の仕様。
 * requestFormReset が呼ばれるため）ので、検証エラーで入力内容が消えないよう
 * defaultValue に流し込むために必要。daysOfWeek はこの時点で allowlist を
 * 通過済み（parseWeekdays が先に呼ばれる）なので、そのまま信用してよい。
 */
export function validateHabit(input: HabitInput): ActionResult {
  const name = input.name.trim()
  if (name.length === 0) {
    return { ok: false, message: '習慣の名前を入力してください', values: input }
  }
  if (name.length > 30) {
    return { ok: false, message: '習慣の名前は30文字以内にしてください', values: input }
  }

  const days = input.daysOfWeek
  if (days.length === 0) {
    return { ok: false, message: '実行する曜日を1つ以上選んでください', values: input }
  }
  if (new Set(days).size !== days.length) {
    return { ok: false, message: '曜日が重複しています', values: input }
  }

  return { ok: true }
}
