import { listHabits } from '@/data/habits'
import { HabitForm } from './_components/habit-form'
import { HabitList } from './_components/habit-list'

export default async function HabitsPage() {
  const habits = await listHabits()
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">習慣</h1>
      <HabitForm />
      <HabitList habits={habits} />
    </div>
  )
}
