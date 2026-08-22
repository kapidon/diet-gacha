import { describe, expect, it } from 'vitest'
import {
  addDays, calcStreak, calcWeeklyStreak, diffDays,
  isoWeekStart, jstDateString, jstWeekday,
} from './date'

describe('jstDateString', () => {
  it('UTC 14:59 は当日', () => {
    expect(jstDateString(new Date('2026-08-22T14:59:00Z'))).toBe('2026-08-22')
  })
  it('UTC 15:00（JST 翌0時）は翌日', () => {
    expect(jstDateString(new Date('2026-08-22T15:00:00Z'))).toBe('2026-08-23')
  })
})

describe('jstWeekday', () => {
  it('2026-08-24 は月曜', () => expect(jstWeekday('2026-08-24')).toBe('MON'))
  it('2026-08-23 は日曜', () => expect(jstWeekday('2026-08-23')).toBe('SUN'))
})

describe('isoWeekStart', () => {
  it('日曜はその週の月曜へ戻る', () => expect(isoWeekStart('2026-08-23')).toBe('2026-08-17'))
  it('月曜はそのまま', () => expect(isoWeekStart('2026-08-24')).toBe('2026-08-24'))
})

describe('diffDays', () => {
  it('3日差', () => expect(diffDays('2026-08-24', '2026-08-21')).toBe(3))
})

describe('addDays', () => {
  it('月末をまたぐ', () => expect(addDays('2026-08-31', 1)).toBe('2026-09-01'))
})

describe('calcStreak', () => {
  it('記録なしは 0', () => expect(calcStreak([], '2026-08-24')).toBe(0))
  it('今日のみは 1', () => expect(calcStreak(['2026-08-24'], '2026-08-24')).toBe(1))
  it('昨日まで（今日未記録）でも継続', () => expect(calcStreak(['2026-08-23'], '2026-08-24')).toBe(1))
  it('1日空き（月・水）は継続して 2', () => {
    expect(calcStreak(['2026-08-24', '2026-08-26'], '2026-08-26')).toBe(2)
  })
  it('2日空き（月・木）は途切れる', () => {
    expect(calcStreak(['2026-08-24', '2026-08-27'], '2026-08-27')).toBe(1)
  })
  it('最終記録が today-2 なら生きている', () => {
    expect(calcStreak(['2026-08-22'], '2026-08-24')).toBe(1)
  })
  it('最終記録が today-3 なら 0', () => {
    expect(calcStreak(['2026-08-21'], '2026-08-24')).toBe(0)
  })
  it('連続5日', () => {
    const dates = ['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24']
    expect(calcStreak(dates, '2026-08-24')).toBe(5)
  })
})

describe('calcWeeklyStreak', () => {
  it('今週が未達でも前週までを返す', () => {
    const dates = ['2026-08-17', '2026-08-19', '2026-08-21', '2026-08-24']
    expect(calcWeeklyStreak(dates, 3, '2026-08-25')).toBe(1)
  })
  it('今週も達成していれば +1', () => {
    const dates = ['2026-08-17', '2026-08-19', '2026-08-21', '2026-08-24', '2026-08-25', '2026-08-26']
    expect(calcWeeklyStreak(dates, 3, '2026-08-26')).toBe(2)
  })
  it('未達の週で打ち切る', () => {
    const dates = ['2026-08-10', '2026-08-17', '2026-08-19', '2026-08-21']
    expect(calcWeeklyStreak(dates, 3, '2026-08-25')).toBe(1)
  })
  it('記録なしは 0', () => expect(calcWeeklyStreak([], 3, '2026-08-25')).toBe(0))
  it('target が 0 なら 0（無限ループしない）', () => {
    expect(calcWeeklyStreak(['2026-08-17', '2026-08-24'], 0, '2026-08-25')).toBe(0)
  })
})
