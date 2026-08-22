'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const { error } = await authClient.signIn.email({ email, password })

    if (error) {
      setError(error.message ?? 'ログインできませんでした')
      setPending(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  async function handleSignOut() {
    setError(null)
    setPending(true)

    const { error } = await authClient.signOut()

    if (error) {
      setError(error.message ?? 'ログアウトできませんでした')
      setPending(false)
      return
    }

    setPending(false)
    router.refresh()
  }

  if (sessionPending) return <p>読み込み中…</p>

  // ログイン後の画面は Task 4 で作る。それまではこのページがログアウトの導線を兼ねる。
  if (session) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">ログイン中</h1>
        <p>{session.user.email}</p>
        {error && <p role="alert">{error}</p>}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={pending}
          className="rounded bg-black p-2 text-white disabled:opacity-50"
        >
          {pending ? 'ログアウト中…' : 'ログアウト'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">ログイン</h1>

      <label className="flex flex-col gap-1">
        メールアドレス
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded border p-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        パスワード
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded border p-2"
        />
      </label>

      {error && <p role="alert">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black p-2 text-white disabled:opacity-50"
      >
        {pending ? 'ログイン中…' : 'ログインする'}
      </button>

      <Link href="/signup" className="underline">
        新規登録はこちら
      </Link>
    </form>
  )
}
