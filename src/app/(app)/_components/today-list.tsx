'use client'

import { useActionState } from 'react'
import type { ActionResult } from '@/lib/validate'
import { checkInAction, undoCheckInAction } from '../actions'

type TodayHabit = {
  id: string
  name: string
  isToday: boolean
  doneToday: boolean
  weekDone: number
  weekTarget: number
  weeklyStreak: number
}

export function TodayList({ habits }: { habits: TodayHabit[] }) {
  if (habits.length === 0) {
    return <p className="text-sm text-gray-500">まだ習慣がありません</p>
  }

  const todays = habits.filter((h) => h.isToday)
  const others = habits.filter((h) => !h.isToday)

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-medium">今日の習慣</h2>
        {todays.length === 0 ? (
          <p className="text-sm text-gray-500">今日が対象の習慣はありません</p>
        ) : (
          <ul className="space-y-2">
            {todays.map((h) => (
              <TodayRow key={h.id} habit={h} />
            ))}
          </ul>
        )}
      </section>
      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">その他の習慣</h2>
          <ul className="space-y-2">
            {others.map((h) => (
              <TodayRow key={h.id} habit={h} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function TodayRow({ habit }: { habit: TodayHabit }) {
  const [checkState, checkFormAction, isCheckPending] = useActionState<
    ActionResult | null,
    FormData
  >(checkInAction, null)
  const [undoState, undoFormAction, isUndoPending] = useActionState<
    ActionResult | null,
    FormData
  >(undoCheckInAction, null)

  const state = habit.doneToday ? undoState : checkState

  return (
    <li className="rounded border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{habit.name}</p>
          <p className="text-sm text-gray-500">
            今週 {habit.weekDone}/{habit.weekTarget}
            {habit.weeklyStreak > 0 && ` ・ ${habit.weeklyStreak}週連続`}
          </p>
        </div>
        {habit.doneToday ? (
          <form action={undoFormAction} className="flex items-center gap-2">
            <input type="hidden" name="habitId" defaultValue={habit.id} />
            <span className="text-sm text-gray-500">達成済み</span>
            <button
              type="submit"
              disabled={isUndoPending}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              取り消す
            </button>
          </form>
        ) : (
          <form action={checkFormAction}>
            <input type="hidden" name="habitId" defaultValue={habit.id} />
            <button
              type="submit"
              disabled={isCheckPending}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              達成
            </button>
          </form>
        )}
      </div>
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.message}
        </p>
      )}
    </li>
  )
}
