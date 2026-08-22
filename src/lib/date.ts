import type { Weekday } from '@/generated/prisma/client'

const JST = 'Asia/Tokyo'
const WEEKDAYS: Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Date から JST での 'YYYY-MM-DD' を得る。en-CA は YYYY-MM-DD 形式で出力される。 */
export function jstDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** 'YYYY-MM-DD' を UTC 0時のミリ秒に変換する。日付計算をタイムゾーンから切り離すため。 */
function toUtcMidnight(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(dateStr: string, n: number): string {
  return new Date(toUtcMidnight(dateStr) + n * 86_400_000).toISOString().slice(0, 10)
}

/** a - b の日数。 */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMidnight(a) - toUtcMidnight(b)) / 86_400_000)
}

export function jstWeekday(dateStr: string): Weekday {
  return WEEKDAYS[new Date(toUtcMidnight(dateStr)).getUTCDay()]
}

/** その日が属する週（月曜始まり）の月曜を返す。 */
export function isoWeekStart(dateStr: string): string {
  const day = new Date(toUtcMidnight(dateStr)).getUTCDay()
  const backToMonday = day === 0 ? 6 : day - 1
  return addDays(dateStr, -backToMonday)
}

/**
 * 継続日数。記録した日数を数える（暦の日数ではない）。
 * 1日の空白は許容し、2日連続で空いたら途切れる。
 * today を受け取るのは、最後の記録日と今日の距離にも同じ規則が適用されるため。
 */
export function calcStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort().reverse()
  if (diffDays(today, sorted[0]) > 2) return 0

  let count = 1
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(sorted[i - 1], sorted[i]) > 2) break
    count++
  }
  return count
}

/**
 * 習慣ごとの週次ストリーク。週の達成回数が target 以上の週を連続で数える。
 * 今週は進行中なので、未達でも途切れさせない。
 */
export function calcWeeklyStreak(dates: string[], target: number, today: string): number {
  const counts = new Map<string, number>()
  for (const d of new Set(dates)) {
    const w = isoWeekStart(d)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }

  let streak = 0
  let week = isoWeekStart(today)
  if ((counts.get(week) ?? 0) >= target) streak++

  week = addDays(week, -7)
  while ((counts.get(week) ?? 0) >= target) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}
