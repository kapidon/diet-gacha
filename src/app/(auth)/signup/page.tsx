'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth-errors'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    // name は必須。/sign-up/email の body スキーマで optional ではない。
    const { error } = await authClient.signUp.email({ name, email, password })

    if (error) {
      setError(authErrorMessage(error))
      setPending(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">新規登録</h1>

      <label className="flex flex-col gap-1">
        表示名
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded border p-2"
        />
      </label>

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
        パスワード（8文字以上）
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
        {pending ? '登録中…' : '登録する'}
      </button>

      <Link href="/login" className="underline">
        ログインはこちら
      </Link>
    </form>
  )
}
