import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * cache() で包むことで、1リクエスト内で何度呼んでも問い合わせは1回になる。
 * Server Component どうしで値を手渡しせずに済むため、
 * うっかり Client Component に渡す事故も防げる。
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/** 未ログインならログイン画面へ送る。データを取る関数はすべてこれを通す。 */
export async function requireUser(): Promise<{ id: string }> {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  return { id: session.user.id }
}
