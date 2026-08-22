import { requireUser } from '@/data/session'

export default async function TodayPage() {
  await requireUser()
  return <h1 className="text-xl font-bold">今日</h1>
}
