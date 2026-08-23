'use client'

import { useActionState, useState } from 'react'
import type { Weekday } from '@/generated/prisma/client'
import type { ActionResult } from '@/lib/validate'
import { archiveHabitAction } from '../actions'
import { HabitForm } from './habit-form'

type Habit = { id: string; name: string; daysOfWeek: Weekday[] }

export function HabitList({ habits }: { habits: Habit[] }) {
  if (habits.length === 0) {
    return <p className="text-sm text-gray-500">まだ習慣がありません</p>
  }

  return (
    <ul className="space-y-3">
      {habits.map((habit) => (
        <HabitRow key={habit.id} habit={habit} />
      ))}
    </ul>
  )
}

function HabitRow({ habit }: { habit: Habit }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    archiveHabitAction,
    null,
  )

  if (editing) {
    return (
      <li>
        <HabitForm habit={habit} onSuccess={() => setEditing(false)} />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-1 text-sm underline"
        >
          キャンセル
        </button>
      </li>
    )
  }

  return (
    <li className="rounded border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{habit.name}</p>
          <p className="text-sm text-gray-500">週 {habit.daysOfWeek.length} 回</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border px-3 py-1"
          >
            編集
          </button>
          <form action={formAction}>
            <input type="hidden" name="id" defaultValue={habit.id} />
            <button
              type="submit"
              disabled={isPending}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              削除
            </button>
          </form>
        </div>
      </div>
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.message}
        </p>
      )}
    </li>
  )
}
