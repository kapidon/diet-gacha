'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">エラーが発生しました</h2>
      <button className="rounded border px-3 py-1" onClick={() => retry()}>
        もう一度試す
      </button>
    </div>
  )
}
