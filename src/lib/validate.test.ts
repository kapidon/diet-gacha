import { describe, expect, it } from 'vitest'
import { parseWeekdays, validateHabit } from './validate'

describe('validateHabit', () => {
  it('名前が空なら失敗', () => {
    const r = validateHabit({ name: '', daysOfWeek: ['MON'] })
    expect(r.ok).toBe(false)
  })
  it('名前が31文字なら失敗', () => {
    const r = validateHabit({ name: 'あ'.repeat(31), daysOfWeek: ['MON'] })
    expect(r.ok).toBe(false)
  })
  it('曜日が0個なら失敗', () => {
    const r = validateHabit({ name: '筋トレ', daysOfWeek: [] })
    expect(r.ok).toBe(false)
  })
  it('曜日が重複していたら失敗', () => {
    const r = validateHabit({ name: '筋トレ', daysOfWeek: ['MON', 'MON'] })
    expect(r.ok).toBe(false)
  })
  it('正しい入力なら成功', () => {
    const r = validateHabit({ name: '筋トレ', daysOfWeek: ['MON', 'WED', 'FRI'] })
    expect(r.ok).toBe(true)
  })
})

describe('parseWeekdays', () => {
  it('7つすべてを受け付ける', () => {
    const all = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    expect(parseWeekdays(all)).toEqual(all)
  })
  it('allowlist に無い値があれば null', () => {
    expect(parseWeekdays(['MON', 'INVALID'])).toBeNull()
  })
  it('小文字は受け付けない', () => expect(parseWeekdays(['mon'])).toBeNull())
  it('空配列はそのまま返す（件数の検証は validateHabit の担当）', () => {
    expect(parseWeekdays([])).toEqual([])
  })
})
