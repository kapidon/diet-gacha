import { Prisma } from '@/generated/prisma/client'

/** 他人のリソースを指したとき。DB には届かせない。 */
export class NotAllowedError extends Error {}

/**
 * 一意制約違反の制約名（列名だけが返る場合は列の組）を照合する。
 * コード（P2002 / P2010）は経路で変わるので見ない。
 */
function violates(e: unknown, expectedIndex: string, expectedFields: string[]): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false
  const cause = (e.meta as { driverAdapterError?: { cause?: Record<string, unknown> } })
    ?.driverAdapterError?.cause
  if (cause?.kind !== 'UniqueConstraintViolation') return false

  // adapter-pg 7.10.1 は index を優先し、DB が制約名を返さない場合だけ fields を返す。
  const constraint = cause.constraint as { index?: unknown; fields?: unknown } | undefined
  if (typeof constraint?.index === 'string') return constraint.index === expectedIndex

  if (!Array.isArray(constraint?.fields)) return false
  const fields = constraint.fields.map((f) => String(f).replaceAll('"', ''))
  return fields.length === expectedFields.length && expectedFields.every((f) => fields.includes(f))
}

/** HabitLog(habitId, date) — 同じ習慣を同じ日に2回。ユーザーへの通常のエラー。 */
export const isAlreadyCheckedIn = (e: unknown) =>
  violates(e, 'HabitLog_habitId_date_key', ['habitId', 'date'])

/** Ticket(userId, earnedDate, dailySeq) — 並行実行で同じ枠を取り合った。リトライ対象。 */
export const isDailySeqConflict = (e: unknown) =>
  violates(e, 'Ticket_userId_earnedDate_dailySeq_key', ['userId', 'earnedDate', 'dailySeq'])
