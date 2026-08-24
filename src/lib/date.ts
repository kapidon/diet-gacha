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
  // 添字アクセスは undefined を返しうる（noUncheckedIndexedAccess）。
  // 不正な文字列を NaN のまま通すと、addDays の toISOString まで運ばれて
  // 呼び出し元から離れた場所で RangeError になり、原因が追えない。ここで落とす。
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y + m + d)) {
    throw new Error(`日付は YYYY-MM-DD 形式で渡す: ${dateStr}`)
  }
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
  const w = WEEKDAYS[new Date(toUtcMidnight(dateStr)).getUTCDay()]
  // getUTCDay が返すのは 0..6 だけだが、型からはそれを読み取れない。
  if (w === undefined) throw new Error(`曜日を特定できない: ${dateStr}`)
  return w
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
  // 分割代入にすると、空配列の判定と先頭要素の取り出しが一度で済む。
  const [newest, ...older] = [...new Set(dates)].sort().reverse()
  if (newest === undefined) return 0
  if (diffDays(today, newest) > 2) return 0

  let count = 1
  let prev = newest
  for (const d of older) {
    if (diffDays(prev, d) > 2) break
    count++
    prev = d
  }
  return count
}

/**
 * 習慣ごとの週次ストリーク。週の達成回数が target 以上の週を連続で数える。
 * 今週は進行中なので、未達でも途切れさせない。
 */
export function calcWeeklyStreak(dates: string[], target: number, today: string): number {
  // target が 0 以下だとどの週も「達成」扱いになり while が無限ループする。
  // 週次ストリークの定義上、目標回数0の習慣にストリークは存在しない
  // （DB の CHECK 制約により通常は target <= 0 に到達しないが、純粋関数側でも防ぐ）。
  if (target <= 0) return 0

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
