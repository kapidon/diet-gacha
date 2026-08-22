import { getTodayView } from '@/data/checkins'
import { TodayList } from './_components/today-list'

export default async function TodayPage() {
  const view = await getTodayView()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">今日</h1>
        <p className="text-sm text-gray-500">{view.today}</p>
      </div>
      {view.todayLimitReached && (
        <p className="text-sm text-gray-500">今日のチケットは上限（3枚）に達しています</p>
      )}
      <div className="flex gap-6 rounded border p-3">
        <div>
          <p className="text-sm text-gray-500">継続日数</p>
          <p className="text-lg font-medium">{view.streak} 日</p>
          <p className="text-xs text-gray-500">1日空いても途切れません</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">チケット</p>
          <p className="text-lg font-medium">{view.ticketCount} 枚</p>
        </div>
      </div>
      <TodayList habits={view.habits} />
    </div>
  )
}
