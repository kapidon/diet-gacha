import { Prisma } from '@/generated/prisma/client'

/** 他人のリソースを指したとき。DB には届かせない。 */
export class NotAllowedError extends Error {}

/**
 * 一意制約違反なら、違反した列名の配列を返す。そうでなければ null。
 * コード（P2002 / P2010）は経路で変わるので見ない。
 */
function uniqueViolationFields(e: unknown): string[] | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null
  const cause = (e.meta as { driverAdapterError?: { cause?: Record<string, unknown> } })
    ?.driverAdapterError?.cause
  if (cause?.kind !== 'UniqueConstraintViolation') return null

  const fields = (cause.constraint as { fields?: unknown } | undefined)?.fields
  if (!Array.isArray(fields)) return null
  return fields.map((f) => String(f).replaceAll('"', ''))
}

function violates(e: unknown, expected: string[]): boolean {
  const fields = uniqueViolationFields(e)
  if (!fields) return false
  return fields.length === expected.length && expected.every((f) => fields.includes(f))
}

/** HabitLog(habitId, date) — 同じ習慣を同じ日に2回。ユーザーへの通常のエラー。 */
export const isAlreadyCheckedIn = (e: unknown) => violates(e, ['habitId', 'date'])

/** Ticket(userId, earnedDate, dailySeq) — 並行実行で同じ枠を取り合った。リトライ対象。 */
export const isDailySeqConflict = (e: unknown) =>
  violates(e, ['userId', 'earnedDate', 'dailySeq'])
