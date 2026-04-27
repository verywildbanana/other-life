'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [token, setToken] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include',
      })
      if (res.ok) {
        router.replace('/admin')
      } else {
        setError('비밀번호가 올바르지 않습니다.')
      }
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-white font-semibold text-lg">Admin 로그인</h1>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="비밀번호"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
          autoFocus
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
