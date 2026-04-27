'use client'

import { useEffect } from 'react'

export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[FeedError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-zinc-400 text-sm">피드를 불러오는 중 오류가 발생했습니다.</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
      >
        다시 시도
      </button>
    </div>
  )
}
