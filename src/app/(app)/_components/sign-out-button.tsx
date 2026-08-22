'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function SignOutButton() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSignOut() {
    setError(null)
    setPending(true)

    const { error } = await authClient.signOut()

    if (error) {
      setError(error.message ?? 'ログアウトできませんでした')
      setPending(false)
      return
    }

    router.push('/login')
    router.refresh()
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="rounded border px-3 py-1 disabled:opacity-50"
      >
        {pending ? 'ログアウト中…' : 'ログアウト'}
      </button>
    </div>
  )
}
