'use client'

import { useActionState, useEffect, useId } from 'react'
import type { Weekday } from '@/generated/prisma/client'
import type { ActionResult } from '@/lib/validate'
import { createHabitAction, updateHabitAction } from '../actions'

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'MON', label: '月' },
  { value: 'TUE', label: '火' },
  { value: 'WED', label: '水' },
  { value: 'THU', label: '木' },
  { value: 'FRI', label: '金' },
  { value: 'SAT', label: '土' },
  { value: 'SUN', label: '日' },
]

type Habit = { id: string; name: string; daysOfWeek: Weekday[] }

type HabitFormProps = {
  /** 指定すると編集フォームになる。省略すると新規登録フォーム。 */
  habit?: Habit
  /** 保存に成功したときに呼ばれる。編集フォームを閉じるのに使う。 */
  onSuccess?: () => void
}

export function HabitForm({ habit, onSuccess }: HabitFormProps) {
  // 編集フォームと新規フォームが同時に DOM に載るとき、id="name" が重複して
  // ラベルクリックのフォーカスが別フォームへ飛ぶのを防ぐ。
  const id = useId()
  const action = habit ? updateHabitAction : createHabitAction
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  )
  // 検証エラー直後は、フォームがリセットされる前に入力していた値を復元する。
  // 未送信・成功時は編集対象（habit）、それも無ければ新規登録の既定値にフォールバックする。
  const failedValues = state && !state.ok ? state.values : undefined
  const name = failedValues?.name ?? habit?.name
  const selectedDays = failedValues?.daysOfWeek ?? habit?.daysOfWeek ?? WEEKDAYS.map((d) => d.value)

  useEffect(() => {
    if (state?.ok) onSuccess?.()
    // onSuccess は毎レンダーで新しい関数になり得るので依存に含めない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form action={formAction} className="space-y-3 rounded border p-4">
      {habit && <input type="hidden" name="id" defaultValue={habit.id} />}
      <div>
        <label htmlFor={`${id}-name`} className="block text-sm font-medium">
          習慣の名前
        </label>
        <input
          id={`${id}-name`}
          name="name"
          type="text"
          defaultValue={name}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">実行する曜日</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {WEEKDAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="daysOfWeek"
                value={d.value}
                defaultChecked={selectedDays.includes(d.value)}
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      {habit && (
        <p className="text-sm text-gray-500">
          ※ 曜日を変更すると、これまでの連続週数は計算し直されます
        </p>
      )}
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded border px-3 py-1 disabled:opacity-50"
      >
        {habit ? '更新する' : '登録する'}
      </button>
    </form>
  )
}
